import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsString, IsNumber, IsPositive, IsInt, Min } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ArtworkService } from './artwork.service';

// ─── DTOs ─────────────────────────────────────────────────────────────────────

class InitiateUploadDto {
  @IsString()
  orderId: string;

  @IsString()
  filename: string;

  @IsString()
  mimeType: string;

  @IsInt()
  @IsPositive()
  sizeBytes: number;
}

class RevisionDto {
  @IsString()
  notes: string;
}

class RejectDto {
  @IsString()
  notes: string;
}

class MockupDto {
  @IsString()
  mockupUrl: string;
}

// ─── interface ────────────────────────────────────────────────────────────────

interface AuthRequest extends Request {
  user: { id: string; role?: string };
}

// ─── controller ───────────────────────────────────────────────────────────────

@ApiTags('artwork')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('artwork')
export class ArtworkController {
  constructor(private readonly artwork: ArtworkService) {}

  // ── POST /artwork/initiate ────────────────────────────────────────────────

  @Post('initiate')
  @ApiOperation({ summary: 'Initiate artwork upload — returns presigned S3 URL' })
  initiateUpload(@Body() dto: InitiateUploadDto) {
    return this.artwork.initiateUpload(
      dto.orderId,
      dto.filename,
      dto.mimeType,
      dto.sizeBytes,
    );
  }

  // ── GET /artwork/order/:orderId ───────────────────────────────────────────

  @Get('order/:orderId')
  @ApiOperation({ summary: 'List all artworks for an order' })
  getForOrder(@Param('orderId') orderId: string) {
    return this.artwork.getForOrder(orderId);
  }

  // ── POST /artwork/:id/confirm ─────────────────────────────────────────────

  @Post(':id/confirm')
  @ApiOperation({ summary: 'Confirm S3 upload is complete' })
  confirmUpload(@Param('id') id: string) {
    return this.artwork.confirmUpload(id);
  }

  // ── POST /artwork/:id/revision ────────────────────────────────────────────

  @Post(':id/revision')
  @ApiOperation({ summary: 'Request a revision on an artwork' })
  requestRevision(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: RevisionDto,
  ) {
    return this.artwork.requestRevision(id, dto.notes, req.user.id);
  }

  // ── POST /artwork/:id/approve ─────────────────────────────────────────────

  @Post(':id/approve')
  @ApiOperation({ summary: 'Approve an artwork' })
  approve(@Request() req: AuthRequest, @Param('id') id: string) {
    return this.artwork.approve(id, req.user.id);
  }

  // ── POST /artwork/:id/reject ──────────────────────────────────────────────

  @Post(':id/reject')
  @ApiOperation({ summary: 'Reject an artwork' })
  reject(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: RejectDto,
  ) {
    return this.artwork.reject(id, dto.notes, req.user.id);
  }

  // ── POST /artwork/:id/mockup ──────────────────────────────────────────────

  @Post(':id/mockup')
  @ApiOperation({ summary: 'Save a mockup URL for an artwork' })
  saveMockup(@Param('id') id: string, @Body() dto: MockupDto) {
    return this.artwork.saveMockup(id, dto.mockupUrl);
  }
}
