import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RetentionService } from './retention.service';

@Controller('retention')
@UseGuards(JwtAuthGuard)
export class RetentionController {
  constructor(private readonly retention: RetentionService) {}

  @Get('churn-risks')
  getChurnRisks(@Query('level') level?: string) {
    return this.retention.getChurnRisks(level);
  }

  @Get('forecasts')
  getForecasts(@Query('entityType') entityType?: string) {
    return this.retention.getForecasts(entityType);
  }

  @Post('refresh')
  refreshAllCycles() {
    return this.retention.refreshAllCycles();
  }
}
