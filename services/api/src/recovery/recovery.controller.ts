import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AdminGuard } from '../auth/guards/admin.guard';
import { RecoveryService, RetryStats } from './recovery.service';

@ApiTags('recovery')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('recovery')
export class RecoveryController {
  constructor(private readonly recoveryService: RecoveryService) {}

  @Get('circuit-breakers')
  async getAll(): Promise<unknown[]> {
    return this.recoveryService.getCircuitBreakers();
  }

  @Post('circuit-breakers/:service/reset')
  async reset(@Param('service') service: string): Promise<unknown> {
    return this.recoveryService.resetCircuitBreaker(service);
  }

  @Post('circuit-breakers/:service/test')
  async test(
    @Param('service') service: string,
  ): Promise<{ service: string; healthy: boolean; latencyMs: number }> {
    const result = await this.recoveryService.testServiceHealth(service);
    return { service, ...result };
  }

  @Get('retry-stats')
  async retryStats(
    @Query('service') service?: string,
    @Query('hours', new DefaultValuePipe(24), ParseIntPipe) hours = 24,
  ): Promise<RetryStats[]> {
    return this.recoveryService.getRetryStats(service, hours);
  }

  @Get('degraded')
  async degraded(): Promise<unknown[]> {
    return this.recoveryService.getDegradedServices();
  }
}
