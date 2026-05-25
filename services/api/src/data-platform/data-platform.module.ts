import { Module } from '@nestjs/common';
import { DataLakeService } from './data-lake.service';
import { OlapQueryService } from './olap-query.service';
import { DataPlatformController } from './data-platform.controller';

@Module({
  providers: [DataLakeService, OlapQueryService],
  controllers: [DataPlatformController],
  exports: [DataLakeService, OlapQueryService],
})
export class DataPlatformModule {}
