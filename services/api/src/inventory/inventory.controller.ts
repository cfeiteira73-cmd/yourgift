import { Controller, Get, Patch, Param, UseGuards } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('inventory')
@UseGuards(JwtAuthGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('stats')
  getStats() {
    return this.inventoryService.getInventoryStats();
  }

  @Get('low-stock')
  getLowStock() {
    return this.inventoryService.getLowStockItems();
  }

  @Get('alerts')
  getAlerts() {
    return this.inventoryService.getAlerts(false);
  }

  @Get('alerts/history')
  getAlertHistory() {
    return this.inventoryService.getAlerts(true);
  }

  @Get('check')
  triggerCheck() {
    return this.inventoryService.runInventoryCheck();
  }

  @Patch('alerts/:id/resolve')
  resolveAlert(@Param('id') id: string) {
    return this.inventoryService.resolveAlert(id);
  }
}
