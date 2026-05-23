import { Controller, Get, Post, Body, Param, Delete, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { IdentityGraphService } from './identity-graph.service';

@ApiTags('identity-graph')
@UseGuards(JwtAuthGuard)
@Controller('identity')
export class IdentityGraphController {
  constructor(private readonly graph: IdentityGraphService) {}

  // ── Organizations ──────────────────────────────────────────────────────
  @Post('organizations')
  @ApiOperation({ summary: 'Create organization' })
  async createOrg(@Body() body: { name: string; domain?: string; plan?: string }) {
    return this.graph.createOrganization(body.name, body.domain, body.plan);
  }

  @Get('organizations')
  @ApiOperation({ summary: 'Get my organizations' })
  async myOrgs(@Request() req: any) {
    return this.graph.getUserOrgs(req.user.sub);
  }

  @Get('organizations/:id/members')
  @ApiOperation({ summary: 'Get org members' })
  async orgMembers(@Param('id') id: string) {
    return this.graph.getOrgMembers(id);
  }

  @Post('organizations/:id/members')
  @ApiOperation({ summary: 'Add user to organization' })
  async addMember(@Param('id') id: string, @Body() body: { clientId: string; role?: string }) {
    return this.graph.addUserToOrg(body.clientId, id, body.role);
  }

  // ── Departments ────────────────────────────────────────────────────────
  @Post('organizations/:id/departments')
  @ApiOperation({ summary: 'Create department' })
  async createDepartment(@Param('id') id: string, @Body() body: { name: string; code?: string; parentId?: string; budgetLimitEur?: number }) {
    return this.graph.createDepartment({ organizationId: id, ...body });
  }

  @Get('organizations/:id/departments')
  @ApiOperation({ summary: 'List departments' })
  async departments(@Param('id') id: string) {
    return this.graph.getDepartments(id);
  }

  @Post('departments/:id/members')
  @ApiOperation({ summary: 'Add user to department' })
  async addDeptMember(@Param('id') id: string, @Body() body: { clientId: string; role?: string }) {
    await this.graph.addUserToDepartment(body.clientId, id, body.role);
    return { ok: true };
  }

  // ── Delegations ────────────────────────────────────────────────────────
  @Post('delegations')
  @ApiOperation({ summary: 'Create delegation' })
  async createDelegation(@Request() req: any, @Body() body: { delegateeId: string; scope: string; organizationId?: string; budgetLimitEur?: number; expiresAt?: string }) {
    return this.graph.createDelegation({
      delegatorId: req.user.sub,
      delegateeId: body.delegateeId,
      scope: body.scope,
      organizationId: body.organizationId,
      budgetLimitEur: body.budgetLimitEur,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
    });
  }

  @Get('delegations')
  @ApiOperation({ summary: 'Get my active delegations' })
  async myDelegations(@Request() req: any) {
    return this.graph.getActiveDelegations(req.user.sub);
  }

  @Delete('delegations/:id')
  @ApiOperation({ summary: 'Revoke delegation' })
  async revokeDelegation(@Param('id') id: string) {
    await this.graph.revokeDelegation(id);
    return { ok: true };
  }

  // ── Approval Chains ────────────────────────────────────────────────────
  @Post('organizations/:id/approval-chains')
  @ApiOperation({ summary: 'Create approval chain' })
  async createChain(@Param('id') id: string, @Body() body: { name: string; triggerType: string; thresholdEur?: number; category?: string; steps: any[] }) {
    return this.graph.createApprovalChain({ organizationId: id, ...body });
  }

  @Get('organizations/:id/approval-chains')
  @ApiOperation({ summary: 'List approval chains' })
  async chains(@Param('id') id: string) {
    return this.graph.getApprovalChains(id);
  }

  @Post('organizations/:id/approval-chains/resolve')
  @ApiOperation({ summary: 'Resolve which approval chain applies' })
  async resolveChain(@Param('id') id: string, @Body() body: { triggerType: string; amountEur?: number; category?: string }) {
    return this.graph.resolveApprovalChain(id, body.triggerType, body.amountEur, body.category);
  }

  // ── Permissions ────────────────────────────────────────────────────────
  @Get('permissions')
  @ApiOperation({ summary: 'All available permissions' })
  async allPermissions() {
    return this.graph.getAllPermissions();
  }

  @Get('permissions/me')
  @ApiOperation({ summary: 'My resolved permissions' })
  async myPermissions(@Request() req: any) {
    return this.graph.resolvePermissions(req.user.sub);
  }

  @Get('permissions/me/check/:code')
  @ApiOperation({ summary: 'Check if I have a specific permission (with delegations)' })
  async checkPermission(@Request() req: any, @Param('code') code: string) {
    const allowed = await this.graph.hasPermissionWithDelegation(req.user.sub, code);
    return { allowed, permissionCode: code };
  }
}
