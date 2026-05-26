import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { randomUUID, createHash } from 'crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { EventBusService } from '../../events/event-bus.service';

// ── GDPR data export types ────────────────────────────────────────────────────

export interface GdprDataExport {
  exportedAt: string;
  requestId: string;
  subject: string;
  data: {
    profile: Record<string, unknown> | null;
    orders: unknown[];
    authAuditLogs: unknown[];
    authAttempts: unknown[];
    deviceSessions: unknown[];
    activeSessions: unknown[];
  };
}

export interface GdprErasureResult {
  erased: string[];
  retained: Array<{ table: string; reason: string }>;
}

export interface GdprPendingProcessResult {
  processed: number;
  errors: number;
}

export interface CreateGdprRequestInput {
  requestType: 'erasure' | 'portability' | 'access' | 'rectification';
  subjectEmail: string;
  tenantId?: string;
  legalBasis?: string;
  notes?: string;
}

export interface PlaceHoldInput {
  subjectEmail: string;
  scope: string;
  reason: string;
  placedBy: string;
  tenantId?: string;
  requestId?: string;
  expiresAt?: Date;
}

export interface GdprFilters {
  status?: string;
  requestType?: string;
  tenantId?: string;
  limit?: number;
  offset?: number;
}

@Injectable()
export class GdprService {
  private readonly logger = new Logger(GdprService.name);
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly eventBus: EventBusService,
  ) {
    this.bucket = this.config.get<string>('AWS_S3_BUCKET') ?? 'yourgift-exports';
    this.s3 = new S3Client({
      region: this.config.get<string>('AWS_REGION') ?? 'eu-west-1',
      credentials: {
        accessKeyId: this.config.get<string>('AWS_ACCESS_KEY_ID') ?? '',
        secretAccessKey: this.config.get<string>('AWS_SECRET_ACCESS_KEY') ?? '',
      },
    });
  }

  async createRequest(input: CreateGdprRequestInput): Promise<unknown> {
    const request = await this.prisma.gdprRequest.create({
      data: {
        requestType: input.requestType,
        subjectEmail: input.subjectEmail,
        tenantId: input.tenantId ?? null,
        legalBasis: input.legalBasis ?? null,
        notes: input.notes ?? null,
        status: 'pending',
        acknowledgedAt: new Date(),
      },
    });

    this.logger.log(
      `GDPR ${input.requestType} request created: ${request.id} for ${input.subjectEmail}`,
    );
    return request;
  }

  // ── Automated DSR Pipeline (Article 15 / Article 17) ───────────────────────

  /**
   * Process a GDPR Subject Access Request (Article 15 — Right of Access).
   * Returns all PII data held for the requestor within 30 days (automated: immediate).
   */
  async processAccessRequest(requestId: string): Promise<GdprDataExport> {
    const request = await this.prisma.gdprRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException(`GDPR request ${requestId} not found`);
    if (request.status !== 'pending') {
      throw new BadRequestException(`Request ${requestId} is not in pending status (current: ${request.status})`);
    }

    await this.prisma.gdprRequest.update({
      where: { id: requestId },
      data: { status: 'processing', processedAt: new Date() },
    });

    const client = await this.prisma.client.findFirst({
      where: { email: request.subjectEmail },
    });

    const [orders, authAuditLogs, authAttempts, deviceSessions, activeSessions] = await Promise.all([
      client
        ? this.prisma.order.findMany({
            where: { clientId: client.id },
            include: { items: true },
          }).catch(() => [])
        : Promise.resolve([]),
      this.prisma.authAuditLog
        .findMany({
          where: {
            OR: [
              ...(client ? [{ clientId: client.id }] : []),
              { email: request.subjectEmail },
            ],
          },
          orderBy: { createdAt: 'desc' },
          take: 200,
        })
        .catch(() => []),
      client
        ? this.prisma.authAttempt
            .findMany({ where: { clientId: client.id }, orderBy: { createdAt: 'desc' }, take: 100 })
            .catch(() => [])
        : Promise.resolve([]),
      client
        ? this.prisma.deviceSession.findMany({ where: { clientId: client.id } }).catch(() => [])
        : Promise.resolve([]),
      client
        ? this.prisma.activeSession.findMany({ where: { clientId: client.id } }).catch(() => [])
        : Promise.resolve([]),
    ]);

    const exportData: GdprDataExport = {
      exportedAt: new Date().toISOString(),
      requestId,
      subject: request.subjectEmail,
      data: {
        profile: client
          ? { id: client.id, email: client.email, name: client.name, nif: client.nif, createdAt: client.createdAt }
          : null,
        orders: orders.map((o) => ({
          id: o.id,
          ref: o.ref,
          status: o.status,
          totalAmount: o.totalAmount,
          createdAt: o.createdAt,
          items: o.items.length,
        })),
        authAuditLogs: authAuditLogs.map((l) => ({
          id: l.id,
          action: l.action,
          success: l.success,
          ip: l.ip,
          createdAt: l.createdAt,
        })),
        authAttempts: authAttempts.map((a) => ({
          id: a.id,
          provider: a.provider,
          status: a.status,
          createdAt: a.createdAt,
        })),
        deviceSessions: deviceSessions.map((d) => ({
          id: d.id,
          deviceId: d.deviceId,
          userAgent: d.userAgent,
          ip: d.ip,
          lastSeenAt: d.lastSeenAt,
          createdAt: d.createdAt,
        })),
        activeSessions: activeSessions.map((s) => ({
          id: s.id,
          deviceId: s.deviceId,
          provider: s.provider,
          ip: s.ip,
          isActive: s.isActive,
          lastActivityAt: s.lastActivityAt,
          createdAt: s.createdAt,
        })),
      },
    };

    const resultSummary = {
      orders: orders.length,
      authAuditLogs: authAuditLogs.length,
      authAttempts: authAttempts.length,
      deviceSessions: deviceSessions.length,
      activeSessions: activeSessions.length,
    };

    await this.prisma.gdprRequest.update({
      where: { id: requestId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        completedBy: 'system',
        metadata: resultSummary as unknown as object,
      },
    });

    this.eventBus.emit('gdpr.access_request.completed', { requestId, subject: request.subjectEmail, resultSummary });
    this.logger.log(`GDPR access request ${requestId} completed for ${request.subjectEmail}`);

    return exportData;
  }

  /**
   * Process a GDPR Erasure Request (Article 17 — Right to be Forgotten).
   * Anonymizes all PII. Preserves financial records (legal obligation).
   */
  async processErasureRequestFull(requestId: string): Promise<GdprErasureResult> {
    const request = await this.prisma.gdprRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException(`GDPR request ${requestId} not found`);
    if (request.status !== 'pending') {
      throw new BadRequestException(`Request ${requestId} is not in pending status (current: ${request.status})`);
    }

    // Check for active legal holds
    const hold = await this.checkLegalHold(request.subjectEmail);
    if (hold) {
      throw new BadRequestException(
        `Cannot erase: active legal hold in place for ${request.subjectEmail}`,
      );
    }

    await this.prisma.gdprRequest.update({
      where: { id: requestId },
      data: { status: 'processing', processedAt: new Date() },
    });

    const erased: string[] = [];
    const retained: Array<{ table: string; reason: string }> = [];

    const client = await this.prisma.client.findFirst({ where: { email: request.subjectEmail } });

    if (client) {
      // Anonymize client PII — do NOT delete (preserve foreign key integrity)
      const anonymizedEmail = `erased-${createHash('sha256').update(client.email).digest('hex').slice(0, 16)}@deleted.yourgift.pt`;
      await this.prisma.client.update({
        where: { id: client.id },
        data: {
          name: 'ANONYMIZED',
          email: anonymizedEmail,
          nif: null,
          passwordHash: null,
        },
      });
      erased.push('clients (PII anonymized)');

      // Delete auth attempts (keyed by clientId)
      await this.prisma.authAttempt
        .deleteMany({ where: { clientId: client.id } })
        .catch(() => null);
      erased.push('auth_attempts');

      // Delete device sessions
      await this.prisma.deviceSession
        .deleteMany({ where: { clientId: client.id } })
        .catch(() => null);
      erased.push('device_sessions');

      // Delete active sessions
      await this.prisma.activeSession
        .deleteMany({ where: { clientId: client.id } })
        .catch(() => null);
      erased.push('active_sessions');

      // Purge old auth audit logs (keep last 30 days for security audit trail requirement)
      const retentionCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      await this.prisma.authAuditLog
        .deleteMany({
          where: {
            clientId: client.id,
            createdAt: { lt: retentionCutoff },
          },
        })
        .catch(() => null);
      erased.push('auth_audit_logs (older than 30 days)');
    }

    // RETAIN financial records — 7 year legal requirement
    retained.push({ table: 'orders', reason: 'Financial record — 7-year legal retention (AML/VAT)' });
    retained.push({ table: 'ledger_entries', reason: 'Financial record — 7-year legal retention (AML/VAT)' });
    retained.push({ table: 'invoices', reason: 'Financial record — 7-year legal retention (AML/VAT)' });

    await this.prisma.gdprRequest.update({
      where: { id: requestId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        completedBy: 'system',
        metadata: { erased, retained } as unknown as object,
      },
    });

    this.eventBus.emit('gdpr.erasure_request.completed', { requestId, subject: request.subjectEmail, erased, retained });
    this.logger.log(`GDPR erasure request ${requestId} completed: ${erased.length} tables erased, ${retained.length} retained`);

    return { erased, retained };
  }

  /**
   * Auto-process pending requests older than 24h.
   * Called by the scheduler / cron job.
   */
  async processPendingRequests(): Promise<GdprPendingProcessResult> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const pending = await this.prisma.gdprRequest.findMany({
      where: { status: 'pending', requestedAt: { lte: cutoff } },
      take: 50,
    });

    let processed = 0;
    let errors = 0;

    for (const req of pending) {
      try {
        if (req.requestType === 'access') {
          await this.processAccessRequest(req.id);
        } else if (req.requestType === 'erasure') {
          await this.processErasureRequestFull(req.id);
        } else {
          await this.processRequest(req.id);
        }
        processed++;
      } catch (err) {
        errors++;
        this.logger.error(`Failed to auto-process GDPR request ${req.id}`, (err as Error).message);
        // Mark as failed so it won't be re-queued endlessly
        await this.prisma.gdprRequest
          .update({
            where: { id: req.id },
            data: { status: 'failed', metadata: { error: (err as Error).message } as unknown as object },
          })
          .catch(() => null);
      }
    }

    this.logger.log(`GDPR auto-processing: ${processed} processed, ${errors} errors out of ${pending.length} pending`);
    return { processed, errors };
  }

  // ── Existing processRequest (enhanced routing) ────────────────────────────

  async processRequest(requestId: string): Promise<unknown> {
    const request = await this.prisma.gdprRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundException(`GDPR request ${requestId} not found`);

    await this.prisma.gdprRequest.update({
      where: { id: requestId },
      data: { status: 'processing', processedAt: new Date() },
    });

    switch (request.requestType) {
      case 'erasure':
        return this.processErasureRequest(requestId);
      case 'portability':
        return this.processPortabilityRequest(requestId);
      default:
        return this.prisma.gdprRequest.update({
          where: { id: requestId },
          data: { status: 'completed', completedAt: new Date(), completedBy: 'system' },
        });
    }
  }

  async processErasureRequest(requestId: string): Promise<unknown> {
    const request = await this.prisma.gdprRequest.findUniqueOrThrow({ where: { id: requestId } });

    // Check for active legal holds
    const hold = await this.checkLegalHold(request.subjectEmail);
    if (hold) {
      throw new BadRequestException(
        `Cannot erase: active legal hold (${(hold as { id: string }).id}) in place for ${request.subjectEmail}`,
      );
    }

    const client = await this.prisma.client.findFirst({
      where: { email: request.subjectEmail },
    });

    if (client) {
      const erasedEmail = `erased-${randomUUID()}@deleted.yourgift.pt`;
      await this.prisma.client.update({
        where: { id: client.id },
        data: {
          name: 'ERASED',
          email: erasedEmail,
          nif: null,
          passwordHash: null,
        },
      });
      this.logger.log(`GDPR erasure: client ${client.id} anonymised`);
    }

    return this.prisma.gdprRequest.update({
      where: { id: requestId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        completedBy: 'system',
        metadata: { erasedClientId: client?.id ?? null } as object,
      },
    });
  }

  async processPortabilityRequest(requestId: string): Promise<unknown> {
    const request = await this.prisma.gdprRequest.findUniqueOrThrow({ where: { id: requestId } });

    const client = await this.prisma.client.findFirst({
      where: { email: request.subjectEmail },
    });

    const [orders, quotes] = await Promise.all([
      client
        ? this.prisma.order.findMany({
            where: { clientId: client.id },
            include: { items: true },
          })
        : [],
      client
        ? this.prisma.quote.findMany({ where: { clientId: client.id } })
        : [],
    ]);

    const exportData = {
      exportedAt: new Date().toISOString(),
      subject: request.subjectEmail,
      requestId,
      data: {
        profile: client
          ? { id: client.id, email: client.email, name: client.name, createdAt: client.createdAt }
          : null,
        orders: orders.map((o) => ({
          id: o.id,
          ref: o.ref,
          status: o.status,
          totalAmount: o.totalAmount,
          createdAt: o.createdAt,
          items: o.items.length,
        })),
        quotes: quotes.map((q) => ({
          id: q.id,
          status: q.status,
          createdAt: q.createdAt,
        })),
      },
    };

    const exportKey = `gdpr-exports/${requestId}/${randomUUID()}.json`;
    const body = JSON.stringify(exportData, null, 2);

    let exportUrl: string | null = null;

    try {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: exportKey,
          Body: body,
          ContentType: 'application/json',
          ServerSideEncryption: 'AES256',
        }),
      );

      const cdnDomain = this.config.get<string>('CLOUDFRONT_DOMAIN');
      exportUrl = cdnDomain
        ? `https://${cdnDomain}/${exportKey}`
        : `s3://${this.bucket}/${exportKey}`;
    } catch (err) {
      this.logger.error(`GDPR portability S3 upload failed for ${requestId}`, (err as Error).message);
    }

    return this.prisma.gdprRequest.update({
      where: { id: requestId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        completedBy: 'system',
        exportUrl,
      },
    });
  }

  async placeHold(input: PlaceHoldInput): Promise<unknown> {
    return this.prisma.legalHold.create({
      data: {
        subjectEmail: input.subjectEmail,
        scope: input.scope,
        reason: input.reason,
        placedBy: input.placedBy,
        tenantId: input.tenantId ?? null,
        requestId: input.requestId ?? null,
        expiresAt: input.expiresAt ?? null,
        isActive: true,
      },
    });
  }

  async releaseHold(holdId: string, releasedBy: string): Promise<unknown> {
    return this.prisma.legalHold.update({
      where: { id: holdId },
      data: {
        isActive: false,
        releasedAt: new Date(),
        releasedBy,
      },
    });
  }

  async checkLegalHold(subjectEmail: string): Promise<unknown | null> {
    return this.prisma.legalHold.findFirst({
      where: {
        subjectEmail,
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gte: new Date() } },
        ],
      },
    });
  }

  async getRequests(filters: GdprFilters): Promise<unknown[]> {
    return this.prisma.gdprRequest.findMany({
      where: {
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.requestType ? { requestType: filters.requestType } : {}),
        ...(filters.tenantId ? { tenantId: filters.tenantId } : {}),
      },
      orderBy: { requestedAt: 'desc' },
      take: filters.limit ?? 50,
      skip: filters.offset ?? 0,
    });
  }

  async getHolds(tenantId?: string): Promise<unknown[]> {
    return this.prisma.legalHold.findMany({
      where: {
        ...(tenantId ? { tenantId } : {}),
      },
      orderBy: { placedAt: 'desc' },
    });
  }

  async getRetentionPolicies(): Promise<unknown[]> {
    return this.prisma.retentionPolicy.findMany({
      orderBy: { entityType: 'asc' },
    });
  }

  async updateRetentionPolicy(entityType: string, retentionDays: number): Promise<unknown> {
    return this.prisma.retentionPolicy.upsert({
      where: { entityType },
      create: {
        entityType,
        retentionDays,
        legalBasis: 'GDPR Art. 5(1)(e)',
        isActive: true,
      },
      update: {
        retentionDays,
        updatedAt: new Date(),
      },
    });
  }
}
