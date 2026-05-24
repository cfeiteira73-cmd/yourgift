import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LogisticsService } from './logistics.service';

@Controller('logistics')
@UseGuards(JwtAuthGuard)
export class LogisticsController {
  constructor(private readonly logisticsService: LogisticsService) {}

  @Post('estimate')
  estimate(
    @Body()
    body: {
      originCountry: string;
      destinationCountry: string;
      weightKg: number;
      lengthCm?: number;
      widthCm?: number;
      heightCm?: number;
      referenceId?: string;
      referenceType?: string;
    },
  ) {
    return this.logisticsService.estimateShipping(body);
  }

  @Post('best-option')
  bestOption(
    @Body()
    body: {
      originCountry: string;
      destinationCountry: string;
      weightKg: number;
      maxTransitDays?: number;
      minMarginEur?: number;
      orderValueEur?: number;
    },
  ) {
    return this.logisticsService.getBestOption(body);
  }

  @Get('quotes')
  getQuotes(
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    return this.logisticsService.getRecentQuotes(limit);
  }

  @Get('providers')
  getProviders() {
    return this.logisticsService.getProviders();
  }

  @Get('rate-matrix')
  getRateMatrix() {
    return this.logisticsService.getRateMatrix();
  }

  @Get('carrier-stats')
  getCarrierStats() {
    return this.logisticsService.getCarrierStats();
  }
}
