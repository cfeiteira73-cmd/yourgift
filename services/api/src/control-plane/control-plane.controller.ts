import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from '../admin-auth/admin-auth.guard';
import { ControlPlaneService } from './control-plane.service';
import type {
  ControlPlaneSummary,
  SystemHealthGraph,
  FinancialImpact,
  TenantImpact,
} from './control-plane.service';

@Controller('admin/control-plane')
@UseGuards(AdminAuthGuard)
export class ControlPlaneController {
  constructor(private readonly controlPlane: ControlPlaneService) {}

  @Get('summary')
  async getSummary(): Promise<ControlPlaneSummary> {
    return this.controlPlane.getControlPlaneSummary();
  }

  @Get('health-graph')
  async getHealthGraph(): Promise<SystemHealthGraph> {
    return this.controlPlane.buildSystemHealthGraph();
  }

  @Get('financial-impact')
  async getFinancialImpact(): Promise<FinancialImpact> {
    return this.controlPlane.getFinancialImpact();
  }

  @Get('tenant-impacts')
  async getTenantImpacts(
    @Query('limit') limit?: string,
  ): Promise<TenantImpact[]> {
    const parsedLimit = limit !== undefined ? parseInt(limit, 10) : undefined;
    return this.controlPlane.getTenantImpacts(
      parsedLimit !== undefined && !isNaN(parsedLimit) ? parsedLimit : 10,
    );
  }

  @Get('topology')
  async getTopology(): Promise<{
    nodes: Array<{ id: string; label: string; status: string }>;
    edges: Array<{ source: string; target: string; type: string; healthy: boolean }>;
  }> {
    return this.controlPlane.getDependencyTopologyGraph();
  }
}
