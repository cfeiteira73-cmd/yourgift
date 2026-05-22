import { Controller, Get } from '@nestjs/common';
import { CurrencyService } from './currency.service';

@Controller('api/v1/currency')
export class CurrencyController {
  constructor(private readonly currencyService: CurrencyService) {}

  @Get('rates')
  getRates() {
    return this.currencyService.getRates();
  }

  @Get('supported')
  getSupportedCurrencies() {
    return this.currencyService.getSupportedCurrencies();
  }
}
