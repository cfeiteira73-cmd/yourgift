import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FinancialService } from './financial.service';

@Controller('financial')
@UseGuards(JwtAuthGuard)
export class FinancialController {
  constructor(private readonly financial: FinancialService) {}

  @Get('metrics')
  getPlatformMetrics() {
    return this.financial.getPlatformMetrics();
  }

  @Get('clients/:companyId/top-ltv')
  getTopClientsByLtv(@Param('companyId') companyId: string) {
    return this.financial.getTopClientsByLtv(companyId);
  }

  @Get('cohort/:companyId')
  getCohortGrid(@Param('companyId') companyId: string) {
    return this.financial.getCohortGrid(companyId);
  }

  @Post('recompute')
  recomputeAll() {
    return this.financial.recomputeAll();
  }

  @Post('client/:clientId/snapshot')
  async computeClientSnapshot(@Param('clientId') clientId: string) {
    await this.financial.computeClientSnapshot(clientId);
    return { ok: true };
  }

  @Post('cohort/:companyId')
  async computeCompanyCohort(@Param('companyId') companyId: string) {
    await this.financial.computeCompanyCohort(companyId);
    return { ok: true };
  }
}
