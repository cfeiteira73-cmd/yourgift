import { Module } from '@nestjs/common';
import { AdminGuard } from '../auth/guards/admin.guard';
import { RecoveryService } from './recovery.service';
import { RecoveryController } from './recovery.controller';

@Module({
  controllers: [RecoveryController],
  providers: [RecoveryService, AdminGuard],
  exports: [RecoveryService],
})
export class RecoveryModule {}
