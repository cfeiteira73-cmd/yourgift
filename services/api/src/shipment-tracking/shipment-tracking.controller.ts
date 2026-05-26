import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AdminAuthGuard } from '../admin-auth/admin-auth.guard';
import {
  ShipmentTrackingService,
  ShipmentEventInput,
} from './shipment-tracking.service';

class RecordDeliveryDto {
  carrier?: string;
  trackingNumber?: string;
}

@ApiTags('shipment-tracking')
@ApiBearerAuth()
@UseGuards(AdminAuthGuard)
@Controller('api/v1/admin/shipments')
export class ShipmentTrackingController {
  constructor(
    private readonly shipmentTrackingService: ShipmentTrackingService,
  ) {}

  @ApiOperation({ summary: 'Record a shipment event' })
  @Post('events')
  recordEvent(@Body() body: ShipmentEventInput) {
    return this.shipmentTrackingService.recordEvent(body);
  }

  @ApiOperation({ summary: 'Get all active (in-transit) shipments' })
  @Get('active')
  getActiveShipments() {
    return this.shipmentTrackingService.getActiveShipments();
  }

  @ApiOperation({ summary: 'Get delayed shipments (>7 days in transit)' })
  @Get('delayed')
  getDelayedShipments() {
    return this.shipmentTrackingService.getDelayedShipments();
  }

  @ApiOperation({ summary: 'Get full shipment timeline for an order' })
  @Get(':orderId/timeline')
  getTimeline(@Param('orderId') orderId: string) {
    return this.shipmentTrackingService.getTimeline(orderId);
  }

  @ApiOperation({ summary: 'Mark an order as delivered' })
  @Post(':orderId/deliver')
  recordDelivery(
    @Param('orderId') orderId: string,
    @Body() body: RecordDeliveryDto,
  ) {
    return this.shipmentTrackingService.recordDelivery(
      orderId,
      body.carrier,
      body.trackingNumber,
    );
  }
}
