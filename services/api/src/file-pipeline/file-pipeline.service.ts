import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { Prisma } from '@prisma/client';

export interface ValidationResult {
  artworkId: string;
  orderId: string;
  valid: boolean;
  dpi: number;
  format: string;
  fileSizeBytes: number | null;
  widthPx: number | null;
  heightPx: number | null;
  issues: string[];
  autoRepaired: boolean;
  repairResult: string | null;
  rejectionReason: string | null;
}

const ALLOWED_FORMATS = ['image/png', 'image/jpeg', 'image/tiff', 'application/pdf'];
const MIN_DPI = 300;
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

@Injectable()
export class FilePipelineService {
  private readonly logger = new Logger(FilePipelineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  async validateArtwork(artworkId: string): Promise<ValidationResult> {
    const artwork = await this.prisma.artwork.findUnique({ where: { id: artworkId } });
    if (!artwork) throw new NotFoundException(`Artwork ${artworkId} not found`);

    const issues: string[] = [];
    let autoRepaired = false;
    let repairResult: string | null = null;

    // DPI estimation: assume A4 width = 8.27 inches
    const widthPx = artwork.width ?? null;
    const heightPx = artwork.height ?? null;
    const estimatedDpi = widthPx ? Math.round(widthPx / 8.27) : 0;
    const format = artwork.mimeType ?? 'unknown';
    const fileSizeBytes = artwork.sizeBytes ?? null;

    // Validation checks
    if (estimatedDpi < MIN_DPI && estimatedDpi > 0) {
      issues.push(`Estimated DPI too low: ${estimatedDpi} (minimum ${MIN_DPI})`);
    }
    if (estimatedDpi === 0) {
      issues.push('Cannot estimate DPI — width metadata missing');
    }
    if (!ALLOWED_FORMATS.includes(format)) {
      issues.push(`Format not accepted: ${format} (allowed: PNG, JPEG, TIFF, PDF)`);
    }
    if (fileSizeBytes && fileSizeBytes > MAX_FILE_SIZE_BYTES) {
      issues.push(`File too large: ${(fileSizeBytes / 1024 / 1024).toFixed(1)} MB (max 50 MB)`);
    }

    // Auto-repair if ≤2 minor issues (DPI-only or metadata-only)
    const repairableIssues = issues.filter(
      (i) => i.includes('DPI too low') || i.includes('Cannot estimate DPI'),
    );
    if (issues.length > 0 && issues.length <= 2 && repairableIssues.length === issues.length) {
      autoRepaired = true;
      repairResult = 'Flagged for upscaling before production — approved with warning';
      this.logger.warn(`Artwork ${artworkId} auto-repaired: ${repairResult}`);
    }

    const valid = issues.length === 0 || autoRepaired;
    const rejectionReason = !valid ? issues.join('; ') : null;
    const newStatus = valid ? 'approved' : 'rejected';

    // Update artwork status
    await this.prisma.artwork.update({
      where: { id: artworkId },
      data: { status: newStatus },
    });

    // Write validation record via raw SQL
    const colorProfile = 'sRGB'; // default assumption
    try {
      await this.prisma.$executeRaw(
        Prisma.sql`INSERT INTO file_validation_records
          (artwork_id, order_id, format, dpi, width_px, height_px, file_size_bytes, color_profile,
           validation_status, auto_repair_attempted, repair_result, rejection_reason)
          VALUES (${artworkId}, ${artwork.orderId}, ${format}, ${estimatedDpi},
            ${widthPx}, ${heightPx}, ${fileSizeBytes}, ${colorProfile},
            ${newStatus}, ${autoRepaired}, ${repairResult}, ${rejectionReason})`,
      );
    } catch (err) {
      this.logger.warn(`Could not write file_validation_records: ${err}`);
    }

    // EventLog
    await this.prisma.eventLog.create({
      data: {
        entity: 'artwork',
        entityId: artworkId,
        event: valid ? 'artwork.validation.passed' : 'artwork.validation.failed',
        orderId: artwork.orderId,
        payload: { dpi: estimatedDpi, format, issues, autoRepaired } as object,
      },
    });

    this.eventBus.emit('file.validation.completed', { artworkId, orderId: artwork.orderId, valid });

    return {
      artworkId,
      orderId: artwork.orderId,
      valid,
      dpi: estimatedDpi,
      format,
      fileSizeBytes,
      widthPx,
      heightPx,
      issues,
      autoRepaired,
      repairResult,
      rejectionReason,
    };
  }

  async validateAllForOrder(orderId: string): Promise<ValidationResult[]> {
    const artworks = await this.prisma.artwork.findMany({ where: { orderId } });
    if (artworks.length === 0) {
      throw new NotFoundException(`No artworks found for order ${orderId}`);
    }
    return Promise.all(artworks.map((a) => this.validateArtwork(a.id)));
  }

  async getValidationHistory(artworkId: string): Promise<object[]> {
    const rows = await this.prisma.$queryRaw<object[]>(
      Prisma.sql`SELECT * FROM file_validation_records WHERE artwork_id = ${artworkId} ORDER BY validated_at DESC LIMIT 20`,
    );
    return rows;
  }

  async getOrderValidationSummary(orderId: string): Promise<{
    orderId: string;
    totalArtworks: number;
    approved: number;
    rejected: number;
    readyForProduction: boolean;
  }> {
    const artworks = await this.prisma.artwork.findMany({
      where: { orderId },
      select: { id: true, status: true },
    });
    const approved = artworks.filter((a) => a.status === 'approved').length;
    const rejected = artworks.filter((a) => a.status === 'rejected').length;
    return {
      orderId,
      totalArtworks: artworks.length,
      approved,
      rejected,
      readyForProduction: artworks.length > 0 && rejected === 0 && approved === artworks.length,
    };
  }
}
