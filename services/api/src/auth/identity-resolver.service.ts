import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OAuthProfile } from './auth.service';

export interface ResolvedIdentity {
  client: { id: string; email: string; tier: string; name: string };
  isNew: boolean;
  mergeOccurred: boolean; // true if OAuth linked to existing email account
}

@Injectable()
export class IdentityResolverService {
  private get db(): any { return this.prisma; }

  constructor(private readonly prisma: PrismaService) {}

  async resolveOAuth(profile: OAuthProfile): Promise<ResolvedIdentity> {
    const normalizedEmail = profile.email.toLowerCase().trim();

    // Priority 1: exact OAuth account match
    const existingOAuth = await this.db.oAuthAccount.findUnique({
      where: {
        provider_providerUid: { provider: profile.provider, providerUid: profile.providerUid },
      },
    });

    if (existingOAuth) {
      const client = await this.db.client.findUnique({ where: { id: existingOAuth.clientId } });
      if (client) return { client, isNew: false, mergeOccurred: false };
    }

    // Priority 2: match by normalized email — merge identity
    let client = await this.db.client.findUnique({ where: { email: normalizedEmail } });
    const isNew = !client;

    if (!client) {
      // Priority 3: create new client
      client = await this.db.client.create({
        data: {
          email: normalizedEmail,
          name: profile.displayName ?? normalizedEmail.split('@')[0],
          tier: 'free',
          passwordHash: null,
        },
      });
    }

    // Link OAuth account — idempotent via try/catch on unique constraint
    try {
      await this.db.oAuthAccount.create({
        data: {
          clientId: client.id,
          provider: profile.provider,
          providerUid: profile.providerUid,
          email: normalizedEmail,
          displayName: profile.displayName ?? null,
          avatarUrl: profile.avatarUrl ?? null,
        },
      });
    } catch { /* duplicate constraint — already linked, safe to ignore */ }

    return { client, isNew, mergeOccurred: !isNew };
  }

  async resolveByEmail(email: string): Promise<ResolvedIdentity | null> {
    const normalizedEmail = email.toLowerCase().trim();
    const client = await this.db.client.findUnique({ where: { email: normalizedEmail } });
    if (!client) return null;
    return { client, isNew: false, mergeOccurred: false };
  }
}
