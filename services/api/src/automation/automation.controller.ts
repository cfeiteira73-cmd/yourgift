import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AutomationService } from './automation.service';
import { RoutingService, RoutingCriteria } from './routing.service';

@Controller('api/v1/automation')
@UseGuards(JwtAuthGuard)
export class AutomationController {
  constructor(
    private readonly automation: AutomationService,
    private readonly routing: RoutingService,
  ) {}

  @Get('rules')
  getRules(): Promise<unknown[]> {
    return this.automation.getRules();
  }

  @Get('executions')
  getExecutions(@Query('limit') limit?: string) {
    return this.automation.getExecutions(limit ? Number(limit) : 50);
  }

  @Get('stats')
  getStats() {
    return this.automation.getStats();
  }

  @Patch('rules/:id/toggle')
  toggleRule(
    @Param('id') id: string,
    @Body() body: { isActive: boolean },
  ) {
    return this.automation.toggleRule(id, body.isActive);
  }

  @Post('routing/optimal')
  getOptimalSupplier(@Body() criteria: RoutingCriteria) {
    return this.routing.selectOptimalSupplier(criteria);
  }

  @Post('routing/ranked')
  getRankedSuppliers(@Body() criteria: RoutingCriteria) {
    return this.routing.getRankedSuppliers(criteria);
  }

  @Get('routing/matrix')
  getMatrix() {
    return this.routing.getMatrix();
  }

  @Get('supplier-intelligence')
  async getSupplierIntelligence() {
    const matrix = await this.routing.getRoutingMatrix();

    // Access prisma through the routing service for learning outcomes
    const routingAsAny = this.routing as unknown as { prisma: { learningOutcome: { findMany: (q: Record<string, unknown>) => Promise<unknown[]> } } };
    const rawOutcomes = await routingAsAny.prisma.learningOutcome.findMany({
      where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
      orderBy: { createdAt: 'desc' },
    });

    const outcomes = rawOutcomes as Array<{ supplierId: string | null; delta: string | null; [key: string]: unknown }>;

    const outcomeMap: Record<string, typeof outcomes> = {};
    for (const o of outcomes) {
      const key = o.supplierId ?? '__unknown__';
      if (!outcomeMap[key]) outcomeMap[key] = [];
      outcomeMap[key].push(o);
    }

    return matrix.map((supplier) => {
      const supplierOutcomes = outcomeMap[supplier.supplierId] ?? [];
      const total = supplierOutcomes.length;
      const avgScoreDelta =
        total > 0
          ? supplierOutcomes.reduce((s, o) => s + Number(o.delta ?? 0), 0) / total
          : 0;
      return {
        ...supplier,
        recentOutcomes: supplierOutcomes,
        totalLearnings: total,
        avgScoreDelta: Math.round(avgScoreDelta * 100) / 100,
      };
    });
  }
}
