import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ModelRegistryService } from './model-registry.service';

@Injectable()
export class ShadowDeploymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly modelRegistry: ModelRegistryService,
  ) {}

  async startShadow(
    activeVersionId: string,
    shadowVersionId: string,
    purpose: string,
    tenantId?: string,
  ) {
    // Validate both versions exist
    const [active, shadow] = await Promise.all([
      this.prisma.modelVersion.findUnique({ where: { id: activeVersionId } }),
      this.prisma.modelVersion.findUnique({ where: { id: shadowVersionId } }),
    ]);

    if (!active) throw new NotFoundException(`Active version ${activeVersionId} not found`);
    if (!shadow) throw new NotFoundException(`Shadow version ${shadowVersionId} not found`);
    if (active.status !== 'active') {
      throw new BadRequestException(`Version ${activeVersionId} is not active`);
    }

    return this.prisma.shadowDeployment.create({
      data: {
        activeVersionId,
        shadowVersionId,
        purpose,
        status: 'running',
        totalRequests: 0,
        tenantId: tenantId ?? null,
      },
    });
  }

  async recordShadowResult(
    shadowDeploymentId: string,
    agreedWithActive: boolean,
    latencyDeltaMs: number,
  ) {
    const deployment = await this.prisma.shadowDeployment.findUnique({
      where: { id: shadowDeploymentId },
    });
    if (!deployment) throw new NotFoundException(`ShadowDeployment ${shadowDeploymentId} not found`);
    if (deployment.status !== 'running') {
      throw new BadRequestException(`ShadowDeployment ${shadowDeploymentId} is not running`);
    }

    const newTotal = deployment.totalRequests + 1;
    const prevAgreements = Math.round((deployment.agreementRate ?? 0) * deployment.totalRequests / 100);
    const newAgreements = prevAgreements + (agreedWithActive ? 1 : 0);
    const newAgreementRate = Number(((newAgreements / newTotal) * 100).toFixed(2));

    const prevAvgLatency = deployment.avgLatencyDelta ?? 0;
    const newAvgLatencyDelta = Number(
      (
        (prevAvgLatency * deployment.totalRequests + latencyDeltaMs) /
        newTotal
      ).toFixed(2),
    );

    return this.prisma.shadowDeployment.update({
      where: { id: shadowDeploymentId },
      data: {
        totalRequests: newTotal,
        agreementRate: newAgreementRate,
        avgLatencyDelta: newAvgLatencyDelta,
      },
    });
  }

  async completeShadow(id: string) {
    const deployment = await this.prisma.shadowDeployment.findUnique({ where: { id } });
    if (!deployment) throw new NotFoundException(`ShadowDeployment ${id} not found`);
    if (deployment.status !== 'running') {
      throw new BadRequestException(`ShadowDeployment ${id} is not running`);
    }

    return this.prisma.shadowDeployment.update({
      where: { id },
      data: { status: 'completed', endedAt: new Date() },
    });
  }

  async promote(id: string, notes: string) {
    const deployment = await this.prisma.shadowDeployment.findUnique({ where: { id } });
    if (!deployment) throw new NotFoundException(`ShadowDeployment ${id} not found`);

    await this.prisma.shadowDeployment.update({
      where: { id },
      data: { status: 'promoted', endedAt: new Date(), promotionNotes: notes },
    });

    // Promote the shadow model version to active
    return this.modelRegistry.promote(deployment.shadowVersionId, notes);
  }

  async reject(id: string, reason: string) {
    const deployment = await this.prisma.shadowDeployment.findUnique({ where: { id } });
    if (!deployment) throw new NotFoundException(`ShadowDeployment ${id} not found`);

    return this.prisma.shadowDeployment.update({
      where: { id },
      data: { status: 'rejected', endedAt: new Date(), promotionNotes: reason },
    });
  }

  async getActive() {
    return this.prisma.shadowDeployment.findMany({
      where: { status: 'running' },
      orderBy: { startedAt: 'desc' },
    });
  }
}
