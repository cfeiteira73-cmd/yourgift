import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ProofRecordParams {
  decisionCardId?: string;
  traceId?: string;
  tenantHash?: string;
  savedCostEur: number;
  avoidedCostEur: number;
  marginImpactEur: number;
  timeSavedHours: number;
  timeSavedValueEur: number;
  category?: string;
  supplierCode?: string;
  region?: string;
  source?: string;
}

export interface CFOReport {
  period: string;
  totalSavedEur: number;
  totalAvoidedEur: number;
  totalMarginImpactEur: number;
  totalTimeSavedHours: number;
  totalTimeSavedValueEur: number;
  totalValueEur: number;
  recordCount: number;
}

export interface ValueSummary {
  allTime: { totalValueEur: number; savedCostEur: number; avoidedCostEur: number; marginImpactEur: number; timeSavedHours: number; timeSavedValueEur: number; recordCount: number };
  last30Days: { totalValueEur: number; recordCount: number };
  last90Days: { totalValueEur: number; recordCount: number };
  byCategory: Array<{ category: string; totalValueEur: number; recordCount: number }>;
  bySupplier: Array<{ supplierCode: string; totalValueEur: number; savedCostEur: number }>;
  monthlyTrend: CFOReport[];
  avgValuePerDecision: number;
  proofROI: number; // totalValueEur / platform_cost_estimate * 100
}

@Injectable()
export class ProofEngineService {
  private get db(): any { return this.prisma; }

  constructor(private readonly prisma: PrismaService) {}

  async recordProof(params: ProofRecordParams): Promise<any> {
    const period = new Date().toISOString().slice(0, 7); // YYYY-MM
    const totalValueEur = params.savedCostEur + params.avoidedCostEur + params.marginImpactEur + params.timeSavedValueEur;

    return this.db.proofRecord.create({
      data: {
        decisionCardId: params.decisionCardId ?? null,
        traceId: params.traceId ?? null,
        tenantHash: params.tenantHash ?? 'global',
        savedCostEur: params.savedCostEur,
        avoidedCostEur: params.avoidedCostEur,
        marginImpactEur: params.marginImpactEur,
        timeSavedHours: params.timeSavedHours,
        timeSavedValueEur: params.timeSavedValueEur,
        totalValueEur,
        category: params.category ?? null,
        supplierCode: params.supplierCode ?? null,
        region: params.region ?? null,
        period,
        source: params.source ?? 'decision_engine',
      },
    });
  }

  async getCFOReport(period?: string): Promise<CFOReport[]> {
    const records: any[] = await this.db.proofRecord.findMany(
      period ? { where: { period } } : {},
    );

    const grouped = new Map<string, CFOReport>();

    for (const r of records) {
      const p = r.period;
      const existing = grouped.get(p);
      if (existing) {
        existing.totalSavedEur += Number(r.savedCostEur);
        existing.totalAvoidedEur += Number(r.avoidedCostEur);
        existing.totalMarginImpactEur += Number(r.marginImpactEur);
        existing.totalTimeSavedHours += Number(r.timeSavedHours);
        existing.totalTimeSavedValueEur += Number(r.timeSavedValueEur);
        existing.totalValueEur += Number(r.totalValueEur);
        existing.recordCount += 1;
      } else {
        grouped.set(p, {
          period: p,
          totalSavedEur: Number(r.savedCostEur),
          totalAvoidedEur: Number(r.avoidedCostEur),
          totalMarginImpactEur: Number(r.marginImpactEur),
          totalTimeSavedHours: Number(r.timeSavedHours),
          totalTimeSavedValueEur: Number(r.timeSavedValueEur),
          totalValueEur: Number(r.totalValueEur),
          recordCount: 1,
        });
      }
    }

    return Array.from(grouped.values()).sort((a, b) => a.period.localeCompare(b.period));
  }

  async getValueSummary(): Promise<ValueSummary> {
    const now = new Date();
    const ago30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ago90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const [allRecords, recent30, recent90] = await Promise.all([
      this.db.proofRecord.findMany(),
      this.db.proofRecord.findMany({ where: { createdAt: { gte: ago30 } } }),
      this.db.proofRecord.findMany({ where: { createdAt: { gte: ago90 } } }),
    ]);

    const sumField = (recs: any[], field: string) =>
      recs.reduce((s: number, r: any) => s + Number(r[field]), 0);

    const allTime = {
      totalValueEur: Math.round(sumField(allRecords, 'totalValueEur') * 100) / 100,
      savedCostEur: Math.round(sumField(allRecords, 'savedCostEur') * 100) / 100,
      avoidedCostEur: Math.round(sumField(allRecords, 'avoidedCostEur') * 100) / 100,
      marginImpactEur: Math.round(sumField(allRecords, 'marginImpactEur') * 100) / 100,
      timeSavedHours: Math.round(sumField(allRecords, 'timeSavedHours') * 10) / 10,
      timeSavedValueEur: Math.round(sumField(allRecords, 'timeSavedValueEur') * 100) / 100,
      recordCount: allRecords.length,
    };

    // By category
    const catMap = new Map<string, { totalValueEur: number; recordCount: number }>();
    for (const r of allRecords) {
      const cat = r.category ?? 'other';
      const ex = catMap.get(cat);
      if (ex) { ex.totalValueEur += Number(r.totalValueEur); ex.recordCount += 1; }
      else catMap.set(cat, { totalValueEur: Number(r.totalValueEur), recordCount: 1 });
    }
    const byCategory = Array.from(catMap.entries())
      .map(([category, data]) => ({ category, ...data, totalValueEur: Math.round(data.totalValueEur * 100) / 100 }))
      .sort((a, b) => b.totalValueEur - a.totalValueEur);

    // By supplier
    const supMap = new Map<string, { totalValueEur: number; savedCostEur: number }>();
    for (const r of allRecords) {
      const sup = r.supplierCode ?? 'other';
      const ex = supMap.get(sup);
      if (ex) { ex.totalValueEur += Number(r.totalValueEur); ex.savedCostEur += Number(r.savedCostEur); }
      else supMap.set(sup, { totalValueEur: Number(r.totalValueEur), savedCostEur: Number(r.savedCostEur) });
    }
    const bySupplier = Array.from(supMap.entries())
      .map(([supplierCode, data]) => ({ supplierCode, totalValueEur: Math.round(data.totalValueEur * 100) / 100, savedCostEur: Math.round(data.savedCostEur * 100) / 100 }))
      .sort((a, b) => b.totalValueEur - a.totalValueEur);

    const monthlyTrend = await this.getCFOReport();
    const avgValuePerDecision = allRecords.length > 0 ? Math.round(allTime.totalValueEur / allRecords.length * 100) / 100 : 0;
    // Estimated platform cost: €2,000/month × 3 months
    const platformCost = 6000;
    const proofROI = platformCost > 0 ? Math.round((allTime.totalValueEur / platformCost) * 100) : 0;

    return {
      allTime,
      last30Days: {
        totalValueEur: Math.round(sumField(recent30, 'totalValueEur') * 100) / 100,
        recordCount: recent30.length,
      },
      last90Days: {
        totalValueEur: Math.round(sumField(recent90, 'totalValueEur') * 100) / 100,
        recordCount: recent90.length,
      },
      byCategory,
      bySupplier,
      monthlyTrend,
      avgValuePerDecision,
      proofROI,
    };
  }

  async getRecentProofRecords(limit = 20): Promise<any[]> {
    return this.db.proofRecord.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
