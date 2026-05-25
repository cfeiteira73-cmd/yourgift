import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateModelVersionDto {
  modelId: string;
  name: string;
  provider: string;
  modelRef: string;
  purpose: string;
  config?: Record<string, unknown>;
  createdBy?: string;
}

export interface ModelVersionStats {
  totalVersions: number;
  activeVersions: number;
  shadowVersions: number;
  driftAlerts: number;
}

@Injectable()
export class ModelRegistryService {
  constructor(private readonly prisma: PrismaService) {}

  async getActive(purpose: string) {
    const version = await this.prisma.modelVersion.findFirst({
      where: { purpose, status: 'active' },
      orderBy: { createdAt: 'desc' },
    });
    if (!version) {
      throw new NotFoundException(`No active model version found for purpose: ${purpose}`);
    }
    return version;
  }

  async listVersions(purpose?: string) {
    return this.prisma.modelVersion.findMany({
      where: purpose ? { purpose } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  async createVersion(data: CreateModelVersionDto) {
    return this.prisma.modelVersion.create({
      data: {
        modelId: data.modelId,
        name: data.name,
        provider: data.provider,
        modelRef: data.modelRef,
        purpose: data.purpose,
        status: 'candidate',
        config: (data.config ?? {}) as Prisma.InputJsonValue,
        createdBy: data.createdBy,
      },
    });
  }

  async promote(id: string, notes?: string) {
    const version = await this.prisma.modelVersion.findUnique({ where: { id } });
    if (!version) throw new NotFoundException(`ModelVersion ${id} not found`);
    if (version.status === 'active') {
      throw new BadRequestException(`ModelVersion ${id} is already active`);
    }

    // Retire current active version for same purpose
    await this.prisma.modelVersion.updateMany({
      where: { purpose: version.purpose, status: 'active' },
      data: { status: 'retired', retiredAt: new Date() },
    });

    return this.prisma.modelVersion.update({
      where: { id },
      data: {
        status: 'active',
        promotedAt: new Date(),
        rollbackReason: notes ?? null,
      },
    });
  }

  async retire(id: string) {
    const version = await this.prisma.modelVersion.findUnique({ where: { id } });
    if (!version) throw new NotFoundException(`ModelVersion ${id} not found`);
    if (version.status === 'retired') {
      throw new BadRequestException(`ModelVersion ${id} is already retired`);
    }
    return this.prisma.modelVersion.update({
      where: { id },
      data: { status: 'retired', retiredAt: new Date() },
    });
  }

  async rollback(id: string, reason: string) {
    const version = await this.prisma.modelVersion.findUnique({ where: { id } });
    if (!version) throw new NotFoundException(`ModelVersion ${id} not found`);

    // Find previous active (most recently promoted before this one)
    const previous = await this.prisma.modelVersion.findFirst({
      where: {
        purpose: version.purpose,
        status: 'retired',
        id: { not: id },
      },
      orderBy: { promotedAt: 'desc' },
    });

    return this.prisma.$transaction(async (tx) => {
      // Mark current as rolled back
      await tx.modelVersion.update({
        where: { id },
        data: {
          status: 'rolled_back',
          rolledBackAt: new Date(),
          rollbackReason: reason,
        },
      });

      // Restore previous if exists
      if (previous) {
        await tx.modelVersion.update({
          where: { id: previous.id },
          data: { status: 'active', promotedAt: new Date(), retiredAt: null },
        });
      }

      return tx.modelVersion.findUnique({ where: { id } });
    });
  }

  async getStats(): Promise<ModelVersionStats> {
    const [totalVersions, activeVersions, shadowVersions, driftAlerts] = await Promise.all([
      this.prisma.modelVersion.count(),
      this.prisma.modelVersion.count({ where: { status: 'active' } }),
      this.prisma.shadowDeployment.count({ where: { status: 'running' } }),
      this.prisma.modelDriftRecord.count({
        where: {
          severity: { in: ['high', 'critical'] },
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    return { totalVersions, activeVersions, shadowVersions, driftAlerts };
  }
}
