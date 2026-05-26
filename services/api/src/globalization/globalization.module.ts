import { Module } from '@nestjs/common';
import { CurrencyService } from './currency.service';
import { VatService } from './vat.service';
import { RegionalRoutingService } from './regional-routing.service';
import { GlobalizationController } from './globalization.controller';

@Module({
  controllers: [GlobalizationController],
  providers: [CurrencyService, VatService, RegionalRoutingService],
  exports: [CurrencyService, VatService, RegionalRoutingService],
})
export class GlobalizationModule {}
