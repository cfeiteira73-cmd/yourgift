import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Headers,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { SCIMService } from './scim.service';
import { SSOConfigService } from './sso-config.service';

/**
 * SCIMController
 *
 * SCIM 2.0 endpoints for automated user/group provisioning.
 * Authentication: Bearer token per tenant (validated against SSOConfig.scimBearerToken
 * or SCIM_TOKEN_{TENANT_ID} env var).
 *
 * Compatible with:
 *  - Okta SCIM provisioning app
 *  - Azure AD Enterprise App (SCIM)
 *  - Google Workspace (with SCIM bridge)
 *  - Any IdP supporting SCIM 2.0 RFC 7644
 *
 * All endpoints return Content-Type: application/scim+json
 */

const SCIM_CONTENT_TYPE = 'application/scim+json';
const SCIM_SCHEMAS = {
  USER: 'urn:ietf:params:scim:schemas:core:2.0:User',
  GROUP: 'urn:ietf:params:scim:schemas:core:2.0:Group',
};

@Controller('scim/v2')
export class SCIMController {
  constructor(
    private readonly scim: SCIMService,
    private readonly ssoConfig: SSOConfigService,
    private readonly config: ConfigService,
  ) {}

  // ── Authentication ────────────────────────────────────────────────────────

  private async validateSCIMToken(authorization: string | undefined, tenantId: string): Promise<void> {
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('SCIM Bearer token required');
    }
    const token = authorization.substring(7);

    // Check env var first: SCIM_TOKEN_{TENANT_ID_UPPERCASED}
    const envToken = this.config.get<string>(`SCIM_TOKEN_${tenantId.toUpperCase().replace(/-/g, '_')}`);
    if (envToken && token === envToken) return;

    // Fall back to stored token (coming from SSOConfig)
    const ssoConf = await this.ssoConfig.findFull(tenantId);
    if (ssoConf && (ssoConf as unknown as { scimBearerToken?: string }).scimBearerToken === token) return;

    throw new UnauthorizedException('Invalid SCIM Bearer token');
  }

  // ── ServiceProviderConfig (Okta discovery) ────────────────────────────────

  @Get('ServiceProviderConfig')
  serviceProviderConfig(@Res() res: Response) {
    res.set('Content-Type', SCIM_CONTENT_TYPE).json({
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig'],
      documentationUri: 'https://docs.yourgift.pt/enterprise/scim',
      patch: { supported: true },
      bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
      filter: { supported: true, maxResults: 200 },
      changePassword: { supported: false },
      sort: { supported: false },
      etag: { supported: false },
      authenticationSchemes: [
        {
          type: 'oauthbearertoken',
          name: 'OAuth Bearer Token',
          description: 'Authentication scheme using the OAuth Bearer Token standard',
          specUri: 'http://www.rfc-editor.org/info/rfc6750',
          primary: true,
        },
      ],
      meta: {
        resourceType: 'ServiceProviderConfig',
        location: '/scim/v2/ServiceProviderConfig',
      },
    });
  }

  // ── Users ─────────────────────────────────────────────────────────────────

  @Get('tenants/:tenantId/Users')
  async listUsers(
    @Param('tenantId') tenantId: string,
    @Headers('authorization') auth: string,
    @Query('startIndex') startIndex?: string,
    @Query('count') count?: string,
    @Query('filter') filter?: string,
    @Res() res?: Response,
  ) {
    await this.validateSCIMToken(auth, tenantId);
    const result = await this.scim.listUsers(tenantId, {
      startIndex: startIndex ? parseInt(startIndex, 10) : 1,
      count: count ? parseInt(count, 10) : 100,
      filter,
    });
    res?.set('Content-Type', SCIM_CONTENT_TYPE).json(result);
  }

  @Get('tenants/:tenantId/Users/:id')
  async getUser(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Headers('authorization') auth: string,
    @Res() res?: Response,
  ) {
    await this.validateSCIMToken(auth, tenantId);
    const user = await this.scim.getUser(tenantId, id);
    res?.set('Content-Type', SCIM_CONTENT_TYPE).json({
      schemas: [SCIM_SCHEMAS.USER],
      ...user,
    });
  }

  @Post('tenants/:tenantId/Users')
  @HttpCode(HttpStatus.CREATED)
  async createUser(
    @Param('tenantId') tenantId: string,
    @Headers('authorization') auth: string,
    @Body() body: Record<string, unknown>,
    @Res() res?: Response,
  ) {
    await this.validateSCIMToken(auth, tenantId);

    const user = await this.scim.createUser(tenantId, {
      userName: body['userName'] as string,
      externalId: body['externalId'] as string | undefined,
      emails: (body['emails'] as Array<{ value: string; type: string; primary: boolean }>) ?? [],
      name: (body['name'] as { givenName?: string; familyName?: string; formatted?: string }) ?? {},
      displayName: body['displayName'] as string | undefined,
      title: body['title'] as string | undefined,
      department: (body['urn:ietf:params:scim:schemas:extension:enterprise:2.0:User'] as Record<string, string> | undefined)?.['department'],
      active: body['active'] !== false,
    });

    res?.set('Content-Type', SCIM_CONTENT_TYPE).status(201).json({
      schemas: [SCIM_SCHEMAS.USER],
      ...user,
    });
  }

  @Put('tenants/:tenantId/Users/:id')
  async replaceUser(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Headers('authorization') auth: string,
    @Body() body: Record<string, unknown>,
    @Res() res?: Response,
  ) {
    await this.validateSCIMToken(auth, tenantId);
    const user = await this.scim.replaceUser(tenantId, id, {
      userName: body['userName'] as string,
      emails: (body['emails'] as Array<{ value: string; type: string; primary: boolean }>) ?? [],
      name: (body['name'] as { givenName?: string; familyName?: string }) ?? {},
      displayName: body['displayName'] as string | undefined,
      active: body['active'] !== false,
    });
    res?.set('Content-Type', SCIM_CONTENT_TYPE).json({ schemas: [SCIM_SCHEMAS.USER], ...user });
  }

  @Patch('tenants/:tenantId/Users/:id')
  async patchUser(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Headers('authorization') auth: string,
    @Body() body: { Operations: Array<{ op: string; path?: string; value: unknown }> },
    @Res() res?: Response,
  ) {
    await this.validateSCIMToken(auth, tenantId);
    const user = await this.scim.patchUser(tenantId, id, body.Operations ?? []);
    res?.set('Content-Type', SCIM_CONTENT_TYPE).json({ schemas: [SCIM_SCHEMAS.USER], ...user });
  }

  @Delete('tenants/:tenantId/Users/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteUser(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Headers('authorization') auth: string,
  ) {
    await this.validateSCIMToken(auth, tenantId);
    await this.scim.deleteUser(tenantId, id);
  }

  // ── Groups ────────────────────────────────────────────────────────────────

  @Get('tenants/:tenantId/Groups')
  async listGroups(
    @Param('tenantId') tenantId: string,
    @Headers('authorization') auth: string,
    @Query('startIndex') startIndex?: string,
    @Query('count') count?: string,
    @Res() res?: Response,
  ) {
    await this.validateSCIMToken(auth, tenantId);
    const result = await this.scim.listGroups(tenantId, {
      startIndex: startIndex ? parseInt(startIndex, 10) : 1,
      count: count ? parseInt(count, 10) : 100,
    });
    res?.set('Content-Type', SCIM_CONTENT_TYPE).json(result);
  }

  @Get('tenants/:tenantId/Groups/:id')
  async getGroup(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Headers('authorization') auth: string,
    @Res() res?: Response,
  ) {
    await this.validateSCIMToken(auth, tenantId);
    const group = await this.scim.getGroup(tenantId, id);
    res?.set('Content-Type', SCIM_CONTENT_TYPE).json({ schemas: [SCIM_SCHEMAS.GROUP], ...group });
  }

  @Post('tenants/:tenantId/Groups')
  @HttpCode(HttpStatus.CREATED)
  async createGroup(
    @Param('tenantId') tenantId: string,
    @Headers('authorization') auth: string,
    @Body() body: { displayName: string; members?: Array<{ value: string; display?: string }>; externalId?: string },
    @Res() res?: Response,
  ) {
    await this.validateSCIMToken(auth, tenantId);
    const group = await this.scim.createGroup(tenantId, body);
    res?.set('Content-Type', SCIM_CONTENT_TYPE).status(201).json({ schemas: [SCIM_SCHEMAS.GROUP], ...group });
  }

  @Patch('tenants/:tenantId/Groups/:id')
  async patchGroup(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Headers('authorization') auth: string,
    @Body() body: { Operations: Array<{ op: string; path?: string; value: unknown }> },
    @Res() res?: Response,
  ) {
    await this.validateSCIMToken(auth, tenantId);
    const group = await this.scim.patchGroup(tenantId, id, body.Operations ?? []);
    res?.set('Content-Type', SCIM_CONTENT_TYPE).json({ schemas: [SCIM_SCHEMAS.GROUP], ...group });
  }

  @Delete('tenants/:tenantId/Groups/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteGroup(
    @Param('tenantId') tenantId: string,
    @Param('id') id: string,
    @Headers('authorization') auth: string,
  ) {
    await this.validateSCIMToken(auth, tenantId);
    const group = await this.scim.getGroup(tenantId, id);
    // Soft delete: remove members
    await this.scim.patchGroup(tenantId, id, [{ op: 'remove', path: 'members', value: group.members }]);
  }
}
