import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProjectionsService } from './projections.service';

@Controller('projections')
@UseGuards(JwtAuthGuard)
export class ProjectionsController {
  constructor(private readonly projections: ProjectionsService) {}

  @Get('orders')
  queryOrders(
    @Query('status') status?: string,
    @Query('clientId') clientId?: string,
    @Query('companyId') companyId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.projections.queryOrderProjections({
      status,
      clientId,
      companyId,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Post('rebuild/orders')
  rebuildOrders() {
    return this.projections.rebuildOrderProjections();
  }

  @Get('health')
  getHealth() {
    return this.projections.getHealth();
  }

  @Get('rebuild-logs')
  getRebuildLogs() {
    return this.projections.getRebuildLogs();
  }
}
