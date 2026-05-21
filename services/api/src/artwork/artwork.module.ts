import { Module } from '@nestjs/common';
import { ArtworkService } from './artwork.service';
import { ArtworkController } from './artwork.controller';

@Module({
  providers: [ArtworkService],
  controllers: [ArtworkController],
  exports: [ArtworkService],
})
export class ArtworkModule {}
