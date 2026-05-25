import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AdminGuard } from '../auth/guards/admin.guard';
import {
  ReconciliationService,
  ReconciliationType,
  IssueSeverity,
} from './reconciliation.service';

interface RunReconciliationBody {
  type: ReconciliationType;
  tenantId?: string;
}

interface RepairIssueBody {
  repairedBy: string;
}

@ApiTags('reconciliation')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('reconciliation')
export class ReconciliationController {
  constructor(private readonly reconciliationService: ReconciliationService) {}

  @Post('run')
  async run(@Body() body: RunReconciliationBody): Promise<unknown> {
    return this.reconciliationService.runReconciliation(
      body.type,
      'manual',
      body.tenantId,
    );
  }

  @Get('runs')
  async history(@Query('tenantId') tenantId?: string): Promise<unknown[]> {
    return this.reconciliationService.getHistory(tenantId);
  }

  @Get('runs/:id')
  async getOne(@Param('id') id: string): Promise<unknown> {
    return this.reconciliationService.getRunById(id);
  }

  @Get('issues')
  async openIssues(
    @Query('severity') severity?: IssueSeverity,
    @Query('issueType') issueType?: string,
    @Query('tenantId') tenantId?: string,
  ): Promise<unknown[]> {
    return this.reconciliationService.getOpenIssues({
      severity,
      issueType,
      tenantId,
    });
  }

  @Post('issues/:id/repair')
  async repair(
    @Param('id') id: string,
    @Body() body: RepairIssueBody,
  ): Promise<unknown> {
    return this.reconciliationService.repairIssue(id, body.repairedBy);
  }
}
