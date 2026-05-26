import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common';
import { SupplierRoutingService } from './supplier-routing.service';
import { AdminAuthGuard } from '../admin-auth/admin-auth.guard';

@Controller('admin/supplier-routing')
@UseGuards(AdminAuthGuard)
export class SupplierRoutingController {
  constructor(private readonly svc: SupplierRoutingService) {}

  @Post('submit')
  submitJob(@Body() body: { jobId: string; orderId: string; artworkUrl: string; provider?: string }) {
    return this.svc.submitToProvider(body.jobId, body.orderId, body.artworkUrl, body.provider);
  }

  @Get('status/:provider/:externalJobId/:jobId')
  pollStatus(
    @Param('jobId') jobId: string,
    @Param('provider') provider: string,
    @Param('externalJobId') externalJobId: string,
  ) {
    return this.svc.pollJobStatus(jobId, provider, externalJobId);
  }

  @Post('outcome')
  recordOutcome(@Body() body: { supplierId: string; success: boolean; leadTimeDays?: number }) {
    return this.svc.recordOutcome(body.supplierId, body.success, body.leadTimeDays);
  }

  @Get('scores')
  getScores() {
    return this.svc.getProviderScores();
  }
}
