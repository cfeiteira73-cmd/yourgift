import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ArtworkService } from './artwork.service';
import { IsString } from 'class-validator';

class UploadUrlDto {
  @IsString() filename: string;
  @IsString() mimeType: string;
}

class MockupDto {
  @IsString() artworkUrl: string;
  @IsString() productId: string;
}

@ApiTags('artwork')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('artwork')
export class ArtworkController {
  constructor(private artwork: ArtworkService) {}

  @Post('upload-url')
  getUploadUrl(@Body() dto: UploadUrlDto) {
    return this.artwork.getUploadUrl(dto.filename, dto.mimeType);
  }

  @Post('mockup')
  generateMockup(@Body() dto: MockupDto) {
    return this.artwork.generateMockup(dto.artworkUrl, dto.productId);
  }
}
