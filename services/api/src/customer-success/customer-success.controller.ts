import { Controller, Get, Post, Patch, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CustomerSuccessService } from './customer-success.service';
import { ExpansionService } from './expansion.service';
import { InventoryForecastService } from './inventory-forecast.service';

@Controller('customer-success')
@UseGuards(JwtAuthGuard)
export class CustomerSuccessController {
  constructor(
    private readonly cs: CustomerSuccessService,
    private readonly expansion: ExpansionService,
    private readonly inventory: InventoryForecastService,
  ) {}

  // Health Scores
  @Get('health/platform')
  platformHealth() { return this.cs.getPlatformHealthSummary(); }

  @Get('health/scoreboard')
  scoreboard(@Query('limit') limit?: string) {
    return this.cs.getHealthScoreboard(limit ? Number(limit) : 20);
  }

  @Get('health/churn-cohorts')
  churnCohorts() { return this.cs.getChurnRiskCohorts(); }

  @Get('health/company/:id')
  companyHealth(@Param('id') id: string) {
    return this.cs.computeHealthScore(id);
  }

  @Post('health/refresh-all')
  refreshAll() { return this.cs.refreshAllHealthScores(); }

  // Expansion
  @Get('expansion/signals')
  signals(@Query('companyId') companyId?: string, @Query('limit') limit?: string) {
    return this.expansion.getSignals(companyId, limit ? Number(limit) : 20);
  }

  @Get('expansion/stats')
  signalStats() { return this.expansion.getSignalStats(); }

  @Post('expansion/detect/:companyId')
  detect(@Param('companyId') id: string) {
    return this.expansion.detectExpansionOpportunities(id);
  }

  @Patch('expansion/signals/:id/action')
  action(@Param('id') id: string) {
    return this.expansion.actionSignal(id, 'admin');
  }

  // Inventory
  @Get('inventory/alerts')
  inventoryAlerts() { return this.inventory.getActiveAlerts(); }

  @Get('inventory/summary')
  inventorySummary() { return this.inventory.getDepletionSummary(); }

  @Post('inventory/refresh')
  refreshInventory() { return this.inventory.refreshAllForecasts(); }

  @Post('inventory/product/:id')
  forecastProduct(@Param('id') id: string) {
    return this.inventory.computeForecast(id);
  }
}
