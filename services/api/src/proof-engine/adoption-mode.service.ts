import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type AdoptionMode = 'shadow' | 'assisted' | 'controlled' | 'autonomous';

export const ADOPTION_MODE_LABELS: Record<AdoptionMode, string> = {
  shadow: 'Shadow Mode — Observe & Simulate',
  assisted: 'Assisted Mode — AI Suggests, Human Decides',
  controlled: 'Controlled Execution — Low Risk Auto-Execute',
  autonomous: 'Full Autonomy — Governance-Constrained',
};

export const ADOPTION_MODE_DESCRIPTIONS: Record<AdoptionMode, string> = {
  shadow: 'System observes all procurement, simulates optimal decisions, shows missed savings. Zero risk. Zero execution.',
  assisted: 'System generates Decision Cards for every procurement event. Human approves or rejects. Full reasoning visible.',
  controlled: 'Auto-executes decisions with risk score < 35. Escalates medium/high risk. Requires governance policy compliance.',
  autonomous: 'Executes all decisions within governance constraints. Maximum efficiency. Maximum trust required (composite ≥ 85).',
};

@Injectable()
export class AdoptionModeService {
  private get db(): any { return this.prisma; }

  constructor(private readonly prisma: PrismaService) {}

  async getMode(tenantId: string): Promise<any> {
    let mode = await this.db.tenantAdoptionMode.findUnique({ where: { tenantId } });
    if (!mode) {
      mode = await this.db.tenantAdoptionMode.create({
        data: { tenantId, mode: 'shadow' },
      });
    }
    return mode;
  }

  async setMode(tenantId: string, newMode: AdoptionMode): Promise<any> {
    const existing = await this.getMode(tenantId);
    const history = (existing.modesHistory as any[] ?? []);
    history.push({ mode: newMode, changedAt: new Date().toISOString() });

    return this.db.tenantAdoptionMode.update({
      where: { tenantId },
      data: {
        mode: newMode,
        modesHistory: history as unknown as object,
        updatedAt: new Date(),
      },
    });
  }

  async recordShadowSimulation(tenantId: string, savingsIdentifiedEur: number): Promise<void> {
    const existing = await this.getMode(tenantId);
    await this.db.tenantAdoptionMode.update({
      where: { tenantId },
      data: {
        shadowSimulationsRun: existing.shadowSimulationsRun + 1,
        shadowSavingsIdentifiedEur: Number(existing.shadowSavingsIdentifiedEur) + savingsIdentifiedEur,
        updatedAt: new Date(),
      },
    });
  }

  async getAllModes(): Promise<any[]> {
    return this.db.tenantAdoptionMode.findMany({
      orderBy: { updatedAt: 'desc' },
    });
  }

  getModeInfo(mode: AdoptionMode): { label: string; description: string; autonomyLevel: number } {
    const levels: Record<AdoptionMode, number> = {
      shadow: 0, assisted: 1, controlled: 2, autonomous: 3,
    };
    return {
      label: ADOPTION_MODE_LABELS[mode],
      description: ADOPTION_MODE_DESCRIPTIONS[mode],
      autonomyLevel: levels[mode],
    };
  }
}
