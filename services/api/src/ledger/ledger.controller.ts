import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LedgerService } from './ledger.service';

@Controller('ledger')
@UseGuards(JwtAuthGuard)
export class LedgerController {
  constructor(private readonly ledger: LedgerService) {}

  @Get('trial-balance')
  getTrialBalance() {
    return this.ledger.getTrialBalance();
  }

  @Get('pnl')
  getPnL() {
    return this.ledger.getPnL();
  }

  @Get('transactions')
  getTransactions(
    @Query('limit') limit?: string,
    @Query('referenceType') referenceType?: string,
  ) {
    return this.ledger.getTransactions(
      limit ? parseInt(limit, 10) : undefined,
      referenceType,
    );
  }

  @Get('accounts/:code/balance')
  getAccountBalance(@Param('code') code: string) {
    return this.ledger.getAccountBalance(code);
  }

  @Get('reference/:type/:id')
  getEntriesForReference(
    @Param('type') type: string,
    @Param('id') id: string,
  ) {
    return this.ledger.getEntriesForReference(type, id);
  }
}
