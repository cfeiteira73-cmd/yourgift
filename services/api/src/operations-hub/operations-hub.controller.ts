import {
  Controller,
  Get,
  Post,
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
import { AdminAuthGuard } from '../admin-auth/admin-auth.guard';
import { OperationsHubService } from './operations-hub.service';

@ApiTags('operations-hub')
@ApiBearerAuth()
@UseGuards(AdminAuthGuard)
@Controller('api/v1/admin/operations-hub')
export class OperationsHubController {
  constructor(private readonly service: OperationsHubService) {}

  // ── GET /api/v1/admin/operations-hub/dashboard ────────────────────────────

  @Get('dashboard')
  @ApiOperation({
    summary: 'Get the operations command-center dashboard',
    description:
      'Returns real-time counts for failed jobs, SLA breaches, delayed shipments, pending refunds, and high-risk orders.',
  })
  @ApiResponse({ status: 200, description: 'Operations dashboard.' })
  getDashboard() {
    return this.service.getDashboard();
  }

  // ── GET /api/v1/admin/operations-hub/pending-actions ─────────────────────

  @Get('pending-actions')
  @ApiOperation({
    summary: 'Get the top 20 items in each pending-action queue',
    description:
      'Returns failed production jobs, L3 escalated tickets, and SLA-breached jobs.',
  })
  @ApiResponse({ status: 200, description: 'Pending actions report.' })
  getPendingActions() {
    return this.service.getPendingActions();
  }

  // ── POST /api/v1/admin/operations-hub/orders/:id/override-status ──────────

  @Post('orders/:id/override-status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manually override an order status with audit log' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Order status updated.' })
  @ApiResponse({ status: 400, description: 'Invalid status.' })
  @ApiResponse({ status: 404, description: 'Order not found.' })
  overrideOrderStatus(
    @Param('id') id: string,
    @Body() body: { newStatus: string; reason: string; adminId: string },
  ) {
    return this.service.manualOverrideOrderStatus(
      id,
      body.newStatus,
      body.reason,
      body.adminId,
    );
  }

  // ── POST /api/v1/admin/operations-hub/orders/:id/cancel ───────────────────

  @Post('orders/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manually cancel an order with audit log' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Order cancelled.' })
  @ApiResponse({ status: 400, description: 'Order already cancelled.' })
  @ApiResponse({ status: 404, description: 'Order not found.' })
  cancelOrder(
    @Param('id') id: string,
    @Body() body: { reason: string; adminId: string },
  ) {
    return this.service.manualCancelOrder(id, body.reason, body.adminId);
  }

  // ── POST /api/v1/admin/operations-hub/jobs/:id/requeue ───────────────────

  @Post('jobs/:id/requeue')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Requeue a failed production job' })
  @ApiParam({ name: 'id', description: 'ProductionJob ID' })
  @ApiResponse({ status: 200, description: 'Job requeued.' })
  @ApiResponse({ status: 400, description: 'Job is not in failed status.' })
  @ApiResponse({ status: 404, description: 'Job not found.' })
  requeueJob(
    @Param('id') id: string,
    @Body() body: { adminId: string; priority?: number },
  ) {
    return this.service.requeueFailedProductionJob(
      id,
      body.adminId,
      body.priority,
    );
  }

  // ── POST /api/v1/admin/operations-hub/jobs/:id/force-complete ─────────────

  @Post('jobs/:id/force-complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Force-complete a production job with admin override notes' })
  @ApiParam({ name: 'id', description: 'ProductionJob ID' })
  @ApiResponse({ status: 200, description: 'Job force-completed.' })
  @ApiResponse({ status: 404, description: 'Job not found.' })
  forceCompleteJob(
    @Param('id') id: string,
    @Body() body: { adminId: string; notes: string },
  ) {
    return this.service.forceCompleteProductionJob(id, body.adminId, body.notes);
  }

  // ── POST /api/v1/admin/operations-hub/shipments/:orderId/retry ───────────

  @Post('shipments/:orderId/retry')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Retry a failed shipment with a new tracking number' })
  @ApiParam({ name: 'orderId', description: 'Order ID' })
  @ApiResponse({ status: 201, description: 'Shipment event created.' })
  @ApiResponse({ status: 400, description: 'Order has not been shipped yet.' })
  @ApiResponse({ status: 404, description: 'Order not found.' })
  retryShipment(
    @Param('orderId') orderId: string,
    @Body()
    body: { newTrackingNumber: string; carrier: string; adminId: string },
  ) {
    return this.service.retryFailedShipment(
      orderId,
      body.newTrackingNumber,
      body.carrier,
      body.adminId,
    );
  }
}
