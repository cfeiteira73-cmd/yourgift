import { Controller, Get, Post, Param, Body, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WorkflowEngineService } from './workflow-engine.service';
import { LearningLoopService } from './learning-loop.service';

@Controller('workflows')
@UseGuards(JwtAuthGuard)
export class WorkflowsController {
  constructor(
    private readonly engine: WorkflowEngineService,
    private readonly learning: LearningLoopService,
  ) {}

  @Get('definitions')
  getDefinitions() { return this.engine.getDefinitions(); }

  @Get('instances')
  getInstances(
    @Query('status') status?: string,
    @Query('definition') definition?: string,
    @Query('limit') limit?: string,
  ) {
    return this.engine.getInstances({ status, definitionName: definition, limit: limit ? Number(limit) : undefined });
  }

  @Get('instances/:id')
  getInstance(@Param('id') id: string) { return this.engine.getInstance(id); }

  @Post('instances/:id/retry')
  retryInstance(@Param('id') id: string) { return this.engine.retryInstance(id); }

  @Get('stats')
  getStats() { return this.engine.getStats(); }

  @Post('start')
  startWorkflow(@Body() body: { definitionId: string; payload: Record<string, unknown> }) {
    return this.engine.startWorkflow(body.definitionId, body.payload);
  }

  // Learning loop endpoints
  @Get('learning/stats')
  learningStats() { return this.learning.getPlatformLearningStats(); }

  @Get('learning/supplier/:id')
  supplierLearning(@Param('id') id: string) { return this.learning.getSupplierLearningReport(id); }

  @Post('learning/satisfaction')
  recordSatisfaction(@Body() body: { orderId: string; supplierId: string; score: number }) {
    return this.learning.recordSatisfactionScore(body.orderId, body.supplierId, body.score);
  }
}
