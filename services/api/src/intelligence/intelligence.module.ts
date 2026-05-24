import { Module } from '@nestjs/common';
import { IntelligenceService } from './intelligence.service';
import { IntelligenceController } from './intelligence.controller';
import { ProcurementAccuracyService } from './procurement-accuracy.service';
import { ROIReportService } from './roi-report.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [IntelligenceController],
  providers: [IntelligenceService, ProcurementAccuracyService, ROIReportService],
  exports: [IntelligenceService, ProcurementAccuracyService, ROIReportService],
})
export class IntelligenceModule {}
