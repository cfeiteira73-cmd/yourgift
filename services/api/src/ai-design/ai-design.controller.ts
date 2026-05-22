import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AIDesignService } from './ai-design.service';
import { BrandTemplateService } from './brand-template.service';
import { ZeroFrictionService } from './zero-friction.service';

@Controller('api/v1/design')
@UseGuards(JwtAuthGuard)
export class AIDesignController {
  constructor(
    private readonly design: AIDesignService,
    private readonly templates: BrandTemplateService,
    private readonly zeroFriction: ZeroFrictionService,
  ) {}

  // ── Design Jobs ──────────────────────────────────────────────────────────

  @Post('jobs')
  createJob(
    @Body()
    body: {
      companyId: string;
      productId: string;
      tenantId?: string;
      brandTemplateId?: string;
      customPrompt?: string;
    },
  ) {
    return this.design.createDesignJob(body);
  }

  @Get('jobs/:id')
  getJob(@Param('id') id: string) {
    return this.design.getJob(id);
  }

  @Get('jobs')
  getJobsForCompany(
    @Query('companyId') companyId: string,
    @Query('limit') limit?: string,
  ) {
    return this.design.getJobsForCompany(companyId, limit ? Number(limit) : 20);
  }

  @Get('stats')
  getStats() {
    return this.design.getStats();
  }

  // ── Mockup approval ──────────────────────────────────────────────────────

  @Patch('mockups/:id/approve')
  approveMockup(
    @Param('id') id: string,
    @Body() body: { approvedBy: string },
  ) {
    return this.design.approveMockup(id, body.approvedBy);
  }

  // ── Brand Templates ──────────────────────────────────────────────────────

  @Post('templates')
  createTemplate(@Body() body: Parameters<BrandTemplateService['create']>[0]) {
    return this.templates.create(body);
  }

  @Get('templates')
  listTemplates(@Query('tenantId') tenantId?: string) {
    return this.templates.list(tenantId);
  }

  @Get('templates/company/:companyId')
  getCompanyTemplates(@Param('companyId') id: string) {
    return this.templates.getForCompany(id);
  }

  @Patch('templates/:id')
  updateTemplate(
    @Param('id') id: string,
    @Body() body: Parameters<BrandTemplateService['update']>[1],
  ) {
    return this.templates.update(id, body);
  }

  // ── Zero-friction pipeline ───────────────────────────────────────────────

  @Post('zero-friction')
  runZeroFriction(
    @Body()
    body: {
      companyId: string;
      productId: string;
      quantity: number;
      tenantId?: string;
      brandTemplateId?: string;
      autoSubmit?: boolean;
    },
  ) {
    return this.zeroFriction.execute(body);
  }

  @Get('zero-friction/stats')
  pipelineStats() {
    return this.zeroFriction.getPipelineStats();
  }
}
