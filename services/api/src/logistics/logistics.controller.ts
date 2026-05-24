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
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LogisticsService } from './logistics.service';
import { LandedCostService, LandedCostInput, LandedCostBreakdown } from './landed-cost.service';

@ApiTags('Logistics')
@ApiBearerAuth()
@Controller('logistics')
@UseGuards(JwtAuthGuard)
export class LogisticsController {
  constructor(
    private readonly logisticsService: LogisticsService,
    private readonly landedCostService: LandedCostService,
  ) {}

  /**
   * Calculate full landed cost for a procurement line.
   * Returns product + shipping + duties + VAT + handling + insurance breakdown.
   */
  @Post('landed-cost')
  @ApiOperation({ summary: 'Calculate true landed cost (product + shipping + duties + VAT)' })
  calculateLandedCost(@Body() body: LandedCostInput): LandedCostBreakdown {
    return this.landedCostService.calculate(body);
  }

  /**
   * Compare multiple suppliers by landed cost — returns ranked list.
   */
  @Post('landed-cost/compare')
  @ApiOperation({ summary: 'Compare suppliers by total landed cost' })
  compareSuppliers(
    @Body() body: { suppliers: Array<{ id: string; name: string; costInput: LandedCostInput }> },
  ) {
    return this.landedCostService.compareSuppliers(body.suppliers);
  }

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
