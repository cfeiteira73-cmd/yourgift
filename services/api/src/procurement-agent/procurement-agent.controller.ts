import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProcurementAgentService } from './procurement-agent.service';

@Controller('procurement-agent')
@UseGuards(JwtAuthGuard)
export class ProcurementAgentController {
  constructor(private readonly service: ProcurementAgentService) {}

  // POST /api/v1/procurement-agent/briefs
  @Post('briefs')
  async processBrief(
    @Body() body: { description: string; tenantId?: string },
  ) {
    return this.service.processBrief(body.description, body.tenantId);
  }

  // GET /api/v1/procurement-agent/briefs
  @Get('briefs')
  async listBriefs(
    @Query('tenantId') tenantId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.listBriefs(tenantId, limit ? parseInt(limit, 10) : 20);
  }

  // GET /api/v1/procurement-agent/briefs/:id
  @Get('briefs/:id')
  async getBriefWithPlan(@Param('id') id: string) {
    return this.service.getBriefWithPlan(id);
  }

  // POST /api/v1/procurement-agent/briefs/:id/generate-plan
  @Post('briefs/:id/generate-plan')
  async generatePlan(@Param('id') id: string) {
    return this.service.generatePlan(id);
  }

  // POST /api/v1/procurement-agent/plans/:id/approve
  @Post('plans/:id/approve')
  async approvePlan(
    @Param('id') id: string,
    @Body() body: { approvedBy: string },
  ) {
    await this.service.approvePlan(id, body.approvedBy);
    return { success: true };
  }
}
