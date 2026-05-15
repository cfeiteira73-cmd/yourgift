import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { MidoceanClient } from '@yourgift/midocean';

@Injectable()
export class HealthService {
  private midocean: MidoceanClient;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.midocean = new MidoceanClient(this.config.getOrThrow('MIDOCEAN_KEY'));
  }

  async check() {
    const start = Date.now();

    const [db, midocean] = await Promise.allSettled([
      this.prisma.$queryRaw`SELECT 1`,
      this.midocean.ping(),
    ]);

    return {
      status: db.status === 'fulfilled' ? 'ok' : 'degraded',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? '1.0.0',
      services: {
        database: db.status === 'fulfilled' ? 'ok' : 'down',
        midocean: midocean.status === 'fulfilled' && midocean.value ? 'ok' : 'down',
      },
      latencyMs: Date.now() - start,
    };
  }
}
