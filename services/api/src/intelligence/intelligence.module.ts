import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { IntelligenceService } from './intelligence.service';
import { IntelligenceController } from './intelligence.controller';
import { ProcurementAccuracyService } from './procurement-accuracy.service';
import { ROIReportService } from './roi-report.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [IntelligenceController],
  providers: [IntelligenceService, ProcurementAccuracyService, ROIReportService],
  exports: [IntelligenceService, ProcurementAccuracyService, ROIReportService],
})
export class IntelligenceModule {}
