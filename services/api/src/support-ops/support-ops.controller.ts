import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { AdminAuthGuard } from '../admin-auth/admin-auth.guard';
import {
  CustomerSupportView,
  OrderSupportView,
  RefundInvestigationResult,
  SupportOperationsService,
} from './support-ops.service';

class RefundInvestigationDto {
  orderId: string;
  requestedAmountEur: number;
}

@ApiTags('support-ops')
@ApiBearerAuth()
@UseGuards(AdminAuthGuard)
@Controller('api/v1/admin/support')
export class SupportOpsController {
  constructor(private readonly service: SupportOperationsService) {}

  @Get('customer/:id')
  @ApiOperation({ summary: 'Full support view for a customer — financials, churn risk, orders, refunds, events' })
  @ApiParam({ name: 'id', description: 'Client ID' })
  async getCustomerSupportView(
    @Param('id') id: string,
  ): Promise<CustomerSupportView> {
    return this.service.getCustomerSupportView(id);
  }

  @Get('order/:id')
  @ApiOperation({ summary: 'Full support view for an order — Stripe cross-check, ledger audit, issue detection' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  async getOrderSupportView(
    @Param('id') id: string,
  ): Promise<OrderSupportView> {
    return this.service.getOrderSupportView(id);
  }

  @Post('refund-investigation')
  @ApiOperation({ summary: 'Investigate whether a refund can proceed — eligibility, blockers, recommendation' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['orderId', 'requestedAmountEur'],
      properties: {
        orderId: { type: 'string' },
        requestedAmountEur: { type: 'number', minimum: 0.01 },
      },
    },
  })
  async investigateRefund(
    @Body() body: RefundInvestigationDto,
  ): Promise<RefundInvestigationResult> {
    return this.service.investigateRefund(body.orderId, body.requestedAmountEur);
  }
}
