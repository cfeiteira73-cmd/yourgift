import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface OperationsSnapshot {
  snapshotAt: Date;
  deployment: {
    version: string;
    nodeEnv: string;
    isLiveMode: boolean;
  };
  orders: {
    last1h: number;
    last24h: number;
    revenueToday: number;
  };
  queue: {
    pending: number;
    failed1h: number;
    stuck: number;
  };
  webhooks: {
    total1h: number;
    failures1h: number;
    failureRate: number;
  };
  reconciliation: {
    unReconciled: number;
  };
  replay: {
    queueDepth: number;
  };
  incidents: {
    open: number;
  };
  infra: {
    costPerHourEur: number;
    aiCostPerHourEur: number;
  };
  healthScore: number;
}

@Injectable()
export class ProductionOperationsCenterService {
  private readonly logger = new Logger(ProductionOperationsCenterService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getOperationsSnapshot(): Promise<OperationsSnapshot> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

    const [
      ordersLast1h,
      ordersLast24h,
      revenueTodayAgg,
      pendingJobs,
      failedJobs,
      stuckJobs,
      webhookDeliveriesTotal,
      webhookFailures,
      unReconciledOrders,
      replayQueueDepth,
      openIncidents,
      aiEventCount,
    ] = await Promise.all([
      this.prisma.order.count({
        where: { createdAt: { gte: oneHourAgo } },
      }),

      this.prisma.order.count({
        where: { createdAt: { gte: twentyFourHoursAgo } },
      }),

      this.prisma.order.aggregate({
        where: {
          status: 'paid',
          createdAt: { gte: todayStart },
        },
        _sum: { totalAmount: true },
      }),

      this.prisma.job.count({
        where: { status: 'pending' },
      }),

      this.prisma.job.count({
        where: {
          status: 'failed',
          createdAt: { gte: oneHourAgo },
        },
      }),

      this.prisma.job.count({
        where: {
          status: 'processing',
          startedAt: { lt: thirtyMinutesAgo },
        },
      }),

      this.prisma.webhookDelivery.count({
        where: { createdAt: { gte: oneHourAgo } },
      }),

      this.prisma.webhookDelivery.count({
        where: {
          success: false,
          createdAt: { gte: oneHourAgo },
        },
      }),

      this.prisma.order.count({
        where: {
          stripePaymentId: { not: null },
          status: 'created',
          createdAt: { lt: oneHourAgo },
        },
      }),

      this.prisma.job.count({
        where: {
          type: 'stripe.event.replay',
          status: 'pending',
        },
      }),

      this.prisma.eventLog.count({
        where: {
          event: 'incident.opened',
        },
      }),

      this.prisma.eventLog.count({
        where: {
          event: { startsWith: 'ai.' },
          createdAt: { gte: oneHourAgo },
        },
      }),
    ]);

    // Deployment info
    const deploymentVersion = process.env.npm_package_version ?? 'unknown';
    const nodeEnv = process.env.NODE_ENV ?? 'unknown';
    const isLiveMode = process.env.STRIPE_KEY?.startsWith('sk_live_') ?? false;

    // Revenue today
    const revenueToday = Number(revenueTodayAgg._sum.totalAmount ?? 0);

    // Webhook failure rate
    const webhookFailureRate =
      webhookDeliveriesTotal > 0 ? webhookFailures / webhookDeliveriesTotal : 0;

    // Infra cost estimates
    const infraCostPerHour = 0.15;
    const aiCostPerHour = aiEventCount * 0.002;

    // Health score calculation
    let healthScore = 100;

    if (stuckJobs > 0) {
      const penalty = Math.min(stuckJobs * 20, 40);
      healthScore -= penalty;
    }

    if (failedJobs > 5) {
      healthScore -= 15;
    }

    if (webhookFailureRate > 0.05) {
      healthScore -= 20;
    }

    if (unReconciledOrders > 0) {
      healthScore -= 10;
    }

    if (openIncidents > 0) {
      healthScore -= 25;
    }

    healthScore = Math.max(0, healthScore);

    return {
      snapshotAt: now,
      deployment: {
        version: deploymentVersion,
        nodeEnv,
        isLiveMode,
      },
      orders: {
        last1h: ordersLast1h,
        last24h: ordersLast24h,
        revenueToday,
      },
      queue: {
        pending: pendingJobs,
        failed1h: failedJobs,
        stuck: stuckJobs,
      },
      webhooks: {
        total1h: webhookDeliveriesTotal,
        failures1h: webhookFailures,
        failureRate: Math.round(webhookFailureRate * 10000) / 10000,
      },
      reconciliation: {
        unReconciled: unReconciledOrders,
      },
      replay: {
        queueDepth: replayQueueDepth,
      },
      incidents: {
        open: openIncidents,
      },
      infra: {
        costPerHourEur: infraCostPerHour,
        aiCostPerHourEur: Math.round(aiCostPerHour * 10000) / 10000,
      },
      healthScore,
    };
  }
}
