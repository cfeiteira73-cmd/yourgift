import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SessionAuthorityService {
  private get db(): any { return this.prisma; }

  constructor(private readonly prisma: PrismaService) {}

  async registerSession(params: {
    clientId: string;
    deviceId?: string;
    ip?: string;
    userAgent?: string;
    provider?: string;
  }): Promise<string> {
    const session = await this.db.activeSession.create({
      data: {
        clientId: params.clientId,
        deviceId: params.deviceId ?? null,
        ip: params.ip ?? null,
        userAgent: params.userAgent ?? null,
        provider: params.provider ?? null,
      },
    });
    return session.id;
  }

  async touchSession(sessionId: string): Promise<void> {
    try {
      await this.db.activeSession.update({
        where: { id: sessionId },
        data: { lastActivityAt: new Date() },
      });
    } catch { }
  }

  async revokeSession(sessionId: string): Promise<void> {
    try {
      await this.db.activeSession.update({
        where: { id: sessionId },
        data: { isActive: false, revokedAt: new Date() },
      });
    } catch { }
  }

  async revokeAllClientSessions(clientId: string): Promise<void> {
    await this.db.activeSession.updateMany({
      where: { clientId, isActive: true },
      data: { isActive: false, revokedAt: new Date() },
    });
  }

  async getActiveSessions(clientId: string): Promise<any[]> {
    return this.db.activeSession.findMany({
      where: { clientId, isActive: true },
      orderBy: { lastActivityAt: 'desc' },
    });
  }

  async detectConcurrentAnomalies(clientId: string): Promise<boolean> {
    const activeSessions = await this.db.activeSession.count({
      where: { clientId, isActive: true },
    });
    // More than 10 concurrent sessions is anomalous
    return activeSessions > 10;
  }

  async getGlobalSessionStats(): Promise<{
    totalActive: number;
    totalRevoked: number;
    uniqueClients: number;
  }> {
    const [totalActive, totalRevoked, activeRaw] = await Promise.all([
      this.db.activeSession.count({ where: { isActive: true } }),
      this.db.activeSession.count({ where: { isActive: false } }),
      this.db.activeSession.findMany({
        where: { isActive: true },
        select: { clientId: true },
        distinct: ['clientId'],
      }),
    ]);
    return { totalActive, totalRevoked, uniqueClients: activeRaw.length };
  }
}
