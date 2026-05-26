import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { AdminAuthGuard } from '../admin-auth/admin-auth.guard';
import {
  StabilityService,
  StabilityHistoryEntry,
  StabilityReport,
} from './stability.service';

@ApiTags('governance')
@ApiBearerAuth()
@UseGuards(AdminAuthGuard)
@Controller('api/v1/admin/governance')
export class StabilityController {
  constructor(private readonly stabilityService: StabilityService) {}

  @Get('report')
  @ApiOperation({
    summary: 'Get 30-day stability report and VALIDATED LIVE status',
  })
  getGovernanceReport(): Promise<StabilityReport> {
    return this.stabilityService.getGovernanceReport();
  }

  @Get('history')
  @ApiOperation({ summary: 'Get daily stability event history for last 30 days' })
  getStabilityHistory(): Promise<StabilityHistoryEntry[]> {
    return this.stabilityService.getStabilityHistory();
  }
}
