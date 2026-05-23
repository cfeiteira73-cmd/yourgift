import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BudgetLedgerService } from './budget-ledger.service';

@ApiTags('budget-ledger')
@UseGuards(JwtAuthGuard)
@Controller('budget')
export class BudgetLedgerController {
  constructor(private readonly budget: BudgetLedgerService) {}

  @Post('allocations')
  @ApiOperation({ summary: 'Create budget allocation' })
  async create(@Body() body: { organizationId: string; period: string; totalEur: number; departmentId?: string; category?: string }) {
    return this.budget.createAllocation(body);
  }

  @Get('allocations/:id/status')
  @ApiOperation({ summary: 'Get allocation status (available/reserved/committed/spent)' })
  async status(@Param('id') id: string) {
    return this.budget.getStatus(id);
  }

  @Get('allocations/:id/transactions')
  @ApiOperation({ summary: 'Get budget transaction log' })
  async transactions(@Param('id') id: string) {
    return this.budget.getTransactions(id, 100);
  }

  @Get('organizations/:orgId/allocations')
  @ApiOperation({ summary: 'Get all allocations for an organization' })
  async orgAllocations(@Param('orgId') orgId: string) {
    return this.budget.getOrgAllocations(orgId);
  }

  @Post('allocations/:id/check')
  @ApiOperation({ summary: 'Check if amount is available' })
  async check(@Param('id') id: string, @Body() body: { amountEur: number }) {
    const status = await this.budget.getStatus(id);
    return { sufficient: status.availableEur >= body.amountEur, available: status.availableEur };
  }
}
