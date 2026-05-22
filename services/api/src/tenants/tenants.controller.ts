import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantsService, TenantPlan, TenantRole } from './tenants.service';

@Controller('api/v1/tenants')
@UseGuards(JwtAuthGuard)
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  @Get()
  list(@Query('all') all?: string) {
    return this.tenants.listTenants(all === 'true');
  }

  @Get('platform-stats')
  platformStats() { return this.tenants.getPlatformStats(); }

  @Post()
  create(@Body() body: { slug: string; name: string; plan?: TenantPlan; maxUsers?: number; maxOrdersPerMonth?: number; ownerId: string }) {
    return this.tenants.createTenant(body);
  }

  @Get(':id')
  get(@Param('id') id: string) { return this.tenants.getTenant(id); }

  @Get(':id/stats')
  stats(@Param('id') id: string) { return this.tenants.getTenantStats(id); }

  @Get(':id/members')
  members(@Param('id') id: string) { return this.tenants.getMembers(id); }

  @Post(':id/members')
  addMember(@Param('id') id: string, @Body() body: { userId: string; role?: TenantRole; invitedBy?: string }) {
    return this.tenants.addMember(id, body.userId, body.role, body.invitedBy);
  }

  @Delete(':id/members/:userId')
  removeMember(@Param('id') id: string, @Param('userId') userId: string) {
    return this.tenants.removeMember(id, userId);
  }

  @Patch(':id/plan')
  updatePlan(@Param('id') id: string, @Body() body: { plan: TenantPlan; maxUsers?: number; maxOrdersPerMonth?: number }) {
    return this.tenants.updatePlan(id, body.plan, body.maxUsers, body.maxOrdersPerMonth);
  }
}
