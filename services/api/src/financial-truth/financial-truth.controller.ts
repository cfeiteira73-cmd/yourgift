import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminAuthGuard } from '../admin-auth/admin-auth.guard';
import { FinancialTruthService } from './financial-truth.service';

class ReconcileBodyDto {
  orderId?: string;
}

@ApiTags('financial-truth')
@ApiBearerAuth()
@UseGuards(AdminAuthGuard)
@Controller('api/v1/admin/financial-truth')
export class FinancialTruthController {
  constructor(private readonly financialTruthService: FinancialTruthService) {}

  @Get('report')
  @ApiOperation({ summary: 'Run cross-system financial truth validations and return a full report' })
  getReport() {
    return this.financialTruthService.getReport();
  }

  @Post('reconcile')
  @ApiOperation({ summary: 'Reconcile a single order or the last 100 paid orders if no orderId is provided' })
  @ApiBody({ type: ReconcileBodyDto, required: false })
  reconcile(@Body() body: ReconcileBodyDto) {
    return this.financialTruthService.reconcile(body?.orderId);
  }
}
