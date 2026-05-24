import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type SystemMode = 'normal' | 'degraded' | 'emergency';

@Injectable()
export class FailsafeService {
  private readonly logger = new Logger(FailsafeService.name);
  private currentMode: SystemMode = 'normal';
  private degradedReason: string | null = null;
  private modeChangedAt: Date = new Date();

  private get db(): any { return this.prisma; }

  constructor(private readonly prisma: PrismaService) {}

  getMode(): SystemMode {
    return this.currentMode;
  }

  getModeInfo(): {
    mode: SystemMode;
    reason: string | null;
    since: Date;
  } {
    return {
      mode: this.currentMode,
      reason: this.degradedReason,
      since: this.modeChangedAt,
    };
  }

  triggerDegradedMode(reason: string): void {
    if (this.currentMode === 'emergency') {
      this.logger.warn(
        'Already in emergency mode — ignoring degraded trigger',
      );
      return;
    }
    this.currentMode = 'degraded';
    this.degradedReason = reason;
    this.modeChangedAt = new Date();
    this.logger.warn(`System entering DEGRADED mode: ${reason}`);
    this.persistSnapshot('degraded', reason).catch(() => {});
  }

  triggerEmergency(reason: string): void {
    this.currentMode = 'emergency';
    this.degradedReason = reason;
    this.modeChangedAt = new Date();
    this.logger.error(`System entering EMERGENCY mode: ${reason}`);
    this.persistSnapshot('emergency', reason).catch(() => {});
  }

  recover(): void {
    const previous = this.currentMode;
    this.currentMode = 'normal';
    this.degradedReason = null;
    this.modeChangedAt = new Date();
    this.logger.log(`System recovered from ${previous} mode`);
    this.persistSnapshot('normal', null).catch(() => {});
  }

  async getLatestSnapshot(): Promise<any | null> {
    try {
      return await this.db.systemHealthSnapshot.findFirst({
        orderBy: { snapshotAt: 'desc' },
      });
    } catch {
      return null;
    }
  }

  private async persistSnapshot(
    mode: SystemMode,
    reason: string | null,
  ): Promise<void> {
    try {
      // Store mode change in the system health snapshot table.
      // We set openAnomalies to reflect severity: emergency=10, degraded=5, normal=0
      const anomalyLevel = mode === 'emergency' ? 10 : mode === 'degraded' ? 5 : 0;
      await this.db.systemHealthSnapshot.create({
        data: {
          openAnomalies: anomalyLevel,
        },
      });
    } catch (err) {
      this.logger.warn(`Failed to persist health snapshot: ${err}`);
    }
  }
}
