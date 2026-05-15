import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PricingService } from './pricing.service';
import { CalculatePriceDto } from './dto/calculate-price.dto';

@ApiTags('pricing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('pricing')
export class PricingController {
  constructor(private pricing: PricingService) {}

  @Post('calculate')
  calculate(@Body() dto: CalculatePriceDto) {
    return this.pricing.calculate(dto);
  }
}
