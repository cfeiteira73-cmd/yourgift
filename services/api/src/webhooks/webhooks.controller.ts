import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WebhooksService, CreateEndpointDto } from './webhooks.service';

@UseGuards(JwtAuthGuard)
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  // GET /api/v1/webhooks/events — list available event types (before :id routes)
  @Get('events')
  getAvailableEvents() {
    return { events: WebhooksService.AVAILABLE_EVENTS };
  }

  // GET /api/v1/webhooks?companyId=...
  @Get()
  listEndpoints(@Query('companyId') companyId?: string) {
    return this.webhooks.listEndpoints(companyId);
  }

  // POST /api/v1/webhooks
  @Post()
  createEndpoint(@Body() dto: CreateEndpointDto) {
    return this.webhooks.createEndpoint(dto);
  }

  // DELETE /api/v1/webhooks/:id
  @Delete(':id')
  async deleteEndpoint(@Param('id') id: string) {
    const existing = await this.webhooks.getEndpoint(id);
    if (!existing) throw new NotFoundException('Webhook endpoint not found');
    return this.webhooks.deleteEndpoint(id);
  }

  // PATCH /api/v1/webhooks/:id/toggle
  @Patch(':id/toggle')
  async toggleEndpoint(
    @Param('id') id: string,
    @Body('isActive') isActive: boolean,
  ) {
    const existing = await this.webhooks.getEndpoint(id);
    if (!existing) throw new NotFoundException('Webhook endpoint not found');
    return this.webhooks.toggleEndpoint(id, isActive);
  }

  // GET /api/v1/webhooks/:id/deliveries
  @Get(':id/deliveries')
  async getDeliveries(@Param('id') id: string) {
    const existing = await this.webhooks.getEndpoint(id);
    if (!existing) throw new NotFoundException('Webhook endpoint not found');
    return this.webhooks.getDeliveries(id);
  }
}
