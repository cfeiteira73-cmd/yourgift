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
import { EmployeeWalletService } from './employee-wallet.service';
import { ProcurementRequestService } from './procurement-request.service';
import { OnboardingKitService } from './onboarding-kit.service';
import { DepartmentBudgetService } from './department-budget.service';

@UseGuards(JwtAuthGuard)
@Controller('employee-portal')
export class EmployeePortalController {
  constructor(
    private readonly wallets: EmployeeWalletService,
    private readonly requests: ProcurementRequestService,
    private readonly kits: OnboardingKitService,
    private readonly budgets: DepartmentBudgetService,
  ) {}

  // ── Wallets ──────────────────────────────────────────────────────────────

  @Get('wallets')
  getPlatformStats() {
    return this.wallets.getPlatformStats();
  }

  @Get('wallets/:id')
  getWallet(@Param('id') id: string) {
    return this.wallets.getWallet(id);
  }

  @Post('wallets/:id/grant')
  grantAllowance(
    @Param('id') id: string,
    @Body() body: { amount: number; description: string },
  ) {
    return this.wallets.grantAllowance(id, body.amount, body.description);
  }

  // ── Procurement Requests ─────────────────────────────────────────────────

  @Get('requests/stats')
  getRequestStats(@Query('tenantId') tenantId: string) {
    return this.requests.getRequestStats(tenantId ?? 'default');
  }

  @Get('requests')
  getPendingRequests(@Query('tenantId') tenantId: string) {
    return this.requests.getPendingRequests(tenantId ?? 'default');
  }

  @Post('requests')
  submitRequest(
    @Body()
    body: {
      walletId: string;
      companyId: string;
      tenantId: string;
      employeeEmail: string;
      department?: string;
      productName: string;
      productId?: string;
      variantId?: string;
      quantity: number;
      unitPrice?: number;
      currency?: string;
      urgency?: string;
      justification?: string;
    },
  ) {
    return this.requests.submitRequest(body);
  }

  @Patch('requests/:id/approve')
  approveRequest(
    @Param('id') id: string,
    @Body() body: { approvedBy: string },
  ) {
    return this.requests.approveRequest(id, body.approvedBy);
  }

  @Patch('requests/:id/reject')
  rejectRequest(
    @Param('id') id: string,
    @Body() body: { reason: string; rejectedBy: string },
  ) {
    return this.requests.rejectRequest(id, body.reason, body.rejectedBy);
  }

  // ── Onboarding Kits ──────────────────────────────────────────────────────

  @Get('kits/deployments')
  getDeployments(
    @Query('tenantId') tenantId: string,
    @Query('status') status?: string,
  ) {
    return this.kits.getDeployments(tenantId ?? 'default', status);
  }

  @Get('kits')
  getKits(@Query('tenantId') tenantId: string) {
    return this.kits.getKits(tenantId ?? 'default');
  }

  @Post('kits')
  createKit(
    @Body()
    body: {
      tenantId: string;
      name: string;
      description?: string;
      department?: string;
      currency?: string;
      items: Array<{
        productId?: string;
        variantId?: string;
        quantity: number;
        name: string;
        price: number;
      }>;
    },
  ) {
    return this.kits.createKit(body);
  }

  @Post('kits/:id/deploy')
  deployKit(
    @Param('id') id: string,
    @Body()
    body: {
      walletId: string;
      employeeEmail: string;
      employeeName: string;
      shippingAddress: Record<string, unknown>;
    },
  ) {
    return this.kits.deployKit({ kitId: id, ...body });
  }

  // ── Department Budgets ───────────────────────────────────────────────────

  @Get('budgets/summary')
  getBudgetSummary(@Query('tenantId') tenantId: string) {
    return this.budgets.getBudgetSummary(tenantId ?? 'default');
  }

  @Get('budgets')
  getBudgets(
    @Query('tenantId') tenantId: string,
    @Query('fiscalYear') fiscalYear?: string,
  ) {
    return this.budgets.getBudgets(
      tenantId ?? 'default',
      fiscalYear ? parseInt(fiscalYear, 10) : undefined,
    );
  }

  @Post('budgets')
  setBudget(
    @Body()
    body: {
      tenantId: string;
      companyId: string;
      department: string;
      fiscalYear: number;
      fiscalQuarter?: number;
      totalBudget: number;
      currency?: string;
      alertThreshold?: number;
    },
  ) {
    return this.budgets.setBudget(body);
  }
}
