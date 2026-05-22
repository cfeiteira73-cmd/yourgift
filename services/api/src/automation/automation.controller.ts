import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AutomationService } from './automation.service';
import { RoutingService, RoutingCriteria } from './routing.service';

@Controller('api/v1/automation')
@UseGuards(JwtAuthGuard)
export class AutomationController {
  constructor(
    private readonly automation: AutomationService,
    private readonly routing: RoutingService,
  ) {}

  @Get('rules')
  getRules(): Promise<unknown[]> {
    return this.automation.getRules();
  }

  @Get('executions')
  getExecutions(@Query('limit') limit?: string) {
    return this.automation.getExecutions(limit ? Number(limit) : 50);
  }

  @Get('stats')
  getStats() {
    return this.automation.getStats();
  }

  @Patch('rules/:id/toggle')
  toggleRule(
    @Param('id') id: string,
    @Body() body: { isActive: boolean },
  ) {
    return this.automation.toggleRule(id, body.isActive);
  }

  @Post('routing/optimal')
  getOptimalSupplier(@Body() criteria: RoutingCriteria) {
    return this.routing.selectOptimalSupplier(criteria);
  }

  @Post('routing/ranked')
  getRankedSuppliers(@Body() criteria: RoutingCriteria) {
    return this.routing.getRankedSuppliers(criteria);
  }

  @Get('routing/matrix')
  getMatrix() {
    return this.routing.getMatrix();
  }
}
