import { Module } from '@nestjs/common';
import { CompanyStoresService } from './company-stores.service';
import { CompanyStoresController } from './company-stores.controller';

@Module({
  providers: [CompanyStoresService],
  controllers: [CompanyStoresController],
  exports: [CompanyStoresService],
})
export class CompanyStoresModule {}
