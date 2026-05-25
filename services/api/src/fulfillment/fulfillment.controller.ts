import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FulfillmentService } from './fulfillment.service';
import { CreateFulfillmentDto } from './dto/create-fulfillment.dto';

@ApiTags('fulfillment')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('fulfillment')
export class FulfillmentController {
  constructor(private readonly fulfillment: FulfillmentService) {}

  @Post()
  @ApiOperation({ summary: 'Initiate fulfillment for a paid/approved order' })
  create(@Body() dto: CreateFulfillmentDto) {
    return this.fulfillment.createFulfillment(dto);
  }

  @Patch(':orderId/ship')
  @ApiOperation({ summary: 'Mark order as shipped with tracking details' })
  @ApiQuery({ name: 'trackingNumber', required: true })
  @ApiQuery({ name: 'carrier', required: true })
  ship(
    @Param('orderId') orderId: string,
    @Query('trackingNumber') trackingNumber: string,
    @Query('carrier') carrier: string,
  ) {
    return this.fulfillment.markShipped(orderId, trackingNumber, carrier);
  }

  @Patch(':orderId/deliver')
  @ApiOperation({ summary: 'Mark order as delivered' })
  deliver(@Param('orderId') orderId: string) {
    return this.fulfillment.markDelivered(orderId);
  }

  @Get(':orderId/status')
  @ApiOperation({ summary: 'Get fulfillment status for an order' })
  status(@Param('orderId') orderId: string) {
    return this.fulfillment.getFulfillmentStatus(orderId);
  }
}
