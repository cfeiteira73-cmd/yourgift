import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as https from 'https';

/**
 * BetterStackService
 *
 * Sends heartbeat pings to BetterStack Uptime every 60 seconds.
 * If the ping stops, BetterStack alerts the team (Slack, email, PagerDuty).
 *
 * Setup:
 *  1. Create a "Heartbeat" monitor at betterstack.com/logs → Heartbeat
 *  2. Copy the heartbeat URL (https://uptime.betterstack.com/api/v1/heartbeat/TOKEN)
 *  3. Add to Render: BETTERSTACK_HEARTBEAT_URL=https://uptime.betterstack.com/...
 *
 * Also used for structured log ingestion via Logtail (if configured).
 */
@Injectable()
export class BetterStackService implements OnModuleInit {
  private readonly logger = new Logger(BetterStackService.name);
  private readonly heartbeatUrl: string | null;
  private intervalId: NodeJS.Timeout | null = null;
  private readonly INTERVAL_MS = 60_000; // 60 seconds

  constructor(private readonly config: ConfigService) {
    this.heartbeatUrl = this.config.get<string>('BETTERSTACK_HEARTBEAT_URL') ?? null;
  }

  onModuleInit() {
    if (!this.heartbeatUrl) {
      this.logger.log('BetterStack heartbeat not configured (BETTERSTACK_HEARTBEAT_URL not set) — skipping');
      return;
    }

    // Send immediately on startup
    this.ping();

    // Then every 60s
    this.intervalId = setInterval(() => this.ping(), this.INTERVAL_MS);
    this.logger.log(`BetterStack heartbeat started — pinging every ${this.INTERVAL_MS / 1000}s`);
  }

  private ping() {
    if (!this.heartbeatUrl) return;

    const req = https.get(this.heartbeatUrl, (res) => {
      if (res.statusCode === 200) {
        this.logger.debug('BetterStack heartbeat ✓');
      } else {
        this.logger.warn(`BetterStack heartbeat returned ${res.statusCode}`);
      }
    });

    req.on('error', (err) => {
      this.logger.warn(`BetterStack heartbeat failed: ${err.message}`);
    });

    req.setTimeout(5000, () => {
      req.destroy();
      this.logger.warn('BetterStack heartbeat timed out');
    });
  }

  onModuleDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
