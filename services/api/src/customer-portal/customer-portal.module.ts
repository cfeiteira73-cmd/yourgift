import { Module } from '@nestjs/common';
import { CustomerPortalService } from './customer-portal.service';
import { CustomerPortalController } from './customer-portal.controller';

@Module({
  providers: [CustomerPortalService],
  controllers: [CustomerPortalController],
  exports: [CustomerPortalService],
})
export class CustomerPortalModule {}
