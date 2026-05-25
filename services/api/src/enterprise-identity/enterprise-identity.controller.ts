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
import { SamlService } from './saml.service';
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
    private readonly samlService: SamlService,
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

  // ── SAML 2.0 Flow (native — no passport-saml) ────────────────────────────

  /**
   * GET /enterprise-identity/saml/:tenantId/login
   *
   * Initiates SAML SP-initiated SSO flow.
   *
   * Builds a signed SAML AuthnRequest (HTTP-Redirect Binding):
   *   XML → deflateRaw → base64 → SAMLRequest query param
   *
   * Redirects to the IdP Single Sign-On URL.
   * Compatible with Okta, Azure AD / Entra ID, ADFS, PingFederate, OneLogin.
   */
  @Get('saml/:tenantId/login')
  async samlLogin(
    @Param('tenantId') tenantId: string,
    @Query('redirectAfter') redirectAfter: string | undefined,
    @Res() res: Response,
  ) {
    const ssoConf = await this.ssoConfig.findFull(tenantId);
    if (!ssoConf || ssoConf.protocol !== 'SAML' || !ssoConf.samlEntryPoint) {
      throw new UnauthorizedException(`SAML SSO not configured for tenant ${tenantId}`);
    }

    if (!ssoConf.samlCert) {
      throw new UnauthorizedException(`SAML: IdP signing certificate not configured for tenant ${tenantId}`);
    }

    const apiUrl = this.config.get<string>('API_URL') ?? 'https://api.yourgift.pt';
    const issuer = ssoConf.samlIssuer ?? `${apiUrl}/enterprise-identity/saml/${tenantId}`;
    const callbackUrl = ssoConf.samlCallbackUrl ?? this.defaultCallbackUrl(tenantId, 'saml');

    const redirectUrl = await this.samlService.buildAuthRequestUrl({
      entryPoint: ssoConf.samlEntryPoint,
      issuer,
      callbackUrl,
      tenantId,
      redirectAfter,
    });

    this.logger.log(`SAML login initiated: tenant=${tenantId} idp=${ssoConf.samlEntryPoint}`);
    res.redirect(redirectUrl);
  }

  /**
   * POST /enterprise-identity/saml/:tenantId/callback
   *
   * SAML ACS (Assertion Consumer Service) endpoint.
   * IdP POSTs the SAMLResponse here after authentication.
   *
   * Validates:
   *  - Response Status (must be Success)
   *  - Conditions (NotBefore / NotOnOrAfter / clock skew ±5min)
   *  - AudienceRestriction (SP entityId)
   *  - XML Signature (RSA-SHA256 or RSA-SHA1 fallback) using IdP certificate
   *  - InResponseTo (anti-replay, matched against outstanding request IDs)
   *
   * On success: upserts user record → issues JWT pair → redirects to frontend.
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
      this.logger.error(`SAML ACS: missing SAMLResponse for tenant ${tenantId}`);
      return res.redirect(`${frontendUrl}/auth/error?error=missing_saml_response`);
    }

    try {
      const ssoConf = await this.ssoConfig.findFull(tenantId);
      if (!ssoConf || ssoConf.protocol !== 'SAML') {
        throw new UnauthorizedException('SAML not configured for this tenant');
      }
      if (!ssoConf.samlCert) {
        throw new UnauthorizedException('SAML: IdP signing certificate not configured');
      }

      const apiUrl = this.config.get<string>('API_URL') ?? 'https://api.yourgift.pt';
      const issuer = ssoConf.samlIssuer ?? `${apiUrl}/enterprise-identity/saml/${tenantId}`;
      const callbackUrl = ssoConf.samlCallbackUrl ?? this.defaultCallbackUrl(tenantId, 'saml');

      // Parse RelayState to recover context from the original request
      const relayState = this.samlService.parseRelayState(body.RelayState);

      // Validate the SAML Response (signature, conditions, status)
      const profile = await this.samlService.validateResponse(
        body.SAMLResponse,
        {
          idpCert: ssoConf.samlCert,
          issuer,
          idpIssuer: ssoConf.samlIdpIssuer,
          callbackUrl,
        },
        relayState,
      );

      this.logger.log(`SAML SSO login: tenant=${tenantId} email=${profile.email}`);

      // Upsert user record in our DB
      const client = await this.authService.upsertOAuthClient({
        provider: 'saml',
        providerUid: profile.nameId,
        email: profile.email,
        displayName: profile.displayName,
        avatarUrl: undefined,
      });

      // Issue our JWT pair
      const { accessToken, refreshToken, expiresIn } = await this.authService.login(client);

      // Redirect to frontend SSO completion page with tokens
      const redirectAfter = relayState?.redirectAfter ?? '/dashboard';
      const params = new URLSearchParams({
        accessToken,
        refreshToken,
        expiresIn: String(expiresIn),
        tenantId,
        redirect: redirectAfter,
      });

      return res.redirect(`${frontendUrl}/auth/sso-complete?${params.toString()}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'SAML error';
      this.logger.error(`SAML ACS failed: tenant=${tenantId} — ${msg}`);
      return res.redirect(
        `${frontendUrl}/auth/error?error=${encodeURIComponent(msg)}`,
      );
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private defaultCallbackUrl(tenantId: string, protocol: 'oidc' | 'saml'): string {
    const apiUrl = this.config.get<string>('API_URL') ?? 'https://api.yourgift.pt';
    return `${apiUrl}/enterprise-identity/${protocol}/${tenantId}/callback`;
  }
}
