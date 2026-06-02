// ── Makito REST Controller ────────────────────────────────────────────────────
// Real Makito API: POST /orders {customerOrder, items:[{variant,quantity}]}
// No RFQ endpoint — use quote (price list + stock check)

import { Controller, Get, Post, Body, Param, Query, Logger } from '@nestjs/common';
import { MakitoService } from './makito.service';
import { MakitoInventoryService } from './makito-inventory.service';
import { MakitoTrackingService } from './makito-tracking.service';
import { MakitoAnalyticsService } from './makito-analytics.service';
import { MakitoArtworkValidator, MakitoPricingEngine } from '@yourgift/makito';
import type { MakitoOrderRequest, ArtworkSpec } from '@yourgift/makito';

// ── DTOs ──────────────────────────────────────────────────────────────────────

/** Real Makito order format */
class SubmitOrderDto implements MakitoOrderRequest {
  customerOrder!: string;
  items!: MakitoOrderRequest['items'];
  deliveryAddress?: MakitoOrderRequest['deliveryAddress'];
  requestedDate?: string;
  notes?: string;
}

/** Quote request — price list + stock check (Makito has no RFQ endpoint) */
class GetQuoteDto {
  items!: Array<{ variantRef: string; quantity: number }>;
}

class ValidateArtworkDto {
  artwork!: ArtworkSpec;
  printAreaId!: string;
  techniqueCode!: string;
  maxWidth!: number;
  maxHeight!: number;
}

class CalculatePriceDto {
  sku!: string;
  quantity!: number;
  basePrice!: number;
  priceBreaks?: Array<{ minQty: number; price: number }>;
  decorationCost?: number;
  setupCost?: number;
  targetMarginPct?: number;
}

@Controller('makito')
export class MakitoController {
  private readonly logger = new Logger(MakitoController.name);
  private readonly artworkValidator = new MakitoArtworkValidator();
  private readonly pricingEngine = new MakitoPricingEngine();

  constructor(
    private readonly makito: MakitoService,
    private readonly inventory: MakitoInventoryService,
    private readonly tracking: MakitoTrackingService,
    private readonly analytics: MakitoAnalyticsService,
  ) {}

  // ── Health ────────────────────────────────────────────────────────────────

  @Get('health')
  async health() {
    return this.makito.healthCheck();
  }

  @Get('stats')
  async stats() {
    return this.makito.getStats();
  }

  // ── Catalog Sync ─────────────────────────────────────────────────────────

  @Post('sync/full')
  async syncFull() {
    this.logger.log('Admin triggered full Makito catalog sync');
    return this.makito.syncFull();
  }

  @Post('sync/incremental')
  async syncIncremental(@Body('since') since: string) {
    if (!since) return { error: 'since is required' };
    return this.makito.syncIncremental(since);
  }

  @Post('sync/stock')
  async syncStock() {
    return this.makito.syncStockOnly();
  }

  // ── Inventory ─────────────────────────────────────────────────────────────

  @Get('inventory')
  async inventory() {
    return this.inventory.getInventoryReport();
  }

  @Get('inventory/live')
  async liveStock(@Query('sku') sku?: string) {
    return this.makito.getLiveStock(sku);
  }

  @Post('inventory/refresh')
  async refreshStock() {
    return this.inventory.refreshLiveStock();
  }

  @Post('inventory/check')
  async checkStock(@Body() body: { lines: Array<{ sku: string; quantity: number }> }) {
    return this.inventory.checkOrderStock(body.lines);
  }

  // ── Pricing ───────────────────────────────────────────────────────────────

  @Post('pricing/calculate')
  async calculatePrice(@Body() dto: CalculatePriceDto) {
    return this.pricingEngine.calculate({
      sku: dto.sku,
      quantity: dto.quantity,
      basePrice: dto.basePrice,
      priceBreaks: dto.priceBreaks,
      decorationUnitCost: dto.decorationCost,
      setupCost: dto.setupCost,
      targetMarginPct: dto.targetMarginPct,
    });
  }

  @Post('pricing/compare')
  async compareQuantities(@Body() body: { sku: string; basePrice: number; quantities: number[] }) {
    return this.pricingEngine.compareQuantities(body.sku, body.basePrice, body.quantities);
  }

  // ── Artwork ───────────────────────────────────────────────────────────────

  @Post('artwork/validate')
  async validateArtwork(@Body() dto: ValidateArtworkDto) {
    const printArea = {
      id: dto.printAreaId,
      name: 'Print Area',
      positionCode: dto.printAreaId,
      maxWidth: dto.maxWidth,
      maxHeight: dto.maxHeight,
      techniques: [],
    };
    const technique = { code: dto.techniqueCode, name: dto.techniqueCode };
    return this.artworkValidator.validate(dto.artwork, printArea, technique);
  }

  @Post('artwork/quick-check')
  async quickCheck(@Body() artwork: ArtworkSpec) {
    return this.artworkValidator.quickValidate(artwork);
  }

  // ── Quote (replaces RFQ — Makito has no dedicated RFQ endpoint) ───────────

  @Post('quote')
  async getQuote(@Body() dto: GetQuoteDto) {
    return this.makito.getQuote(dto.items);
  }

  // ── Orders ────────────────────────────────────────────────────────────────

  @Post('orders')
  async submitOrder(@Body() dto: SubmitOrderDto) {
    return this.makito.submitOrder(dto);
  }

  @Get('orders')
  async listOrders(
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.makito.getOrders({ status, from, to });
  }

  @Get('orders/:documentNumber')
  async getOrder(@Param('documentNumber') id: string) {
    return this.makito.getOrderStatus(id);
  }

  @Post('orders/:documentNumber/cancel')
  async cancelOrder(
    @Param('documentNumber') id: string,
    @Body('reason') reason?: string,
  ) {
    return this.makito.cancelOrder(id, reason);
  }

  // ── Deliveries & Tracking ─────────────────────────────────────────────────

  @Get('deliveries')
  async getDeliveries(
    @Query('customerOrder') customerOrder?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.makito.getDeliveries({ customerOrder, from, to });
  }

  @Get('orders/:customerOrder/tracking')
  async getTracking(@Param('customerOrder') ref: string) {
    return this.makito.getShipmentTracking(ref);
  }

  @Get('production/:orderId')
  async getProductionStatus(@Param('orderId') orderId: string) {
    return this.tracking.getProductionStatus(orderId);
  }

  @Get('production/:orderId/timeline')
  async getTimeline(@Param('orderId') orderId: string) {
    return this.tracking.getCustomerTimeline(orderId);
  }

  @Post('production/poll')
  async pollTracking() {
    return this.tracking.pollActiveOrders();
  }

  // ── Metadata ─────────────────────────────────────────────────────────────

  @Get('metadata')
  async metadata() {
    return this.makito.getMetadata();
  }

  // ── Analytics ─────────────────────────────────────────────────────────────

  @Get('analytics/scorecard')
  async scorecard() {
    return this.analytics.getSupplierScorecard();
  }

  @Get('analytics/kpis')
  async kpis(@Query('days') days?: string) {
    return this.analytics.getExecutiveKPIs(days ? parseInt(days, 10) : 30);
  }
}
