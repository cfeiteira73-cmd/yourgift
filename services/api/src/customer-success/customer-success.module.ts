import { Module } from '@nestjs/common';
import { CustomerSuccessService } from './customer-success.service';
import { ExpansionService } from './expansion.service';
import { InventoryForecastService } from './inventory-forecast.service';
import { CustomerSuccessController } from './customer-success.controller';

@Module({
  controllers: [CustomerSuccessController],
  providers: [CustomerSuccessService, ExpansionService, InventoryForecastService],
  exports: [CustomerSuccessService, ExpansionService, InventoryForecastService],
})
export class CustomerSuccessModule {}
