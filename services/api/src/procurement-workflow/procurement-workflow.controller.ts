import { Controller, Get, Post, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProcurementWorkflowService } from './procurement-workflow.service';

@ApiTags('procurement-workflow')
@UseGuards(JwtAuthGuard)
@Controller('procurement/requests')
export class ProcurementWorkflowController {
  constructor(private readonly workflow: ProcurementWorkflowService) {}

  @Post()
  @ApiOperation({ summary: 'Create procurement request (draft)' })
  async create(@Request() req: any, @Body() body: { title: string; description?: string; category?: string; supplierCode?: string; estimatedCostEur?: number; quantity?: number; organizationId?: string }) {
    return this.workflow.createRequest({ requesterId: req.user.sub, ...body });
  }

  @Get()
  @ApiOperation({ summary: 'List procurement requests' })
  async list(@Request() req: any, @Query('status') status?: string, @Query('organizationId') organizationId?: string) {
    return this.workflow.listRequests({ requesterId: req.user.sub, status, organizationId });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single request' })
  async get(@Param('id') id: string) {
    return this.workflow.getRequest(id);
  }

  @Post(':id/submit')
  @ApiOperation({ summary: 'Submit draft for policy evaluation + approval' })
  async submit(@Param('id') id: string, @Request() req: any) {
    const ip = req.ip ?? req.headers?.['x-forwarded-for']?.split(',')[0]?.trim();
    return this.workflow.submitForApproval(id, req.user.sub, ip);
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Approve request (advance approval chain)' })
  async approve(@Param('id') id: string, @Request() req: any) {
    return this.workflow.approve(id, req.user.sub);
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Reject request' })
  async reject(@Param('id') id: string, @Request() req: any, @Body() body: { reason: string }) {
    return this.workflow.reject(id, req.user.sub, body.reason);
  }

  @Post(':id/execute')
  @ApiOperation({ summary: 'Mark request as executing (budget reserved → committed)' })
  async execute(@Param('id') id: string) {
    return this.workflow.execute(id);
  }

  @Post(':id/fulfill')
  @ApiOperation({ summary: 'Mark request as fulfilled (budget committed → spent)' })
  async fulfill(@Param('id') id: string, @Body() body: { actualCostEur?: number }) {
    return this.workflow.fulfill(id, body.actualCostEur);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel request (releases reserved budget)' })
  async cancel(@Param('id') id: string, @Body() body: { reason?: string }) {
    return this.workflow.cancel(id, body.reason);
  }
}
