import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common';
import { ProductionSimulationService, SimulationScenario } from './production-simulation.service';
import { AdminAuthGuard } from '../admin-auth/admin-auth.guard';

@Controller('admin/production-simulation')
@UseGuards(AdminAuthGuard)
export class ProductionSimulationController {
  constructor(private readonly svc: ProductionSimulationService) {}

  @Get('scenarios')
  listScenarios() {
    return this.svc.listScenarios();
  }

  @Post('run')
  runScenario(@Body() body: { scenario: SimulationScenario; orderId: string }) {
    return this.svc.runScenario(body.scenario, body.orderId);
  }
}
