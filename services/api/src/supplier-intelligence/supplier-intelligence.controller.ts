import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { SupplierIntelligenceService } from './supplier-intelligence.service';
import { AdminAuthGuard } from '../admin-auth/admin-auth.guard';

@Controller('admin/supplier-intelligence')
@UseGuards(AdminAuthGuard)
export class SupplierIntelligenceController {
  constructor(private readonly svc: SupplierIntelligenceService) {}

  @Get('scorecard/:supplierId')
  getScorecard(@Param('supplierId') supplierId: string) {
    return this.svc.getScorecard(supplierId);
  }

  @Get('recommendation/:supplierId')
  getRecommendation(@Param('supplierId') supplierId: string) {
    return this.svc.getRoutingRecommendation(supplierId);
  }

  @Post('downgrade/:supplierId')
  applyDowngrade(@Param('supplierId') supplierId: string) {
    return this.svc.applyAutoDowngrade(supplierId);
  }

  @Post('repurchase-bonus/:supplierId')
  recordBonus(@Param('supplierId') supplierId: string) {
    return this.svc.recordRepurchaseBonus(supplierId);
  }

  @Get('feedback-loop')
  getFeedbackLoop() {
    return this.svc.getBusinessFeedbackLoop();
  }
}
