import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';

// ─── public interfaces ────────────────────────────────────────────────────────

export interface InitiateUploadResult {
  artworkId: string;
  uploadUrl: string;
  s3Key: string;
}

// ─── service ─────────────────────────────────────────────────────────────────

@Injectable()
export class ArtworkService {
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly region: string;
  private readonly cloudfrontUrl: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly events: EventBusService,
  ) {
    this.region = config.get<string>('AWS_REGION', 'eu-west-1');
    this.bucket = config.getOrThrow<string>('S3_BUCKET');
    this.cloudfrontUrl = config.get<string>('CLOUDFRONT_URL', '');

    this.s3 = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: config.getOrThrow<string>('AWS_ACCESS_KEY_ID'),
        secretAccessKey: config.getOrThrow<string>('AWS_SECRET_ACCESS_KEY'),
      },
    });
  }

  // ── initiateUpload ────────────────────────────────────────────────────────
  // Generates a presigned S3 PUT URL and creates the Artwork record (status=pending)

  async initiateUpload(
    orderId: string,
    filename: string,
    mimeType: string,
    sizeBytes: number,
  ): Promise<InitiateUploadResult> {
    // Confirm order exists
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException(`Order ${orderId} not found`);

    const s3Key = this.generateS3Key(orderId, filename);
    const uploadUrl = await this.getPresignedUrl(s3Key, mimeType);

    const artwork = await this.prisma.artwork.create({
      data: {
        orderId,
        filename,
        s3Key,
        originalUrl: '', // filled on confirmUpload
        mimeType,
        sizeBytes,
        status: 'pending',
      },
    });

    await this.logEvent(artwork.id, 'artwork.initiated', null, {
      orderId,
      filename,
      mimeType,
      sizeBytes,
    });

    return { artworkId: artwork.id, uploadUrl, s3Key };
  }

  // ── confirmUpload ─────────────────────────────────────────────────────────
  // Called after the client finishes the direct S3 upload

  async confirmUpload(artworkId: string) {
    const artwork = await this.assertArtwork(artworkId);

    if (artwork.status !== 'pending') {
      throw new BadRequestException(
        `Artwork ${artworkId} is already in status "${artwork.status}"`,
      );
    }

    const originalUrl = this.cloudfrontUrl
      ? `${this.cloudfrontUrl}/${artwork.s3Key}`
      : `https://${this.bucket}.s3.${this.region}.amazonaws.com/${artwork.s3Key}`;

    const updated = await this.prisma.artwork.update({
      where: { id: artworkId },
      data: { status: 'uploaded', originalUrl },
    });

    await this.logEvent(artworkId, 'artwork.uploaded', null, { originalUrl });
    this.events.emit('artwork.uploaded', updated);

    return updated;
  }

  // ── getForOrder ───────────────────────────────────────────────────────────

  async getForOrder(orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException(`Order ${orderId} not found`);

    return this.prisma.artwork.findMany({
      where: { orderId },
      orderBy: { uploadedAt: 'asc' },
    });
  }

  // ── requestRevision ───────────────────────────────────────────────────────

  async requestRevision(artworkId: string, notes: string, reviewerId: string) {
    const artwork = await this.assertArtwork(artworkId);

    if (!['uploaded', 'approved'].includes(artwork.status)) {
      throw new BadRequestException(
        `Cannot request revision on artwork with status "${artwork.status}"`,
      );
    }

    const updated = await this.prisma.artwork.update({
      where: { id: artworkId },
      data: {
        status: 'revision_requested',
        reviewNotes: notes,
        reviewedAt: new Date(),
        reviewedById: reviewerId,
      },
    });

    await this.logEvent(artworkId, 'artwork.revision_requested', reviewerId, { notes });
    this.events.emit('artwork.revision_requested', updated);

    return updated;
  }

  // ── approve ───────────────────────────────────────────────────────────────

  async approve(artworkId: string, reviewerId: string) {
    const artwork = await this.assertArtwork(artworkId);

    if (!['uploaded', 'revision_requested'].includes(artwork.status)) {
      throw new BadRequestException(
        `Cannot approve artwork with status "${artwork.status}"`,
      );
    }

    const updated = await this.prisma.artwork.update({
      where: { id: artworkId },
      data: {
        status: 'approved',
        reviewedAt: new Date(),
        reviewedById: reviewerId,
      },
    });

    await this.logEvent(artworkId, 'artwork.approved', reviewerId, {
      orderId: artwork.orderId,
    });
    this.events.emit('artwork.approved', updated);

    // Check if ALL artworks for the order are approved
    await this.checkOrderArtworkCompletion(artwork.orderId);

    return updated;
  }

  // ── reject ────────────────────────────────────────────────────────────────

  async reject(artworkId: string, notes: string, reviewerId: string) {
    const artwork = await this.assertArtwork(artworkId);

    if (!['uploaded', 'revision_requested'].includes(artwork.status)) {
      throw new BadRequestException(
        `Cannot reject artwork with status "${artwork.status}"`,
      );
    }

    const updated = await this.prisma.artwork.update({
      where: { id: artworkId },
      data: {
        status: 'rejected',
        reviewNotes: notes,
        reviewedAt: new Date(),
        reviewedById: reviewerId,
      },
    });

    await this.logEvent(artworkId, 'artwork.rejected', reviewerId, { notes });
    this.events.emit('artwork.rejected', updated);

    return updated;
  }

  // ── saveMockup ────────────────────────────────────────────────────────────

  async saveMockup(artworkId: string, mockupUrl: string) {
    await this.assertArtwork(artworkId);

    const updated = await this.prisma.artwork.update({
      where: { id: artworkId },
      data: { mockupUrl },
    });

    await this.logEvent(artworkId, 'artwork.mockup_saved', null, { mockupUrl });
    return updated;
  }

  // ── private: generate S3 key ──────────────────────────────────────────────

  private generateS3Key(orderId: string, filename: string): string {
    return `artworks/${orderId}/${Date.now()}-${filename}`;
  }

  // ── private: get presigned URL ────────────────────────────────────────────

  private async getPresignedUrl(s3Key: string, mimeType: string): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: s3Key,
      ContentType: mimeType,
    });

    return getSignedUrl(this.s3, command, { expiresIn: 600 });
  }

  // ── private: assert artwork exists ────────────────────────────────────────

  private async assertArtwork(artworkId: string) {
    const artwork = await this.prisma.artwork.findUnique({ where: { id: artworkId } });
    if (!artwork) throw new NotFoundException(`Artwork ${artworkId} not found`);
    return artwork;
  }

  // ── private: check if order is fully artwork-approved ─────────────────────

  private async checkOrderArtworkCompletion(orderId: string): Promise<void> {
    const artworks = await this.prisma.artwork.findMany({ where: { orderId } });

    if (artworks.length === 0) return;

    const allApproved = artworks.every((a) => a.status === 'approved');
    if (allApproved) {
      await this.prisma.eventLog.create({
        data: {
          entity: 'order',
          entityId: orderId,
          event: 'order.artwork_approved',
          actorId: null,
          actorType: 'system',
          payload: JSON.parse(JSON.stringify({ artworkCount: artworks.length })) as Prisma.InputJsonValue,
          orderId,
        },
      });
      this.events.emit('order.artwork_approved', { orderId, artworkCount: artworks.length });
    }
  }

  // ── private: event log ────────────────────────────────────────────────────

  private async logEvent(
    artworkId: string,
    event: string,
    actorId: string | null,
    payload: Prisma.InputJsonValue,
  ): Promise<void> {
    await this.prisma.eventLog.create({
      data: {
        entity: 'artwork',
        entityId: artworkId,
        event,
        actorId,
        actorType: actorId ? 'user' : 'system',
        payload,
        orderId: null,
      },
    });
  }
}
