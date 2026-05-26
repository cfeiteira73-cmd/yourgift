import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { Prisma } from '@prisma/client';

export interface IFulfillmentProvider {
  name: string;
  submitJob(jobId: string, orderId: string, artworkUrl: string): Promise<{ externalJobId: string }>;
  getJobStatus(externalJobId: string): Promise<{ status: string; estimatedDays?: number }>;
  cancelJob(externalJobId: string): Promise<void>;
}

// Real Printful REST API provider — uses native fetch (Node 22+)
class PrintfulProvider implements IFulfillmentProvider {
  name = 'printful';
  private readonly baseUrl = 'https://api.printful.com';
  private get apiKey(): string {
    return process.env.PRINTFUL_API_KEY ?? '';
  }
  private headers(): Record<string, string> {
    return { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' };
  }

  async submitJob(jobId: string, orderId: string, artworkUrl: string): Promise<{ externalJobId: string }> {
    const res = await fetch(`${this.baseUrl}/orders`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        external_id: jobId,
        recipient: { name: 'YourGift Customer', address1: 'TBD', city: 'TBD', country_code: 'PT', zip: '1000-001' },
        items: [{ variant_id: 1, quantity: 1, files: [{ url: artworkUrl }] }],
      }),
    });
    const data = await res.json() as { result?: { id?: string | number } };
    return { externalJobId: String(data?.result?.id ?? jobId) };
  }

  async getJobStatus(externalJobId: string): Promise<{ status: string; estimatedDays?: number }> {
    const res = await fetch(`${this.baseUrl}/orders/${externalJobId}`, { headers: this.headers() });
    const data = await res.json() as { result?: { status?: string } };
    return { status: data?.result?.status ?? 'unknown', estimatedDays: 5 };
  }

  async cancelJob(externalJobId: string): Promise<void> {
    await fetch(`${this.baseUrl}/orders/${externalJobId}`, { method: 'DELETE', headers: this.headers() });
  }
}

class ManualFallbackProvider implements IFulfillmentProvider {
  name = 'manual';
  async submitJob(jobId: string): Promise<{ externalJobId: string }> {
    return { externalJobId: `manual-${jobId}-${Date.now()}` };
  }
  async getJobStatus(): Promise<{ status: string; estimatedDays?: number }> {
    return { status: 'in_production', estimatedDays: 10 };
  }
  async cancelJob(): Promise<void> {}
}

@Injectable()
export class SupplierRoutingService {
  private readonly logger = new Logger(SupplierRoutingService.name);
  private readonly printful: PrintfulProvider;
  private readonly manual: ManualFallbackProvider;

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {
    this.printful = new PrintfulProvider();
    this.manual = new ManualFallbackProvider();
  }

  async submitToProvider(
    jobId: string,
    orderId: string,
    artworkUrl: string,
    preferredProvider?: string,
  ): Promise<{ provider: string; externalJobId: string; usedFallback: boolean }> {
    let provider: IFulfillmentProvider = this.printful;
    if (preferredProvider === 'manual') provider = this.manual;
    else {
      const perf = await this.prisma.supplierPerformance.findFirst({
        where: { supplier: 'printful' },
        select: { reliabilityScore: true },
      });
      if (perf && Number(perf.reliabilityScore) < 0.7) {
        provider = this.manual;
        this.logger.warn(`Printful reliability below threshold — routing to manual`);
      }
    }

    const start = Date.now();
    let externalJobId = '';
    let success = false;
    let errorMsg: string | null = null;
    let usedFallback = false;

    try {
      const result = await provider.submitJob(jobId, orderId, artworkUrl);
      externalJobId = result.externalJobId;
      success = true;
    } catch (err: unknown) {
      errorMsg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Provider ${provider.name} failed: ${errorMsg} — falling back to manual`);
      usedFallback = provider.name !== 'manual';
      provider = this.manual;
      const result = await provider.submitJob(jobId, orderId, artworkUrl);
      externalJobId = result.externalJobId;
      success = true;
    }

    await this.logInteraction({
      jobId,
      provider: provider.name,
      action: 'submit',
      externalJobId,
      requestPayload: { orderId, artworkUrl },
      responsePayload: { externalJobId },
      statusCode: success ? 200 : 500,
      success,
      durationMs: Date.now() - start,
      errorMessage: errorMsg,
    });

    this.eventBus.emit('supplier.job.submitted', { jobId, orderId, provider: provider.name, externalJobId });
    return { provider: provider.name, externalJobId, usedFallback };
  }

  async pollJobStatus(
    jobId: string,
    provider: string,
    externalJobId: string,
  ): Promise<{ status: string; estimatedDays?: number }> {
    const p: IFulfillmentProvider = provider === 'printful' ? this.printful : this.manual;
    const start = Date.now();
    let status = 'unknown';
    let estimatedDays: number | undefined;
    let errorMsg: string | null = null;

    try {
      const result = await p.getJobStatus(externalJobId);
      status = result.status;
      estimatedDays = result.estimatedDays;
    } catch (err: unknown) {
      errorMsg = err instanceof Error ? err.message : String(err);
    }

    await this.logInteraction({
      jobId,
      provider,
      action: 'poll_status',
      externalJobId,
      requestPayload: {},
      responsePayload: { status, estimatedDays },
      statusCode: errorMsg ? 500 : 200,
      success: !errorMsg,
      durationMs: Date.now() - start,
      errorMessage: errorMsg,
    });

    return { status, estimatedDays };
  }

  async recordOutcome(
    supplier: string,
    success: boolean,
    leadTimeDays?: number,
  ): Promise<void> {
    const existing = await this.prisma.supplierPerformance.findFirst({
      where: { supplier },
    });

    if (!existing) {
      await this.prisma.supplierPerformance.create({
        data: {
          supplier,
          totalOrders: 1,
          onTimeDeliveries: success ? 1 : 0,
          lateDeliveries: 0,
          cancelledOrders: success ? 0 : 1,
          avgDeliveryDays: leadTimeDays ?? null,
          reliabilityScore: success ? 1.0 : 0.0,
        },
      });
      return;
    }

    const totalOrders = existing.totalOrders + 1;
    const onTimeDeliveries = existing.onTimeDeliveries + (success ? 1 : 0);
    const cancelledOrders = existing.cancelledOrders + (success ? 0 : 1);
    const reliabilityScore = totalOrders > 0 ? onTimeDeliveries / totalOrders : 0;
    const avgLead =
      leadTimeDays != null
        ? ((existing.avgDeliveryDays ?? 0) * existing.totalOrders + leadTimeDays) / totalOrders
        : existing.avgDeliveryDays;

    await this.prisma.supplierPerformance.update({
      where: { id: existing.id },
      data: {
        totalOrders,
        onTimeDeliveries,
        cancelledOrders,
        avgDeliveryDays: avgLead,
        reliabilityScore,
      },
    });

    this.eventBus.emit('supplier.outcome.recorded', { supplier, success, reliabilityScore });
  }

  async getProviderScores(): Promise<{ supplier: string; reliabilityScore: number; totalOrders: number }[]> {
    const rows = await this.prisma.supplierPerformance.findMany({
      orderBy: { reliabilityScore: 'desc' },
      take: 20,
    });
    return rows.map((r) => ({
      supplier: r.supplier,
      reliabilityScore: Number(r.reliabilityScore),
      totalOrders: r.totalOrders,
    }));
  }

  private async logInteraction(params: {
    jobId: string;
    provider: string;
    action: string;
    externalJobId: string;
    requestPayload: object;
    responsePayload: object;
    statusCode: number | null;
    success: boolean;
    durationMs: number;
    errorMessage: string | null;
  }): Promise<void> {
    try {
      await this.prisma.$executeRaw(
        Prisma.sql`INSERT INTO supplier_interaction_logs
          (production_job_id, provider, action, external_job_id, request_payload, response_payload, status_code, success, duration_ms, error_message)
          VALUES (${params.jobId}, ${params.provider}, ${params.action}, ${params.externalJobId},
            ${JSON.stringify(params.requestPayload)}::jsonb, ${JSON.stringify(params.responsePayload)}::jsonb,
            ${params.statusCode}, ${params.success}, ${params.durationMs}, ${params.errorMessage})`,
      );
    } catch (err) {
      this.logger.warn(`Failed to log supplier interaction: ${err}`);
    }
  }
}
