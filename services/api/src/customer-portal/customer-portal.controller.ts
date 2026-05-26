import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CustomerPortalService,
  CreateSupportTicketInput,
  CreateRefundRequestInput,
} from './customer-portal.service';

@ApiTags('customer-portal')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/customer')
export class CustomerPortalController {
  constructor(private readonly customerPortalService: CustomerPortalService) {}

  @ApiOperation({ summary: 'Get authenticated customer orders' })
  @Get('orders')
  getMyOrders(@Req() req: { user: { sub: string } }) {
    return this.customerPortalService.getMyOrders(req.user.sub);
  }

  @ApiOperation({ summary: 'Get full timeline for a specific order' })
  @Get('orders/:id/timeline')
  getOrderTimeline(
    @Req() req: { user: { sub: string } },
    @Param('id') id: string,
  ) {
    return this.customerPortalService.getOrderTimeline(req.user.sub, id);
  }

  @ApiOperation({ summary: 'Get all shipments for the authenticated customer' })
  @Get('shipments')
  getMyShipments(@Req() req: { user: { sub: string } }) {
    return this.customerPortalService.getMyShipments(req.user.sub);
  }

  @ApiOperation({ summary: 'Create a support ticket' })
  @Post('support/tickets')
  createSupportTicket(
    @Req() req: { user: { sub: string } },
    @Body() body: CreateSupportTicketInput,
  ) {
    return this.customerPortalService.createSupportTicket(req.user.sub, body);
  }

  @ApiOperation({ summary: 'Submit a refund request' })
  @Post('refund-request')
  createRefundRequest(
    @Req() req: { user: { sub: string } },
    @Body() body: CreateRefundRequestInput,
  ) {
    return this.customerPortalService.createRefundRequest(req.user.sub, body);
  }
}
