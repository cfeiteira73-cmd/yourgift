import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RefundsService } from './refunds.service';
import { CreateRefundDto } from './dto/create-refund.dto';

@ApiTags('Refunds')
@ApiBearerAuth()
@Controller('refunds')
export class RefundsController {
  constructor(private readonly refundsService: RefundsService) {}

  // ── POST /refunds ─────────────────────────────────────────────────────────

  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a refund for an order',
    description:
      'Issues a Stripe refund for a paid or delivered order. ' +
      'Posts a ledger reversal (Dr Revenue / Cr AR) and emits refund events. ' +
      'Omit `amount` to issue a full refund.',
  })
  @ApiResponse({ status: 201, description: 'Refund created successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid order status or over-refund attempt.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Order not found.' })
  @ApiResponse({ status: 409, description: 'Duplicate refund detected.' })
  createRefund(@Body() dto: CreateRefundDto) {
    return this.refundsService.createRefund(dto);
  }

  // ── GET /refunds/order/:orderId ───────────────────────────────────────────

  @Get('order/:orderId')
  @ApiOperation({
    summary: 'List all refunds for an order',
    description: 'Returns every refund associated with the given order ID, newest first.',
  })
  @ApiParam({ name: 'orderId', description: 'The order ID' })
  @ApiResponse({ status: 200, description: 'List of refunds.' })
  @ApiResponse({ status: 404, description: 'Order not found.' })
  findByOrder(@Param('orderId') orderId: string) {
    return this.refundsService.findByOrder(orderId);
  }

  // ── GET /refunds/:id ──────────────────────────────────────────────────────

  @Get(':id')
  @ApiOperation({
    summary: 'Get a refund by ID',
  })
  @ApiParam({ name: 'id', description: 'The refund ID' })
  @ApiResponse({ status: 200, description: 'Refund record.' })
  @ApiResponse({ status: 404, description: 'Refund not found.' })
  findById(@Param('id') id: string) {
    return this.refundsService.findById(id);
  }
}
