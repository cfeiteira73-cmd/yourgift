import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';

const STAGE_ORDER = ['artwork', 'approval', 'prepress', 'routing', 'production', 'qc', 'packaging', 'shipment', 'delivery'] as const;
type Stage = typeof STAGE_ORDER[number];

@Injectable()
export class ProductionService implements OnModuleInit {
  private readonly logger = new Logger(ProductionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventBusService,
  ) {}

  onModuleInit() {
    // When order is approved: initialize production pipeline
    this.events.on('order.approved', async ({ orderId, tenantId }: { orderId?: string; tenantId?: string }) => {
      if (orderId) await this.initializePipeline(orderId, tenantId ?? 'default');
    });

    // When artwork event fires: advance to artwork stage
    this.events.on('artwork.process', async ({ orderId }: { orderId?: string }) => {
      if (orderId) await this.advanceStage(orderId, 'artwork', 'in_progress');
    });

    this.logger.log('Production Control Tower initialized');
  }

  async initializePipeline(orderId: string, tenantId: string): Promise<void> {
    const slas = await this.prisma.sLADefinition.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } });
    const now = new Date();

    // Create all stage records as 'pending', compute expected completion cascade
    let rollingTime = new Date(now);
    const stageData = slas.map(sla => {
      const expectedCompletion = new Date(rollingTime.getTime() + sla.expectedHours * 3600 * 1000);
      rollingTime = expectedCompletion;
      return {
        orderId,
        tenantId,
        stage: sla.stage,
        status: sla.stage === 'artwork' ? 'in_progress' : 'pending',
        startedAt: sla.stage === 'artwork' ? now : undefined,
        expectedCompletionAt: expectedCompletion,
        slaStatus: 'on_track',
      };
    });

    await this.prisma.productionStage.createMany({
      data: stageData,
      skipDuplicates: true,
    });

    this.events.emit('production.pipeline_initialized', { orderId, tenantId, stageCount: stageData.length });
    this.logger.log(`Production pipeline initialized for order ${orderId} (${stageData.length} stages)`);
  }

  async advanceStage(orderId: string, stage: string, newStatus: string): Promise<void> {
    const now = new Date();
    const sla = await this.prisma.sLADefinition.findUnique({ where: { stage } });

    await this.prisma.productionStage.updateMany({
      where: { orderId, stage },
      data: {
        status: newStatus,
        startedAt: newStatus === 'in_progress' ? now : undefined,
        completedAt: newStatus === 'completed' ? now : undefined,
        updatedAt: now,
      },
    });

    // If completing a stage, auto-start the next one
    if (newStatus === 'completed' && sla) {
      const currentIndex = STAGE_ORDER.indexOf(stage as Stage);
      const nextStage = currentIndex >= 0 ? STAGE_ORDER[currentIndex + 1] : undefined;
      if (nextStage) {
        await this.prisma.productionStage.updateMany({
          where: { orderId, stage: nextStage },
          data: { status: 'in_progress', startedAt: now, updatedAt: now },
        });
        this.events.emit(`production.${nextStage}.started`, { orderId, stage: nextStage });
      }
    }

    this.events.emit('production.stage_updated', { orderId, stage, newStatus });
  }

  async computeSLAStatus(orderId: string): Promise<void> {
    const stages = await this.prisma.productionStage.findMany({ where: { orderId } });
    const now = new Date();

    for (const stage of stages) {
      if (stage.status === 'completed' || stage.status === 'skipped') continue;

      const sla = await this.prisma.sLADefinition.findUnique({ where: { stage: stage.stage } });
      if (!sla || !stage.expectedCompletionAt) continue;

      const hoursRemaining = (stage.expectedCompletionAt.getTime() - now.getTime()) / (1000 * 3600);
      const slaStatus = hoursRemaining < 0 ? 'breached'
        : hoursRemaining <= sla.warningHours ? 'warning'
        : 'on_track';

      await this.prisma.productionStage.update({
        where: { id: stage.id },
        data: { slaStatus, slaHoursRemaining: Math.round(hoursRemaining * 10) / 10, updatedAt: now },
      });
    }
  }

  async getPipelineForOrder(orderId: string) {
    const stages = await this.prisma.productionStage.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
    });
    const slas = await this.prisma.sLADefinition.findMany({ orderBy: { sortOrder: 'asc' } });
    return { orderId, stages, slas };
  }

  async getControlTowerStats() {
    const [byStage, byStatus, bySLAStatus, activeOrders] = await Promise.all([
      this.prisma.productionStage.groupBy({ by: ['stage'], _count: { id: true }, where: { status: 'in_progress' } }),
      this.prisma.productionStage.groupBy({ by: ['status'], _count: { id: true } }),
      this.prisma.productionStage.groupBy({ by: ['slaStatus'], _count: { id: true } }),
      this.prisma.productionStage.findMany({ where: { status: 'in_progress' }, select: { orderId: true }, distinct: ['orderId'] }),
    ]);

    return {
      activeOrders: activeOrders.length,
      byStage: Object.fromEntries(byStage.map(s => [s.stage, s._count.id])),
      byStatus: Object.fromEntries(byStatus.map(s => [s.status, s._count.id])),
      bySLAStatus: Object.fromEntries(bySLAStatus.map(s => [s.slaStatus, s._count.id])),
    };
  }

  async getBottlenecks() {
    // Stages with most SLA breaches or warnings
    const breached = await this.prisma.productionStage.groupBy({
      by: ['stage'],
      where: { slaStatus: { in: ['breached', 'warning'] }, status: 'in_progress' },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    });

    // Stages with longest avg time in_progress
    const inProgress = await this.prisma.productionStage.findMany({
      where: { status: 'in_progress', startedAt: { not: null } },
      select: { stage: true, startedAt: true, orderId: true, slaStatus: true },
    });

    const stageTimes: Record<string, number[]> = {};
    const now = Date.now();
    for (const s of inProgress) {
      if (!s.startedAt) continue;
      const hoursElapsed = (now - s.startedAt.getTime()) / (1000 * 3600);
      if (!stageTimes[s.stage]) stageTimes[s.stage] = [];
      stageTimes[s.stage].push(hoursElapsed);
    }

    const avgTimes = Object.entries(stageTimes).map(([stage, times]) => ({
      stage,
      avgHours: Math.round((times.reduce((a, b) => a + b, 0) / times.length) * 10) / 10,
      orderCount: times.length,
    })).sort((a, b) => b.avgHours - a.avgHours);

    return {
      slaBreaches: breached.map(b => ({ stage: b.stage, count: b._count.id })),
      slowestStages: avgTimes.slice(0, 5),
    };
  }

  async getSLADefinitions() {
    return this.prisma.sLADefinition.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } });
  }

  async getOrdersAtRisk() {
    const stages = await this.prisma.productionStage.findMany({
      where: { slaStatus: { in: ['breached', 'warning'] }, status: 'in_progress' },
      orderBy: [{ slaStatus: 'asc' }, { slaHoursRemaining: 'asc' }],
      take: 20,
    });
    return stages;
  }
}
