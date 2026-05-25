import {
  Controller,
  Get,
  Post,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AdminGuard } from '../auth/guards/admin.guard';
import { ReliabilityService, ReliabilityTrendPoint } from './reliability.service';

@ApiTags('reliability')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('reliability')
export class ReliabilityController {
  constructor(private readonly reliabilityService: ReliabilityService) {}

  @Get('latest')
  async latest(): Promise<unknown> {
    return this.reliabilityService.getLatest();
  }

  @Get('history')
  async history(
    @Query('limit', new DefaultValuePipe(48), ParseIntPipe) limit = 48,
  ): Promise<unknown[]> {
    return this.reliabilityService.getHistory(limit);
  }

  @Get('trend')
  async trend(
    @Query('hours', new DefaultValuePipe(24), ParseIntPipe) hours = 24,
  ): Promise<ReliabilityTrendPoint[]> {
    return this.reliabilityService.computeTrend(hours);
  }

  @Post('compute')
  async compute(): Promise<unknown> {
    return this.reliabilityService.computeSnapshot();
  }
}
