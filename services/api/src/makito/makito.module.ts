import { Module } from '@nestjs/common';
import { MakitoService } from './makito.service';
import { MakitoController } from './makito.controller';
import { MakitoInventoryService } from './makito-inventory.service';
import { MakitoTrackingService } from './makito-tracking.service';
import { MakitoAnalyticsService } from './makito-analytics.service';

@Module({
  providers: [
    MakitoService,
    MakitoInventoryService,
    MakitoTrackingService,
    MakitoAnalyticsService,
  ],
  controllers: [MakitoController],
  exports: [
    MakitoService,
    MakitoInventoryService,
    MakitoTrackingService,
    MakitoAnalyticsService,
  ],
})
export class MakitoModule {}
