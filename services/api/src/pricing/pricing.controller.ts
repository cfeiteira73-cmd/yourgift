import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PricingService, PriceCalculationInput } from './pricing.service';
import { CalculatePriceDto } from './dto/calculate-price.dto';

@ApiTags('pricing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('pricing')
export class PricingController {
  constructor(private readonly pricing: PricingService) {}

  // ── Legacy endpoint (kept for backwards compatibility) ─────────────────────

  @Post('calculate')
  @HttpCode(HttpStatus.OK)
  calculate(@Body() dto: CalculatePriceDto) {
    return this.pricing.calculate(dto);
  }

  // ── Pricing rules CRUD ─────────────────────────────────────────────────────

  @Get('rules')
  getRules() {
    return this.pricing.getRules();
  }

  @Post('rules')
  createRule(
    @Body()
    body: {
      name: string;
      ruleType: string;
      targetId?: string;
      minQuantity?: number;
      maxQuantity?: number;
      discountType: string;
      discountValue: number;
      marginMin?: number;
      clientTier?: string;
      priority?: number;
    },
  ) {
    return this.pricing.createRule(body);
  }

  @Patch('rules/:id')
  updateRule(
    @Param('id') id: string,
    @Body()
    body: Partial<{
      name: string;
      discountValue: number;
      isActive: boolean;
      priority: number;
      discountType: string;
      marginMin: number;
      clientTier: string;
      minQuantity: number;
      maxQuantity: number;
      targetId: string;
    }>,
  ) {
    return this.pricing.updateRule(id, body);
  }

  @Delete('rules/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteRule(@Param('id') id: string) {
    await this.pricing.deleteRule(id);
  }

  // ── Price simulator ────────────────────────────────────────────────────────

  @Post('simulate')
  @HttpCode(HttpStatus.OK)
  simulate(@Body() body: PriceCalculationInput) {
    return this.pricing.simulatePrice(body);
  }
}
