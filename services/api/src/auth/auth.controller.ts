import {
  Controller, Post, Get, Body, Request, Response, UseGuards,
  HttpCode, BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  // ── Local login ──────────────────────────────────────────────────────
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseGuards(AuthGuard('local'))
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Email + password login' })
  async login(@Request() req: any) {
    const tokens = await this.auth.login(req.user);
    await this.auth.audit({ clientId: req.user.id, email: req.user.email, action: 'login', provider: 'local' });
    return tokens;
  }

  // ── Register ─────────────────────────────────────────────────────────
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('register')
  @ApiOperation({ summary: 'Register new client' })
  async register(@Body() dto: RegisterDto) {
    const passwordHash = await this.auth.hashPassword(dto.password);
    const client = await this.prisma.client.create({
      data: { email: dto.email, name: dto.name, company: dto.company, passwordHash },
    });
    const tokens = await this.auth.login(client);
    await this.auth.audit({ clientId: client.id, email: client.email, action: 'register', provider: 'local' });
    return tokens;
  }

  // ── Refresh token ────────────────────────────────────────────────────
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Rotate refresh token' })
  async refresh(@Body() body: { refreshToken: string }) {
    if (!body.refreshToken) throw new BadRequestException('refreshToken required');
    return this.auth.refreshTokens(body.refreshToken);
  }

  // ── Session ──────────────────────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Get('session')
  @ApiOperation({ summary: 'Get current session info' })
  async session(@Request() req: any) {
    return this.auth.getSession(req.user.sub);
  }

  // ── Logout ───────────────────────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Logout — revoke all refresh tokens' })
  async logout(@Request() req: any) {
    await this.auth.revokeAllTokens(req.user.sub);
    await this.auth.audit({ clientId: req.user.sub, action: 'logout' });
    return { ok: true };
  }

  // ── Google OAuth ─────────────────────────────────────────────────────
  @Get('login/google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Initiate Google OAuth flow' })
  async googleLogin() { /* Passport redirects */ }

  @Get('callback/google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Google OAuth callback' })
  async googleCallback(@Request() req: any, @Response() res: any) {
    try {
      const client = await this.auth.upsertOAuthClient(req.user);
      const tokens = await this.auth.issueTokenPair(client);
      await this.auth.audit({ clientId: client.id, email: client.email, action: 'oauth_login', provider: 'google' });
      const frontendUrl = process.env.FRONTEND_URL ?? 'https://www.yourgift.pt';
      return res.redirect(`${frontendUrl}/auth/callback?access_token=${tokens.accessToken}&refresh_token=${tokens.refreshToken}`);
    } catch (e: any) {
      const frontendUrl = process.env.FRONTEND_URL ?? 'https://www.yourgift.pt';
      return res.redirect(`${frontendUrl}/auth/recover?reason=google_failed`);
    }
  }

  // ── Apple OAuth ──────────────────────────────────────────────────────
  @Get('login/apple')
  @UseGuards(AuthGuard('apple'))
  @ApiOperation({ summary: 'Initiate Apple Sign-In flow' })
  async appleLogin() { /* Passport redirects */ }

  @Post('callback/apple')
  @UseGuards(AuthGuard('apple'))
  @ApiOperation({ summary: 'Apple Sign-In callback (POST per Apple spec)' })
  async appleCallback(@Request() req: any, @Response() res: any) {
    try {
      const client = await this.auth.upsertOAuthClient(req.user);
      const tokens = await this.auth.issueTokenPair(client);
      await this.auth.audit({ clientId: client.id, email: client.email, action: 'oauth_login', provider: 'apple' });
      const frontendUrl = process.env.FRONTEND_URL ?? 'https://www.yourgift.pt';
      return res.redirect(`${frontendUrl}/auth/callback?access_token=${tokens.accessToken}&refresh_token=${tokens.refreshToken}`);
    } catch (e: any) {
      const frontendUrl = process.env.FRONTEND_URL ?? 'https://www.yourgift.pt';
      return res.redirect(`${frontendUrl}/auth/recover?reason=apple_failed`);
    }
  }

  // ── Magic link ───────────────────────────────────────────────────────
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post('magic-link/send')
  @HttpCode(200)
  @ApiOperation({ summary: 'Send magic link email' })
  async sendMagicLink(@Body() body: { email: string }) {
    if (!body.email) throw new BadRequestException('email required');
    const token = await this.auth.createMagicLink(body.email);
    // In production: send via Resend/email service
    // For now: return token in dev mode only
    const isDev = process.env.NODE_ENV !== 'production';
    await this.auth.audit({ email: body.email, action: 'magic_link_sent' });
    return { ok: true, ...(isDev ? { token } : {}) };
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('magic-link/verify')
  @HttpCode(200)
  @ApiOperation({ summary: 'Verify magic link token' })
  async verifyMagicLink(@Body() body: { token: string }) {
    if (!body.token) throw new BadRequestException('token required');
    const client = await this.auth.verifyMagicLink(body.token);
    const tokens = await this.auth.issueTokenPair(client);
    await this.auth.audit({ clientId: client.id, email: client.email, action: 'magic_link_login' });
    return tokens;
  }

  // ── Audit logs ───────────────────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Get('audit')
  @ApiOperation({ summary: 'Auth audit log (last 100 events)' })
  async auditLog() {
    return this.auth.getAuditLogs(100);
  }
}
