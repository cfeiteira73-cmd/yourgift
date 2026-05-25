import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { AdminAuthGuard } from '../admin-auth/admin-auth.guard';
import { FinancialReplayService } from './financial-replay.service';

// ─── Request / Query DTOs (inline, no class-validator required) ──────────────

interface ReplayBody {
  fromDate: string;
  toDate: string;
}

interface TimelineQuery {
  fromDate?: string;
  toDate?: string;
}

// ─── Controller ──────────────────────────────────────────────────────────────

@Controller('admin/financial-replay')
@UseGuards(AdminAuthGuard)
export class FinancialReplayController {
  constructor(private readonly replayService: FinancialReplayService) {}

  /**
   * POST /admin/financial-replay/snapshot/:tenantId
   * Builds a point-in-time financial snapshot for the given tenant.
   * Optional query param: asOf (ISO date string)
   */
  @Post('snapshot/:tenantId')
  async createSnapshot(
    @Param('tenantId') tenantId: string,
    @Query('asOf') asOf?: string,
  ) {
    const asOfDate = asOf ? new Date(asOf) : undefined;
    if (asOf && isNaN(asOfDate!.getTime())) {
      throw new BadRequestException(`Invalid asOf date: ${asOf}`);
    }
    return this.replayService.createSnapshot(tenantId, asOfDate);
  }

  /**
   * POST /admin/financial-replay/replay/:tenantId
   * Body: { fromDate: string, toDate: string }
   * Replays all ledger transactions in the date range and returns anomalies.
   */
  @Post('replay/:tenantId')
  async replayLedger(
    @Param('tenantId') tenantId: string,
    @Body() body: ReplayBody,
  ) {
    if (!body.fromDate || !body.toDate) {
      throw new BadRequestException('body must include fromDate and toDate (ISO strings)');
    }
    const fromDate = new Date(body.fromDate);
    const toDate = new Date(body.toDate);
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      throw new BadRequestException('fromDate and toDate must be valid ISO date strings');
    }
    if (fromDate >= toDate) {
      throw new BadRequestException('fromDate must be before toDate');
    }
    return this.replayService.replayLedger(tenantId, fromDate, toDate);
  }

  /**
   * GET /admin/financial-replay/verify-tx/:txId
   * Verifies the double-entry invariant for a single ledger transaction.
   */
  @Get('verify-tx/:txId')
  async verifyDoubleEntry(@Param('txId') txId: string) {
    return this.replayService.verifyDoubleEntry(txId);
  }

  /**
   * GET /admin/financial-replay/orphans/:tenantId
   * Returns IDs of ledger entries referencing non-existent orders.
   */
  @Get('orphans/:tenantId')
  async detectOrphanPayments(@Param('tenantId') tenantId: string) {
    const orphanIds = await this.replayService.detectOrphanPayments(tenantId);
    return { tenantId, orphanCount: orphanIds.length, orphanIds };
  }

  /**
   * GET /admin/financial-replay/duplicates/:tenantId
   * Returns order referenceIds that appear more than once in ledger transactions.
   */
  @Get('duplicates/:tenantId')
  async detectDuplicateCharges(@Param('tenantId') tenantId: string) {
    const duplicates = await this.replayService.detectDuplicateCharges(tenantId);
    return { tenantId, duplicateCount: duplicates.length, duplicates };
  }

  /**
   * GET /admin/financial-replay/timeline/:tenantId?fromDate=&toDate=
   * Returns a chronological audit timeline of all ledger entries.
   */
  @Get('timeline/:tenantId')
  async reconstructAuditTimeline(
    @Param('tenantId') tenantId: string,
    @Query() query: TimelineQuery,
  ) {
    if (!query.fromDate || !query.toDate) {
      throw new BadRequestException('Query params fromDate and toDate are required (ISO strings)');
    }
    const fromDate = new Date(query.fromDate);
    const toDate = new Date(query.toDate);
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      throw new BadRequestException('fromDate and toDate must be valid ISO date strings');
    }
    const timeline = await this.replayService.reconstructAuditTimeline(
      tenantId,
      fromDate,
      toDate,
    );
    return { tenantId, fromDate, toDate, entryCount: timeline.length, timeline };
  }

  /**
   * GET /admin/financial-replay/summary/:tenantId
   * Returns aggregate financial health metrics for a tenant.
   */
  @Get('summary/:tenantId')
  async getFinancialSummary(@Param('tenantId') tenantId: string) {
    return this.replayService.getFinancialSummary(tenantId);
  }
}
