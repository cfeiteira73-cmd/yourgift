import { Controller, Get, Post, Param, Body, Query } from '@nestjs/common';
import { CashFlowService } from './cash-flow.service';

interface RecordInvoiceBody {
  tenantId?: string;
  orderId?: string;
  supplierName?: string;
  invoiceRef: string;
  invoiceDate: string;
  dueDate: string;
  amountEur: number;
  category?: string;
  notes?: string;
}

interface MarkPaidBody {
  paidAmountEur?: number;
}

@Controller('cash-flow')
export class CashFlowController {
  constructor(private readonly cashFlowService: CashFlowService) {}

  @Get('working-capital')
  async getWorkingCapital(@Query('tenantId') tenantId?: string) {
    return this.cashFlowService.getWorkingCapitalSummary(tenantId);
  }

  @Get('invoices')
  async getInvoices(
    @Query('tenantId') tenantId?: string,
    @Query('status') status?: string,
  ) {
    return this.cashFlowService.getInvoices(tenantId, status);
  }

  @Post('invoices')
  async recordInvoice(@Body() body: RecordInvoiceBody) {
    return this.cashFlowService.recordInvoice({
      ...body,
      invoiceDate: new Date(body.invoiceDate),
      dueDate: new Date(body.dueDate),
    });
  }

  @Post('invoices/:id/pay')
  async markPaid(@Param('id') id: string, @Body() body: MarkPaidBody) {
    return this.cashFlowService.markPaid(id, body.paidAmountEur);
  }
}
