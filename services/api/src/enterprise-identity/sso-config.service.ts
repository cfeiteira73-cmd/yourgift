import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * SSOConfigService
 *
 * Manages per-tenant SSO configuration (SAML / OIDC).
 * Each tenant can configure their Identity Provider once — all users
 * in that tenant are then forced through SSO automatically.
 *
 * Supports:
 *  - SAML 2.0 (Okta, Azure AD, PingFederate, ADFS)
 *  - OIDC (Okta, Azure AD, Google Workspace, Auth0)
 *
 * Storage: TenantSSOConfig model in Prisma (soft-delete, tenant-isolated)
 */

export interface SSOConfigInput {
  tenantId: string;
  protocol: 'SAML' | 'OIDC';

  // SAML fields
  samlEntryPoint?: string;        // IdP SSO URL
  samlIssuer?: string;            // SP entityId (us)
  samlIdpIssuer?: string;         // IdP entityId
  samlCert?: string;              // IdP signing certificate (PEM)
  samlCallbackUrl?: string;       // ACS URL (our callback)

  // OIDC fields
  oidcIssuer?: string;            // https://login.microsoftonline.com/{tenant}/v2.0
  oidcClientId?: string;          // Application (client) ID
  oidcClientSecret?: string;      // Client secret
  oidcScopes?: string[];          // openid profile email (default)
  oidcCallbackUrl?: string;       // Our redirect_uri

  // Common
  forceSSO?: boolean;             // Prevent password login for this tenant
  allowedDomains?: string[];      // Email domains that map to this tenant
  provisioningEnabled?: boolean;  // Allow SCIM provisioning for this tenant
}

export interface SSOConfig extends SSOConfigInput {
  id: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class SSOConfigService {
  private readonly logger = new Logger(SSOConfigService.name);

  // In-memory fallback store (used when Prisma model doesn't exist yet)
  // Replace with Prisma once migration adds TenantSSOConfig table
  private readonly store = new Map<string, SSOConfig>();

  constructor(private readonly prisma: PrismaService) {}

  async upsert(input: SSOConfigInput): Promise<SSOConfig> {
    this.logger.log(`SSO config upsert: tenant=${input.tenantId} protocol=${input.protocol}`);

    // Validate required fields per protocol
    if (input.protocol === 'SAML') {
      if (!input.samlEntryPoint || !input.samlCert) {
        throw new ConflictException('SAML requires samlEntryPoint and samlCert');
      }
    }
    if (input.protocol === 'OIDC') {
      if (!input.oidcIssuer || !input.oidcClientId || !input.oidcClientSecret) {
        throw new ConflictException('OIDC requires oidcIssuer, oidcClientId, oidcClientSecret');
      }
    }

    const existing = this.store.get(input.tenantId);
    const config: SSOConfig = {
      id: existing?.id ?? `sso-${Date.now()}`,
      ...input,
      active: true,
      createdAt: existing?.createdAt ?? new Date(),
      updatedAt: new Date(),
    };

    this.store.set(input.tenantId, config);
    return this.redact(config);
  }

  async findByTenant(tenantId: string): Promise<SSOConfig | null> {
    const config = this.store.get(tenantId) ?? null;
    return config ? this.redact(config) : null;
  }

  async findByEmailDomain(email: string): Promise<SSOConfig | null> {
    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain) return null;

    for (const config of this.store.values()) {
      if (!config.active) continue;
      if (config.allowedDomains?.some(d => d.toLowerCase() === domain)) {
        return this.redact(config);
      }
    }
    return null;
  }

  async deactivate(tenantId: string): Promise<void> {
    const config = this.store.get(tenantId);
    if (!config) throw new NotFoundException(`No SSO config for tenant ${tenantId}`);
    config.active = false;
    config.updatedAt = new Date();
    this.logger.warn(`SSO config deactivated: tenant=${tenantId}`);
  }

  /**
   * Returns full config (including secrets) for internal SSO flows.
   * NEVER expose this to the API directly.
   */
  async findFull(tenantId: string): Promise<SSOConfig | null> {
    return this.store.get(tenantId) ?? null;
  }

  async list(): Promise<SSOConfig[]> {
    return Array.from(this.store.values())
      .filter(c => c.active)
      .map(c => this.redact(c));
  }

  /** Redact secrets before returning to API callers */
  private redact(config: SSOConfig): SSOConfig {
    return {
      ...config,
      oidcClientSecret: config.oidcClientSecret ? '***' : undefined,
      samlCert: config.samlCert ? `${config.samlCert.substring(0, 40)}...` : undefined,
    };
  }
}
