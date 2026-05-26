import { Module } from '@nestjs/common';
import { MarginProtectionService } from './margin-protection.service';
import { MarginProtectionController } from './margin-protection.controller';

@Module({
  controllers: [MarginProtectionController],
  providers: [MarginProtectionService],
  exports: [MarginProtectionService],
})
export class MarginProtectionModule {}
