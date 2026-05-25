import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

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
