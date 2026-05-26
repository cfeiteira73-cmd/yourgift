import { Controller, Get, Post, Body, Param, Query, UseGuards, SetMetadata } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { IntelligenceService } from './intelligence.service';
import { ProcurementAccuracyService } from './procurement-accuracy.service';
import { ROIReportService, ROIReportInput } from './roi-report.service';

@Controller('intelligence')
@UseGuards(JwtAuthGuard)
export class IntelligenceController {
  constructor(
    private readonly intelligence: IntelligenceService,
    private readonly accuracy: ProcurementAccuracyService,
    private readonly roi: ROIReportService,
  ) {}

  @Get('signals')
  getSignals(@Query('entityType') entityType?: string) {
    return this.intelligence.getSignals(entityType);
  }

  @Get('supplier-scores')
  getSupplierScores() {
    return this.intelligence.getSupplierScores();
  }

  @Get('health')
  getSystemHealth() {
    return this.intelligence.getSystemHealth();
  }

  @Post('recompute')
  recompute() {
    return this.intelligence.recomputeIntelligence();
  }

  // ── Procurement Accuracy ──────────────────────────────────────────────────

  /**
   * GET /intelligence/suppliers/:supplierId/trust
   * Returns supplier trust profile: tier, score, rates, recommendation.
   */
  @Get('suppliers/:supplierId/trust')
  getSupplierTrust(@Param('supplierId') supplierId: string) {
    return this.accuracy.getSupplierTrustProfile(supplierId);
  }

  /**
   * POST /intelligence/suppliers/:supplierId/actuals
   * Record actual vs predicted for a completed order — updates trust score.
   */
  @Post('suppliers/:supplierId/actuals')
  recordActuals(
    @Param('supplierId') supplierId: string,
    @Body() body: {
      orderId: string;
      supplierName: string;
      quotedCostEur: number;
      actualCostEur: number;
      quotedLeadDays: number;
      actualLeadDays: number;
      qualityScore: number;
      qualityNotes?: string;
    },
  ) {
    return this.accuracy.recordActuals({ supplierId, ...body });
  }

  /**
   * GET /intelligence/suppliers/:supplierId/accuracy?period=30d
   * Accuracy report for a supplier over a period.
   */
  @Get('suppliers/:supplierId/accuracy')
  getAccuracyReport(
    @Param('supplierId') supplierId: string,
    @Query('period') period?: string,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.accuracy.generateReport(tenantId ?? supplierId, period ?? '90d');
  }

  // ── ROI Reports (CFO / Commercial) ───────────────────────────────────────

  /**
   * POST /intelligence/roi
   * Generate a full ROI report for a tenant + period.
   * Returns structured data + shareable link for CFO presentation.
   */
  @Post('roi')
  generateROIReport(@Body() body: ROIReportInput) {
    return this.roi.generate(body);
  }

  /**
   * GET /intelligence/roi/:shareToken
   * Public endpoint for shareable CFO report link (no auth required).
   * JwtAuthGuard is bypassed via @SetMetadata('isPublic', true) — recognized
   * by the guard's canActivate if it checks this metadata.
   */
  @Get('roi/:shareToken')
  @SetMetadata('isPublic', true)
  getSharedReport(@Param('shareToken') shareToken: string) {
    // Share tokens are validated inside the service
    return this.roi.getByShareToken(shareToken);
  }
}
