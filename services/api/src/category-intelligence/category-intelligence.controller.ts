import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BenchmarkReportService } from './benchmark-report.service';
import { ROICalculatorService, ROIInput } from './roi-calculator.service';

@Controller('category-intelligence')
@UseGuards(JwtAuthGuard)
export class CategoryIntelligenceController {
  constructor(
    private readonly benchmarkReport: BenchmarkReportService,
    private readonly roiCalculator: ROICalculatorService,
  ) {}

  @Get('benchmark-report')
  generateReport() {
    return this.benchmarkReport.generateReport();
  }

  @Get('supplier-leaderboard')
  getSupplierLeaderboard() {
    return this.benchmarkReport.getSupplierLeaderboard();
  }

  @Get('category-leaderboard')
  getCategoryLeaderboard() {
    return this.benchmarkReport.getCategoryLeaderboard();
  }

  @Post('roi-calculator')
  calculateROI(@Body() input: ROIInput) {
    return this.roiCalculator.calculate(input);
  }
}
