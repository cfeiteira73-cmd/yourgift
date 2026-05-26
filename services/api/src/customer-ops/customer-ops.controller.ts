import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AdminAuthGuard } from '../admin-auth/admin-auth.guard';
import { CustomerOpsService } from './customer-ops.service';

@ApiTags('customer-ops')
@ApiBearerAuth()
@UseGuards(AdminAuthGuard)
@Controller('api/v1/admin/customer-ops')
export class CustomerOpsController {
  constructor(private readonly service: CustomerOpsService) {}

  /** Full customer event timeline with financial summary */
  @Get('customers/:clientId/timeline')
  async getCustomerTimeline(@Param('clientId') clientId: string) {
    return this.service.getCustomerTimeline(clientId);
  }

  /** Full order forensics — what happened, what's wrong, what to do */
  @Get('orders/:orderId/forensics')
  async getOrderForensics(@Param('orderId') orderId: string) {
    return this.service.getOrderForensics(orderId);
  }
}
