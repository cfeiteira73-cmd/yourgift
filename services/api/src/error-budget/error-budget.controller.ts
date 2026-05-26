import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AdminAuthGuard } from '../admin-auth/admin-auth.guard';
import { ErrorBudgetService } from './error-budget.service';

@ApiTags('error-budget')
@ApiBearerAuth()
@UseGuards(AdminAuthGuard)
@Controller('api/v1/admin/error-budget')
export class ErrorBudgetController {
  constructor(private readonly service: ErrorBudgetService) {}

  /** Full SLO error budget report with burn rates and exhaustion ETAs */
  @Get()
  async getReport() {
    return this.service.getReport();
  }

  /** Simple boolean — should this deploy be blocked? */
  @Get('should-block-deploy')
  async shouldBlockDeploy() {
    const block = await this.service.shouldBlockDeploy();
    return { shouldBlock: block, checkedAt: new Date().toISOString() };
  }
}
