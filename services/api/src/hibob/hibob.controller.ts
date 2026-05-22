import { Controller, Post, Get, Body, Headers, Logger, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { HiBobService } from './hibob.service';

@Controller('api/v1/hibob')
export class HiBobController {
  private readonly logger = new Logger(HiBobController.name);

  constructor(private readonly hibob: HiBobService) {}

  /** Webhook endpoint — called by HiBob when employees are created/updated */
  @Post('webhook')
  async webhook(
    @Body() body: Record<string, unknown>,
    @Headers('x-hibob-webhook-secret') secret: string,
  ) {
    const eventType = body['event'] as string | undefined;

    this.logger.log(`HiBob webhook received: ${eventType}`);

    if (eventType === 'employee.created' || eventType === 'employee.new') {
      await this.hibob.handleNewEmployee(body);
    } else if (eventType === 'employee.updated') {
      await this.hibob.handleEmployeeUpdate(body);
    }

    return { received: true };
  }

  @Get('sync-history')
  @UseGuards(JwtAuthGuard)
  getSyncHistory() {
    return this.hibob.getSyncHistory();
  }
}
