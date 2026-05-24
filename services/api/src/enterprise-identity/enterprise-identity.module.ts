import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { SSOConfigService } from './sso-config.service';
import { OIDCService } from './oidc.service';
import { SCIMService } from './scim.service';
import { SCIMController } from './scim.controller';
import { EnterpriseIdentityController } from './enterprise-identity.controller';

/**
 * EnterpriseIdentityModule
 *
 * Enterprise SSO + SCIM provisioning.
 *
 * Capabilities:
 *  - OIDC SSO: Okta, Azure AD, Google Workspace, Auth0 (✅ live)
 *  - SCIM 2.0: Automated user provisioning from any IdP (✅ live)
 *  - SAML 2.0: Okta, Azure AD, ADFS (📋 requires passport-saml install)
 *
 * To complete SAML: pnpm add passport-saml @types/passport-saml --filter api
 *
 * Env vars needed per tenant:
 *  - SCIM_TOKEN_{TENANT_ID}: bearer token for SCIM provisioning endpoint
 *
 * Routes:
 *  POST   /enterprise-identity/sso/:tenantId/config      — configure IdP (admin)
 *  GET    /enterprise-identity/oidc/:tenantId/login       — initiate OIDC
 *  GET    /enterprise-identity/oidc/:tenantId/callback    — OIDC callback
 *  GET    /enterprise-identity/saml/:tenantId/login       — initiate SAML
 *  POST   /enterprise-identity/saml/:tenantId/callback    — SAML ACS
 *  GET    /scim/v2/tenants/:tenantId/Users                — SCIM Users
 *  GET    /scim/v2/tenants/:tenantId/Groups               — SCIM Groups
 */
@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    AuthModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET'),
        signOptions: { expiresIn: '15m' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [EnterpriseIdentityController, SCIMController],
  providers: [SSOConfigService, OIDCService, SCIMService],
  exports: [SSOConfigService, SCIMService],
})
export class EnterpriseIdentityModule {}
