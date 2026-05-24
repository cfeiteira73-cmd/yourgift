import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';

export interface AnonymizedEvent {
  tenantHash: string;
  clientId: null;
  userId: null;
  supplierCode?: string;
  routeKey?: string;
  category?: string;
  outcome: string;
  marginImpactPct?: number | null;
  deliveryVarianceDays?: number | null;
  costVariancePct?: number | null;
  region?: string;
  eventType: string;
  createdAt?: Date;
}

@Injectable()
export class AnonymizationService {
  anonymize(event: Record<string, any>): AnonymizedEvent {
    const tenantHash = event.tenantId
      ? createHash('sha256').update(event.tenantId).digest('hex')
      : event.tenantHash ?? '';

    return {
      tenantHash,
      clientId: null,
      userId: null,
      supplierCode: event.supplierCode ?? undefined,
      routeKey: event.routeKey ?? undefined,
      category: event.category ?? undefined,
      outcome: event.outcome ?? 'success',
      marginImpactPct: event.marginImpactPct ?? null,
      deliveryVarianceDays: event.deliveryVarianceDays ?? null,
      costVariancePct: event.costVariancePct ?? null,
      region: event.region ?? undefined,
      eventType: event.eventType ?? '',
      createdAt: event.createdAt ?? undefined,
    };
  }

  validateCrossTenant(tenantId: string, targetTenantId: string): boolean {
    return tenantId !== targetTenantId;
  }
}
