import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { IdentityResolverService } from './identity-resolver.service';
import { SessionAuthorityService } from './session-authority.service';
import { EventBusService } from '../events/event-bus.service';
import { createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';

export interface OAuthProfile {
  provider: 'google' | 'apple' | 'saml' | 'oidc';
  providerUid: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable()
export class AuthService {
  private get db(): any { return this.prisma; }

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly identityResolver: IdentityResolverService,
    private readonly sessionAuthority: SessionAuthorityService,
    private readonly eventBus: EventBusService,
  ) {}

  // ── Existing local auth ───────────────────────────────────────────────
  async validateUser(email: string, password: string) {
    const client = await this.db.client.findUnique({ where: { email } });
    if (!client || !client.passwordHash) throw new UnauthorizedException('Invalid credentials');
    const valid = await bcrypt.compare(password, client.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');
    return client;
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  // ── Token generation ─────────────────────────────────────────────────
  async issueTokenPair(client: { id: string; email: string; tier: string }): Promise<TokenPair> {
    const payload = { sub: client.id, email: client.email, tier: client.tier };
    const accessToken = this.jwt.sign(payload, { expiresIn: '15m' });
    const refreshToken = randomBytes(48).toString('hex');
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    await this.db.refreshToken.create({ data: { tokenHash, clientId: client.id, expiresAt } });
    // Register in session authority (fire and forget)
    this.sessionAuthority.registerSession({ clientId: client.id }).catch(() => {});
    // Emit identity event (fire and forget)
    this.eventBus.emit('identity.session_created', { clientId: client.id, email: client.email, provider: 'auth' });
    return { accessToken, refreshToken, expiresIn: 900 };
  }

  // Legacy: single access token (backwards compat)
  async login(client: { id: string; email: string; tier: string }) {
    return this.issueTokenPair(client);
  }

  // ── Refresh token rotation ────────────────────────────────────────────
  async refreshTokens(rawRefreshToken: string): Promise<TokenPair> {
    const tokenHash = createHash('sha256').update(rawRefreshToken).digest('hex');
    const stored = await this.db.refreshToken.findUnique({ where: { tokenHash } });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token invalid or expired');
    }
    // Revoke old token
    await this.db.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    const client = await this.db.client.findUnique({ where: { id: stored.clientId } });
    if (!client) throw new UnauthorizedException('Client not found');
    return this.issueTokenPair(client);
  }

  // ── OAuth ─────────────────────────────────────────────────────────────
  async upsertOAuthClient(profile: OAuthProfile): Promise<{ id: string; email: string; tier: string }> {
    const resolved = await this.identityResolver.resolveOAuth(profile);
    // Emit identity event
    if (resolved.isNew) {
      this.eventBus.emit('identity.created', { clientId: resolved.client.id, email: resolved.client.email });
    } else if (resolved.mergeOccurred) {
      this.eventBus.emit('identity.merge', { clientId: resolved.client.id, email: resolved.client.email });
    }
    return resolved.client;
  }

  // ── Magic link ────────────────────────────────────────────────────────
  async createMagicLink(email: string): Promise<string> {
    // Invalidate old tokens for this email
    await this.db.magicLinkToken.updateMany({
      where: { email, usedAt: null },
      data: { usedAt: new Date() },
    });

    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    await this.db.magicLinkToken.create({ data: { email, tokenHash, expiresAt } });
    return token;
  }

  async verifyMagicLink(token: string): Promise<{ id: string; email: string; tier: string }> {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const record = await this.db.magicLinkToken.findUnique({ where: { tokenHash } });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('Magic link invalid or expired');
    }
    // Mark as used (one-time)
    await this.db.magicLinkToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });
    // Find or create client
    let client = await this.db.client.findUnique({ where: { email: record.email } });
    if (!client) {
      client = await this.db.client.create({
        data: { email: record.email, name: record.email.split('@')[0], tier: 'free', passwordHash: null },
      });
    }
    return client;
  }

  // ── Audit logging ─────────────────────────────────────────────────────
  async audit(params: {
    clientId?: string;
    email?: string;
    action: string;
    provider?: string;
    ip?: string;
    userAgent?: string;
    success?: boolean;
    errorMsg?: string;
  }): Promise<void> {
    try {
      await this.db.authAuditLog.create({
        data: {
          clientId: params.clientId ?? null,
          email: params.email ?? null,
          action: params.action,
          provider: params.provider ?? null,
          ip: params.ip ?? null,
          userAgent: params.userAgent ?? null,
          success: params.success ?? true,
          errorMsg: params.errorMsg ?? null,
        },
      });
      // Emit auth events to event bus
      if (['login', 'oauth_login', 'magic_link_login'].includes(params.action)) {
        this.eventBus.emit('identity.login_success', { clientId: params.clientId, email: params.email, provider: params.provider });
      } else if (params.action === 'risk_flagged') {
        this.eventBus.emit('identity.risk_upgrade', { clientId: params.clientId, email: params.email });
      } else if (params.action === 'revoke_all_sessions') {
        this.eventBus.emit('identity.session_revoked', { clientId: params.clientId });
      }
    } catch { }
  }

  // ── Revoke all sessions ───────────────────────────────────────────────
  async revokeAllTokens(clientId: string): Promise<void> {
    await Promise.all([
      this.db.refreshToken.updateMany({
        where: { clientId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      this.sessionAuthority.revokeAllClientSessions(clientId),
    ]);
    this.eventBus.emit('identity.session_revoked', { clientId });
  }

  // ── Session info ──────────────────────────────────────────────────────
  async getSession(clientId: string): Promise<any> {
    const client = await this.db.client.findUnique({
      where: { id: clientId },
      select: { id: true, email: true, name: true, tier: true, createdAt: true },
    });
    const oauthAccounts = await this.db.oAuthAccount.findMany({
      where: { clientId },
      select: { provider: true, email: true },
    });
    return { ...client, providers: oauthAccounts.map((a: any) => a.provider) };
  }

  // ── Audit query ───────────────────────────────────────────────────────
  async getAuditLogs(limit = 100): Promise<any[]> {
    return this.db.authAuditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  // ── Auth attempt idempotency ──────────────────────────────────────────────────
  async createAttempt(attemptId: string, provider: string): Promise<boolean> {
    try {
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min
      await this.db.authAttempt.create({ data: { attemptId, provider, expiresAt } });
      return true;
    } catch {
      return false; // duplicate — attempt already exists
    }
  }

  async completeAttempt(attemptId: string, clientId: string): Promise<void> {
    try {
      await this.db.authAttempt.update({
        where: { attemptId },
        data: { status: 'completed', clientId, completedAt: new Date() },
      });
    } catch { }
  }

  async isAttemptCompleted(attemptId: string): Promise<boolean> {
    const attempt = await this.db.authAttempt.findUnique({ where: { attemptId } });
    return attempt?.status === 'completed';
  }

  // ── Device session fingerprint ────────────────────────────────────────────────
  async upsertDeviceSession(clientId: string, deviceId: string, ip?: string, userAgent?: string): Promise<void> {
    try {
      await this.db.deviceSession.upsert({
        where: { clientId_deviceId: { clientId, deviceId } },
        update: { lastSeenAt: new Date(), ip: ip ?? null },
        create: { clientId, deviceId, ip: ip ?? null, userAgent: userAgent ?? null },
      });
    } catch { }
  }

  // ── Auth metrics ──────────────────────────────────────────────────────────────
  async getMetrics(): Promise<{
    successRate7d: number;
    successRate30d: number;
    total7d: number;
    total30d: number;
    byProvider: Array<{ provider: string; total: number; failed: number }>;
    recoveryRate7d: number;
    recentEvents: any[];
    authReliabilityScore: number;
  }> {
    const now = new Date();
    const day7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const day30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [total7d, success7d, total30d, success30d, recovery7d, recentEvents, allEvents7d] =
      await Promise.all([
        this.db.authAuditLog.count({ where: { createdAt: { gte: day7 } } }),
        this.db.authAuditLog.count({ where: { createdAt: { gte: day7 }, success: true } }),
        this.db.authAuditLog.count({ where: { createdAt: { gte: day30 } } }),
        this.db.authAuditLog.count({ where: { createdAt: { gte: day30 }, success: true } }),
        this.db.authAuditLog.count({ where: { createdAt: { gte: day7 }, action: 'recovery' } }),
        this.db.authAuditLog.findMany({
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: { action: true, provider: true, success: true, createdAt: true, email: true, errorMsg: true },
        }),
        this.db.authAuditLog.findMany({
          where: { createdAt: { gte: day7 } },
          select: { provider: true, success: true },
        }),
      ]);

    // Aggregate by provider
    const providerMap: Record<string, { total: number; failed: number }> = {};
    for (const e of allEvents7d as Array<{ provider: string | null; success: boolean }>) {
      const p = e.provider ?? 'unknown';
      if (!providerMap[p]) providerMap[p] = { total: 0, failed: 0 };
      providerMap[p].total++;
      if (!e.success) providerMap[p].failed++;
    }
    const byProvider = Object.entries(providerMap).map(([provider, stats]) => ({ provider, ...stats }));

    const successRate7d = total7d > 0 ? Math.round((success7d / total7d) * 1000) / 10 : 100;
    const recoveryRate7d = total7d > 0 ? Math.round((recovery7d / total7d) * 1000) / 10 : 0;

    return {
      successRate7d,
      successRate30d: total30d > 0 ? Math.round((success30d / total30d) * 1000) / 10 : 100,
      total7d,
      total30d,
      byProvider,
      recoveryRate7d,
      recentEvents,
      authReliabilityScore: Math.round(
        (successRate7d * 0.6) +
        (Math.max(0, 100 - recoveryRate7d * 3) * 0.4)
      ),
    };
  }
}
