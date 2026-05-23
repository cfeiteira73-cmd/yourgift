import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrencyService } from './currency.service';
import { VatService } from './vat.service';
import { RegionalRoutingService } from './regional-routing.service';

class ConvertDto {
  amount!: number;
  from!: string;
  to!: string;
}

class UpdateRateDto {
  from!: string;
  to!: string;
  rate!: number;
  source?: string;
}

class ComputeVatDto {
  netAmount!: number;
  countryCode!: string;
  category?: string;
}

class ValidateVatNumberDto {
  vatNumber!: string;
  countryCode!: string;
}

class RoutingLookupDto {
  countryCode!: string;
}

class UpdateRoutingDto {
  preferredSuppliers?: string[];
  maxLeadTimeDays?: number;
  currency?: string;
  excludedSuppliers?: string[];
}

@ApiTags('globalization')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/globalization')
export class GlobalizationController {
  constructor(
    private readonly currencyService: CurrencyService,
    private readonly vatService: VatService,
    private readonly regionalRoutingService: RegionalRoutingService,
  ) {}

  // ─── Currencies ─────────────────────────────────────────────────────────────

  @Get('currencies')
  getCurrencies() {
    return this.currencyService.getCurrencies();
  }

  @Get('currencies/rates')
  getLatestRates(@Query('base') base?: string) {
    return this.currencyService.getLatestRates(base ?? 'EUR');
  }

  @Get('currencies/matrix')
  getConversionMatrix() {
    return this.currencyService.getConversionMatrix();
  }

  @Post('currencies/convert')
  async convert(@Body() dto: ConvertDto) {
    const result = await this.currencyService.convert(dto.amount, dto.from, dto.to);
    return {
      amount: dto.amount,
      from: dto.from,
      to: dto.to,
      result,
      formatted: this.currencyService.format(result, dto.to),
    };
  }

  @Put('currencies/rates')
  updateRate(@Body() dto: UpdateRateDto) {
    return this.currencyService.updateRate(dto.from, dto.to, dto.rate, dto.source);
  }

  // ─── VAT ────────────────────────────────────────────────────────────────────

  @Get('vat')
  getVATRules() {
    return this.vatService.getVATRules();
  }

  @Get('vat/eu-members')
  getEUMembers() {
    return this.vatService.getEUMembers();
  }

  @Post('vat/compute')
  computeVAT(@Body() dto: ComputeVatDto) {
    return this.vatService.computeVAT(dto.netAmount, dto.countryCode, dto.category);
  }

  @Post('vat/validate-number')
  validateVATNumber(@Body() dto: ValidateVatNumberDto) {
    const valid = this.vatService.validateVATNumber(dto.vatNumber, dto.countryCode);
    return { vatNumber: dto.vatNumber, countryCode: dto.countryCode, valid };
  }

  // ─── Regional Routing ───────────────────────────────────────────────────────

  @Get('routing')
  getRoutingRules() {
    return this.regionalRoutingService.getRoutingRules();
  }

  @Post('routing/lookup')
  async routingLookup(@Body() dto: RoutingLookupDto) {
    const [region, suppliers, leadTime, currency] = await Promise.all([
      this.regionalRoutingService.getRegionForCountry(dto.countryCode),
      this.regionalRoutingService.getPreferredSuppliers(dto.countryCode),
      this.regionalRoutingService.getMaxLeadTime(dto.countryCode),
      this.regionalRoutingService.getPreferredCurrency(dto.countryCode),
    ]);
    return { countryCode: dto.countryCode, region, preferredSuppliers: suppliers, maxLeadTimeDays: leadTime, currency };
  }

  @Put('routing/:region')
  updateRule(@Param('region') region: string, @Body() dto: UpdateRoutingDto) {
    return this.regionalRoutingService.updateRule(region, dto);
  }
}
