import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
  Logger,
  UnauthorizedException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { SSOConfigService, SSOConfigInput } from './sso-config.service';
import { OIDCService } from './oidc.service';
import { AuthService } from '../auth/auth.service';

/**
 * EnterpriseIdentityController
 *
 * SSO management + OIDC flow endpoints.
 *
 * Admin routes (JWT + AdminGuard):
 *   POST   /enterprise-identity/sso/:tenantId/config      — configure IdP
 *   GET    /enterprise-identity/sso/:tenantId/config      — get config (redacted)
 *   DELETE /enterprise-identity/sso/:tenantId/config      — deactivate SSO
 *   GET    /enterprise-identity/sso                       — list all SSO configs
 *
 * Public SSO flow routes:
 *   GET    /enterprise-identity/oidc/:tenantId/login      — initiate OIDC flow
 *   GET    /enterprise-identity/oidc/:tenantId/callback   — OIDC callback
 *
 * SAML routes (requires passport-saml — stubbed):
 *   POST   /enterprise-identity/saml/:tenantId/login      — initiate SAML flow
 *   POST   /enterprise-identity/saml/:tenantId/callback   — SAML ACS endpoint
 */

@Controller('enterprise-identity')
export class EnterpriseIdentityController {
  private readonly logger = new Logger(EnterpriseIdentityController.name);

  constructor(
    private readonly ssoConfig: SSOConfigService,
    private readonly oidcService: OIDCService,
    private readonly config: ConfigService,
    private readonly authService: AuthService,
  ) {}

  // ── SSO Config Management (Admin) ─────────────────────────────────────────

  @Post('sso/:tenantId/config')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async configureSSOForTenant(
    @Param('tenantId') tenantId: string,
    @Body() body: Omit<SSOConfigInput, 'tenantId'>,
  ) {
    const config = await this.ssoConfig.upsert({ ...body, tenantId });
    return {
      success: true,
      message: `SSO configured for tenant ${tenantId}`,
      config,
    };
  }

  @Get('sso/:tenantId/config')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getSSOConfig(@Param('tenantId') tenantId: string) {
    const config = await this.ssoConfig.findByTenant(tenantId);
    if (!config) {
      return { configured: false };
    }
    return { configured: true, config };
  }

  @Delete('sso/:tenantId/config')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deactivateSSOConfig(@Param('tenantId') tenantId: string) {
    await this.ssoConfig.deactivate(tenantId);
  }

  @Get('sso')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async listAllSSOConfigs() {
    const configs = await this.ssoConfig.list();
    return { total: configs.length, configs };
  }

  // ── OIDC Flow ─────────────────────────────────────────────────────────────

  /**
   * GET /enterprise-identity/oidc/:tenantId/login
   *
   * Initiates OIDC authorization flow.
   * Redirects user to their IdP (Okta / Azure AD / etc.)
   */
  @Get('oidc/:tenantId/login')
  async oidcLogin(
    @Param('tenantId') tenantId: string,
    @Query('redirectAfter') redirectAfter: string | undefined,
    @Res() res: Response,
  ) {
    const ssoConf = await this.ssoConfig.findFull(tenantId);
    if (!ssoConf || ssoConf.protocol !== 'OIDC' || !ssoConf.active) {
      throw new UnauthorizedException(`OIDC SSO not configured for tenant ${tenantId}`);
    }

    const { url } = this.oidcService.generateAuthorizationUrl({
      issuer: ssoConf.oidcIssuer!,
      clientId: ssoConf.oidcClientId!,
      callbackUrl: ssoConf.oidcCallbackUrl ?? this.defaultCallbackUrl(tenantId, 'oidc'),
      scopes: ssoConf.oidcScopes ?? ['openid', 'profile', 'email'],
      tenantId,
      redirectAfter,
    });

    this.logger.log(`OIDC login initiated: tenant=${tenantId}`);
    res.redirect(url);
  }

  /**
   * GET /enterprise-identity/oidc/:tenantId/callback
   *
   * IdP redirects here after authentication.
   * Exchanges code → tokens → user profile → issues our JWT.
   */
  @Get('oidc/:tenantId/callback')
  async oidcCallback(
    @Param('tenantId') tenantId: string,
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string | undefined,
    @Query('error_description') errorDescription: string | undefined,
    @Res() res: Response,
  ) {
    const frontendUrl = this.config.get<string>('FRONTEND_URL') ?? 'https://app.yourgift.pt';

    if (error) {
      this.logger.error(`OIDC callback error: ${error} — ${errorDescription}`);
      return res.redirect(`${frontendUrl}/auth/error?error=${encodeURIComponent(error)}`);
    }

    try {
      const ssoConf = await this.ssoConfig.findFull(tenantId);
      if (!ssoConf || ssoConf.protocol !== 'OIDC') {
        throw new UnauthorizedException('OIDC not configured');
      }

      const { tokens, storedState } = await this.oidcService.exchangeCode({
        code,
        state,
        issuer: ssoConf.oidcIssuer!,
        clientId: ssoConf.oidcClientId!,
        clientSecret: ssoConf.oidcClientSecret!,
        callbackUrl: ssoConf.oidcCallbackUrl ?? this.defaultCallbackUrl(tenantId, 'oidc'),
      });

      const profile = await this.oidcService.validateIdToken(
        tokens.idToken,
        storedState.nonce,
        ssoConf.oidcIssuer!,
        ssoConf.oidcClientId!,
        tenantId,
      );

      this.logger.log(`OIDC SSO login: tenant=${tenantId} email=${profile.email}`);

      // Upsert user in DB using the same OAuth path (provider='google' covers OIDC/OAuth2)
      const client = await this.authService.upsertOAuthClient({
        provider: 'google',  // OIDC uses OAuth2 under the hood
        providerUid: profile.sub,
        email: profile.email,
        displayName: profile.name,
        avatarUrl: profile.picture,
      });

      // Issue our JWT pair
      const { accessToken, refreshToken, expiresIn } = await this.authService.login(client);

      // Redirect to frontend with token in query param
      // The frontend SPA reads it, stores in memory/cookie, then cleans the URL.
      // Use a short-lived fragment so the token doesn't appear in server logs.
      const redirectAfter = storedState.redirectAfter ?? '/dashboard';
      const params = new URLSearchParams({
        accessToken,
        refreshToken,
        expiresIn: String(expiresIn),
        tenantId,
        redirect: redirectAfter,
      });
      return res.redirect(`${frontendUrl}/auth/sso-complete?${params.toString()}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'SSO error';
      this.logger.error(`OIDC callback failed: ${msg}`);
      return res.redirect(`${frontendUrl}/auth/error?error=${encodeURIComponent(msg)}`);
    }
  }

  // ── SAML Flow (Stubbed — requires passport-saml) ──────────────────────────

  /**
   * GET /enterprise-identity/saml/:tenantId/login
   *
   * Redirects to IdP SAML SSO URL.
   * TODO: Integrate passport-saml once package is available.
   * Install: pnpm add passport-saml @types/passport-saml --filter api
   */
  @Get('saml/:tenantId/login')
  async samlLogin(
    @Param('tenantId') tenantId: string,
    @Res() res: Response,
  ) {
    const ssoConf = await this.ssoConfig.findFull(tenantId);
    if (!ssoConf || ssoConf.protocol !== 'SAML' || !ssoConf.samlEntryPoint) {
      throw new UnauthorizedException(`SAML SSO not configured for tenant ${tenantId}`);
    }

    // Redirect directly to IdP entry point (basic redirect without AuthnRequest signature)
    // For signed requests, integrate passport-saml here
    const spIssuer = ssoConf.samlIssuer ?? `${this.config.get('API_URL')}/enterprise-identity/saml/${tenantId}`;
    const acsUrl = encodeURIComponent(this.defaultCallbackUrl(tenantId, 'saml'));
    const issuer = encodeURIComponent(spIssuer);

    this.logger.log(`SAML login initiated: tenant=${tenantId} entryPoint=${ssoConf.samlEntryPoint}`);
    res.redirect(`${ssoConf.samlEntryPoint}?SAMLRequest=&RelayState=${acsUrl}&Issuer=${issuer}`);
  }

  /**
   * POST /enterprise-identity/saml/:tenantId/callback
   *
   * SAML ACS (Assertion Consumer Service) endpoint.
   * IdP POSTs the SAML Response here.
   * TODO: Parse and verify with passport-saml.
   */
  @Post('saml/:tenantId/callback')
  @HttpCode(HttpStatus.OK)
  async samlCallback(
    @Param('tenantId') tenantId: string,
    @Body() body: { SAMLResponse?: string; RelayState?: string },
    @Res() res: Response,
  ) {
    const frontendUrl = this.config.get<string>('FRONTEND_URL') ?? 'https://app.yourgift.pt';

    if (!body.SAMLResponse) {
      this.logger.error(`SAML callback: missing SAMLResponse for tenant ${tenantId}`);
      return res.redirect(`${frontendUrl}/auth/error?error=missing_saml_response`);
    }

    this.logger.log(`SAML ACS received: tenant=${tenantId} — passport-saml integration pending`);

    // When passport-saml is installed:
    // const passport = require('passport');
    // const { Strategy: SamlStrategy } = require('passport-saml');
    // const ssoConf = await this.ssoConfig.findFull(tenantId);
    // const strategy = new SamlStrategy({ entryPoint: ssoConf.samlEntryPoint, cert: ssoConf.samlCert, ... }, cb);
    // strategy.authenticate(req, {}, callback);

    return res.redirect(`${frontendUrl}/auth/error?error=saml_integration_pending`);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private defaultCallbackUrl(tenantId: string, protocol: 'oidc' | 'saml'): string {
    const apiUrl = this.config.get<string>('API_URL') ?? 'https://api.yourgift.pt';
    return `${apiUrl}/enterprise-identity/${protocol}/${tenantId}/callback`;
  }
}
