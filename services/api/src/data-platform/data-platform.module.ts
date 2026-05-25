import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { DataLakeService } from './data-lake.service';
import { OlapQueryService } from './olap-query.service';
import { DataPlatformController } from './data-platform.controller';

@Module({
  imports: [AdminAuthModule],
  providers: [DataLakeService, OlapQueryService],
  controllers: [DataPlatformController],
  exports: [DataLakeService, OlapQueryService],
})
export class DataPlatformModule {}
