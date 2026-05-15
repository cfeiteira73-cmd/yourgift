import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PrismaService } from '../prisma/prisma.service';
import { randomUUID } from 'crypto';

@Injectable()
export class ArtworkService {
  private s3: S3Client;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    this.s3 = new S3Client({
      region: config.get('AWS_REGION', 'eu-west-1'),
      credentials: {
        accessKeyId: config.getOrThrow('AWS_ACCESS_KEY_ID'),
        secretAccessKey: config.getOrThrow('AWS_SECRET_ACCESS_KEY'),
      },
    });
  }

  async getUploadUrl(filename: string, mimeType: string) {
    const key = `artwork/${randomUUID()}/${filename}`;
    const command = new PutObjectCommand({
      Bucket: this.config.getOrThrow('S3_BUCKET'),
      Key: key,
      ContentType: mimeType,
    });

    const url = await getSignedUrl(this.s3, command, { expiresIn: 600 });
    const cdnUrl = `${this.config.get('CLOUDFRONT_URL')}/${key}`;

    return { uploadUrl: url, fileKey: key, cdnUrl };
  }

  async generateMockup(artworkUrl: string, productId: string) {
    // Mockup generation — integrate with external service (e.g. Printful, Dynamic Mockups)
    return {
      mockupUrl: `${this.config.get('CLOUDFRONT_URL')}/mockups/${productId}/preview.png`,
      artworkUrl,
    };
  }
}
