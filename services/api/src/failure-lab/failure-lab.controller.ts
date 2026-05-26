import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { AdminAuthGuard } from '../admin-auth/admin-auth.guard';
import {
  FailureLabReport,
  FailureLabScenario,
  ProductionFailureLabService,
} from './failure-lab.service';

@ApiTags('Failure Lab')
@ApiBearerAuth()
@UseGuards(AdminAuthGuard)
@Controller('api/v1/admin/failure-lab')
export class FailureLabController {
  constructor(private readonly failureLabService: ProductionFailureLabService) {}

  @Get('run')
  @ApiOperation({
    summary: 'Run all failure lab scenarios',
    description:
      'Executes all 10 production failure detection scenarios in parallel. All tests are READ-ONLY — they detect whether the system would handle a scenario correctly based on current state.',
  })
  async runAllTests(): Promise<FailureLabReport> {
    return this.failureLabService.runAllTests();
  }

  @Get('scenario/:id')
  @ApiOperation({
    summary: 'Run a single failure lab scenario',
    description:
      'Executes one specific scenario by ID. Returns the scenario result with pass/fail/warn status and detail.',
  })
  @ApiParam({
    name: 'id',
    description:
      'Scenario ID. One of: lost_webhook_detection, duplicate_event_handling, delayed_settlement_detection, refund_race_condition_risk, queue_corruption_detection, partial_replay_failure, ledger_balance_integrity, webhook_failure_spike, orphan_payment_detection, reconciliation_staleness',
    example: 'ledger_balance_integrity',
  })
  async runScenario(@Param('id') id: string): Promise<FailureLabScenario> {
    return this.failureLabService.runScenario(id);
  }
}
