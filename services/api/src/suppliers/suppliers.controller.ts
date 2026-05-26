import { Controller, Post, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtOrInternalGuard } from '../common/guards/jwt-or-internal.guard';
import { SuppliersService } from './suppliers.service';

@ApiTags('admin/suppliers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('suppliers')
export class SuppliersController {
  constructor(private suppliers: SuppliersService) {}

  /**
   * Trigger full Midocean catalogue sync.
   * Accepts both JWT (dashboard) and x-internal-token (admin worker).
   * Route aliases: POST /suppliers/sync/midocean  AND  POST /suppliers/midocean/sync
   */
  @Post(['sync/midocean', 'midocean/sync'])
  @UseGuards(JwtOrInternalGuard)
  syncMidocean() {
    return this.suppliers.syncMidocean();
  }

  /**
   * Trigger full PF Concept catalogue sync.
   * Accepts both JWT (dashboard) and x-internal-token (admin worker).
   * Route aliases: POST /suppliers/sync/pf-concept  AND  POST /suppliers/pf/sync
   */
  @Post(['sync/pf-concept', 'pf/sync'])
  @UseGuards(JwtOrInternalGuard)
  syncPfConcept() {
    return this.suppliers.syncPfConcept();
  }

  /** Get recent sync logs */
  @Get('sync-logs')
  @ApiQuery({ name: 'supplier', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getSyncLogs(
    @Query('supplier') supplier?: string,
    @Query('limit') limit?: string,
  ) {
    return this.suppliers.getSyncLogs(limit ? parseInt(limit, 10) : 50, supplier);
  }

  /** Get product/variant stats per supplier */
  @Get('stats')
  getStats() {
    return this.suppliers.getStats();
  }
}
