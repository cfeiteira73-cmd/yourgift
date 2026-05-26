import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { AdminAuthGuard } from '../admin-auth/admin-auth.guard';
import {
  GeneratedReport,
  ReportDescriptor,
  ReportGeneratorService,
  ReportType,
} from './report-generator.service';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(AdminAuthGuard)
@Controller('api/v1/admin/reports')
export class ReportGeneratorController {
  constructor(private readonly reportGeneratorService: ReportGeneratorService) {}

  @Get()
  @ApiOperation({
    summary: 'List all available report types',
    description:
      'Returns a static list of all 8 available report types with their descriptions. No DB queries are made.',
  })
  listAvailableReports(): ReportDescriptor[] {
    return this.reportGeneratorService.listAvailableReports();
  }

  @Get(':type')
  @ApiOperation({
    summary: 'Generate a report by type',
    description:
      'Queries live production data and returns a structured report as markdown. Reports are never written to disk.',
  })
  @ApiParam({
    name: 'type',
    description:
      'Report type. One of: live_money, operations, financial_truth, customer_reality, business_reality, error_budget, replay_recovery, maturity',
    example: 'live_money',
    enum: [
      'live_money',
      'operations',
      'financial_truth',
      'customer_reality',
      'business_reality',
      'error_budget',
      'replay_recovery',
      'maturity',
    ],
  })
  async generateReport(@Param('type') type: string): Promise<GeneratedReport> {
    return this.reportGeneratorService.generateReport(type as ReportType);
  }
}
