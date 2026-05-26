import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AdminAuthGuard } from '../admin-auth/admin-auth.guard';
import {
  GoLiveActivationResult,
  GoLiveChecklist,
  LiveMoneyGateService,
  LiveMoneyStatus,
} from './go-live.service';

@ApiTags('go-live')
@ApiBearerAuth()
@UseGuards(AdminAuthGuard)
@Controller('api/v1/admin/go-live')
export class GoLiveController {
  constructor(private readonly liveMoneyGateService: LiveMoneyGateService) {}

  @Get('status')
  @ApiOperation({
    summary: 'Get live money gate status',
    description:
      'Returns real-time status of all live-money prerequisites: Stripe account health, webhook delivery rates, reconciliation, and job queue state.',
  })
  @ApiResponse({ status: 200, description: 'Current live status retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getStatus(): Promise<LiveMoneyStatus> {
    return this.liveMoneyGateService.getStatus();
  }

  @Post('activate')
  @ApiOperation({
    summary: 'Activate live money mode',
    description:
      'Runs the full go-live checklist. If all critical checks pass, emits the system.go_live.activated event and returns success. If any critical check fails, returns the list of blockers.',
  })
  @ApiResponse({ status: 200, description: 'Activation attempted — check success field for result' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async activate(): Promise<GoLiveActivationResult> {
    return this.liveMoneyGateService.activate();
  }

  @Get('checklist')
  @ApiOperation({
    summary: 'Get go-live checklist',
    description:
      'Returns all go-live checks with real data from Stripe API and database. Critical failures are sorted first.',
  })
  @ApiResponse({ status: 200, description: 'Checklist retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getChecklist(): Promise<GoLiveChecklist[]> {
    return this.liveMoneyGateService.getChecklist();
  }
}
