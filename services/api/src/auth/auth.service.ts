import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';

export interface OAuthProfile {
  provider: 'google' | 'apple';
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
    // Find existing OAuth account
    const existing = await this.db.oAuthAccount.findUnique({
      where: { provider_providerUid: { provider: profile.provider, providerUid: profile.providerUid } },
    });

    if (existing) {
      const client = await this.db.client.findUnique({ where: { id: existing.clientId } });
      if (!client) throw new UnauthorizedException('Account not found');
      return client;
    }

    // Find by email or create new client
    let client = await this.db.client.findUnique({ where: { email: profile.email } });
    if (!client) {
      client = await this.db.client.create({
        data: {
          email: profile.email,
          name: profile.displayName ?? profile.email.split('@')[0],
          tier: 'free',
          passwordHash: null,
        },
      });
    }

    // Link OAuth account
    await this.db.oAuthAccount.create({
      data: {
        clientId: client.id,
        provider: profile.provider,
        providerUid: profile.providerUid,
        email: profile.email,
        displayName: profile.displayName ?? null,
        avatarUrl: profile.avatarUrl ?? null,
      },
    });

    return client;
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
    } catch { }
  }

  // ── Revoke all sessions ───────────────────────────────────────────────
  async revokeAllTokens(clientId: string): Promise<void> {
    await this.db.refreshToken.updateMany({
      where: { clientId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
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
}
