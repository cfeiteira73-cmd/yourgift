import { Module } from '@nestjs/common';
import { BenchmarkReportService } from './benchmark-report.service';
import { ROICalculatorService } from './roi-calculator.service';
import { CategoryIntelligenceController } from './category-intelligence.controller';

@Module({
  controllers: [CategoryIntelligenceController],
  providers: [BenchmarkReportService, ROICalculatorService],
  exports: [BenchmarkReportService, ROICalculatorService],
})
export class CategoryIntelligenceModule {}
