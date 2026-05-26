import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface RiskFactors {
  loginFrequency: number;    // 0–30 pts
  unknownDevice: number;     // 0–20 pts
  ipInconsistency: number;   // 0–25 pts
  providerRisk: number;      // 0–15 pts
  recentFailures: number;    // 0–10 pts
}

export interface RiskAssessment {
  riskScore: number;
  riskLevel: 'allow' | 'step_up' | 'reauth' | 'block';
  action: 'allow' | 'step_up' | 'reauth' | 'block';
  factors: RiskFactors;
  blocked: boolean;
}

const PROVIDER_RISK: Record<string, number> = {
  google: 0,
  apple: 0,
  magic_link: 5,
  password: 10,
  unknown: 15,
};

@Injectable()
export class AuthRiskService {
  private get db(): any { return this.prisma; }

  constructor(private readonly prisma: PrismaService) {}

  async assess(params: {
    clientId?: string;
    email?: string;
    ip?: string;
    deviceId?: string;
    provider?: string;
  }): Promise<RiskAssessment> {
    const factors: RiskFactors = {
      loginFrequency: 0,
      unknownDevice: 0,
      ipInconsistency: 0,
      providerRisk: 0,
      recentFailures: 0,
    };

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    // Factor 1: Login frequency from same IP (brute-force signal)
    if (params.ip) {
      const ipCount = await this.db.authAuditLog.count({
        where: { ip: params.ip, createdAt: { gte: oneHourAgo } },
      });
      if (ipCount > 20) factors.loginFrequency = 30;
      else if (ipCount > 10) factors.loginFrequency = 20;
      else if (ipCount > 5) factors.loginFrequency = 10;
    }

    // Factor 2: Unknown device (not in DeviceSession for this client)
    if (params.clientId && params.deviceId) {
      const knownDevice = await this.db.deviceSession.findFirst({
        where: { clientId: params.clientId, deviceId: params.deviceId },
      });
      if (!knownDevice) factors.unknownDevice = 20;
    } else if (params.clientId && !params.deviceId) {
      factors.unknownDevice = 10; // no device ID — partial unknown
    }

    // Factor 3: IP inconsistency (vs last known IP for this client)
    if (params.clientId && params.ip) {
      const lastEvent = await this.db.authAuditLog.findFirst({
        where: { clientId: params.clientId, success: true },
        orderBy: { createdAt: 'desc' },
        select: { ip: true },
      });
      if (lastEvent?.ip && lastEvent.ip !== params.ip) {
        // Different IP — check if same /24 subnet
        const lastPrefix = lastEvent.ip.split('.').slice(0, 3).join('.');
        const currentPrefix = params.ip.split('.').slice(0, 3).join('.');
        if (lastPrefix !== currentPrefix) factors.ipInconsistency = 25;
        else factors.ipInconsistency = 5; // same subnet, minor risk
      }
    }

    // Factor 4: Provider risk score
    factors.providerRisk = PROVIDER_RISK[params.provider ?? 'unknown'] ?? 15;

    // Factor 5: Recent failures (failed logins in last 15 min)
    if (params.ip || params.email) {
      const fifteenAgo = new Date(Date.now() - 15 * 60 * 1000);
      const failures = await this.db.authAuditLog.count({
        where: {
          ...(params.ip ? { ip: params.ip } : {}),
          ...(params.email ? { email: params.email } : {}),
          success: false,
          createdAt: { gte: fifteenAgo },
        },
      });
      if (failures > 5) factors.recentFailures = 10;
      else if (failures > 2) factors.recentFailures = 5;
    }

    const riskScore = Math.min(100,
      factors.loginFrequency +
      factors.unknownDevice +
      factors.ipInconsistency +
      factors.providerRisk +
      factors.recentFailures
    );

    let riskLevel: RiskAssessment['riskLevel'];
    if (riskScore < 40) riskLevel = 'allow';
    else if (riskScore < 70) riskLevel = 'step_up';
    else if (riskScore < 90) riskLevel = 'reauth';
    else riskLevel = 'block';

    const assessment: RiskAssessment = {
      riskScore,
      riskLevel,
      action: riskLevel,
      factors,
      blocked: riskLevel === 'block',
    };

    // Record risk event asynchronously
    this.recordRiskEvent({ ...params, assessment }).catch(() => {});

    return assessment;
  }

  private async recordRiskEvent(params: {
    clientId?: string;
    email?: string;
    ip?: string;
    deviceId?: string;
    provider?: string;
    assessment: RiskAssessment;
  }): Promise<void> {
    try {
      await this.db.authRiskEvent.create({
        data: {
          clientId: params.clientId ?? null,
          email: params.email ?? null,
          ip: params.ip ?? null,
          deviceId: params.deviceId ?? null,
          riskScore: params.assessment.riskScore,
          riskLevel: params.assessment.riskLevel,
          factors: params.assessment.factors as unknown as object,
          action: params.assessment.action,
          provider: params.provider ?? null,
        },
      });
    } catch { }
  }

  async getRecentHighRisk(limit = 20): Promise<any[]> {
    return this.db.authRiskEvent.findMany({
      where: { riskScore: { gte: 40 } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
