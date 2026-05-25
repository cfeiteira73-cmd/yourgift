import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EventBusModule } from '../events/event-bus.module';
import { LedgerModule } from '../ledger/ledger.module';
import { FinancialReplayService } from './financial-replay.service';
import { FinancialReplayController } from './financial-replay.controller';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';

@Module({
  imports: [PrismaModule, EventBusModule, LedgerModule, AdminAuthModule],
  controllers: [FinancialReplayController],
  providers: [FinancialReplayService],
  exports: [FinancialReplayService],
})
export class FinancialReplayModule {}
