import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { UnifiedRiskService } from './unified-risk.service';

@Controller('risk')
@UseGuards(JwtAuthGuard)
export class RiskController {
  constructor(private readonly unifiedRisk: UnifiedRiskService) {}

  @Get('evaluate')
  evaluate(
    @Query('userId') userId: string,
    @Query('ip') ip?: string,
    @Query('deviceId') deviceId?: string,
    @Query('action') action?: string,
  ) {
    return this.unifiedRisk.evaluate(userId, { ip, deviceId, action });
  }
}
