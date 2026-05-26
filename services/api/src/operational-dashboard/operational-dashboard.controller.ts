import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AdminAuthGuard } from '../admin-auth/admin-auth.guard';
import { OperationalDashboardService } from './operational-dashboard.service';

@ApiTags('operational-dashboard')
@ApiBearerAuth()
@UseGuards(AdminAuthGuard)
@Controller('api/v1/admin/dashboard')
export class OperationalDashboardController {
  constructor(private readonly service: OperationalDashboardService) {}

  /** Full operational truth snapshot — all real-time metrics in one call */
  @Get()
  async getOperationalTruth() {
    return this.service.getOperationalTruth();
  }
}
