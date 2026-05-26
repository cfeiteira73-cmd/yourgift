import { Injectable } from '@nestjs/common';
import { GovernanceService } from '../governance/governance.service';
import { AuthRiskService } from '../auth/auth-risk.service';
import { IdentityGraphService } from '../auth/identity-graph.service';
import { BudgetLedgerService } from '../budget-ledger/budget-ledger.service';
import { EventBusService } from '../events/event-bus.service';

export type PolicyDecision = 'allow' | 'deny' | 'escalate' | 'step_up';

export interface PolicyContext {
  // Identity
  clientId?: string;
  organizationId?: string;
  permissionRequired?: string;
  // Request
  action: string;
  category?: string;
  supplierCode?: string;
  tenantId?: string;
  // Financial
  amountEur?: number;
  marginPct?: number;
  budgetAllocationId?: string;
  budgetPeriod?: string;
  // Risk
  riskScore?: number;
  ip?: string;
  provider?: string;
}

export interface PolicyResult {
  decision: PolicyDecision;
  allowed: boolean;
  reason: string;
  details: {
    identityCheck: 'pass' | 'fail' | 'skip';
    budgetCheck: 'pass' | 'fail' | 'skip';
    governanceCheck: 'pass' | 'fail' | 'escalate' | 'skip';
    riskCheck: 'pass' | 'flag' | 'block' | 'skip';
    approvalRequired: boolean;
    approvalChain?: any;
  };
  requiresApproval: boolean;
  blockers: string[];
}

@Injectable()
export class PolicyExecutionService {
  constructor(
    private readonly governance: GovernanceService,
    private readonly risk: AuthRiskService,
    private readonly identityGraph: IdentityGraphService,
    private readonly budget: BudgetLedgerService,
    private readonly eventBus: EventBusService,
  ) {}

  async evaluate(ctx: PolicyContext): Promise<PolicyResult> {
    const blockers: string[] = [];
    const details: PolicyResult['details'] = {
      identityCheck: 'skip',
      budgetCheck: 'skip',
      governanceCheck: 'skip',
      riskCheck: 'skip',
      approvalRequired: false,
    };

    // ── 1. Identity permission check ──────────────────────────────────────
    if (ctx.clientId && ctx.permissionRequired) {
      const allowed = await this.identityGraph.hasPermissionWithDelegation(
        ctx.clientId, ctx.permissionRequired, ctx.organizationId,
      );
      details.identityCheck = allowed ? 'pass' : 'fail';
      if (!allowed) blockers.push(`Permission denied: ${ctx.permissionRequired}`);
    }

    // ── 2. Approval chain resolution ──────────────────────────────────────
    if (ctx.organizationId && ctx.amountEur) {
      const chain = await this.identityGraph.resolveApprovalChain(
        ctx.organizationId, ctx.action, ctx.amountEur, ctx.category,
      );
      if (chain) {
        details.approvalRequired = true;
        details.approvalChain = chain;
      }
    }

    // ── 3. Budget check ───────────────────────────────────────────────────
    if (ctx.amountEur && ctx.organizationId) {
      const period = ctx.budgetPeriod ?? new Date().getFullYear().toString();
      if (ctx.budgetAllocationId) {
        const status = await this.budget.getStatus(ctx.budgetAllocationId);
        if (status.availableEur < ctx.amountEur) {
          details.budgetCheck = 'fail';
          blockers.push(`Budget insufficient: €${status.availableEur.toFixed(0)} available, €${ctx.amountEur.toFixed(0)} required`);
        } else {
          details.budgetCheck = 'pass';
        }
      } else {
        const avail = await this.budget.checkAvailability(ctx.organizationId, period, ctx.amountEur);
        details.budgetCheck = avail.sufficient ? 'pass' : 'fail';
        if (!avail.sufficient) blockers.push(`Budget insufficient: €${avail.available.toFixed(0)} available`);
      }
    }

    // ── 4. Governance check ───────────────────────────────────────────────
    const govResult = await this.governance.checkDecision({
      riskScore: ctx.riskScore ?? 20,
      finalMarginPct: ctx.marginPct,
      supplierCode: ctx.supplierCode,
      tenantId: ctx.tenantId,
      action: ctx.action,
      category: ctx.category,
    });
    if (govResult.status === 'blocked') {
      details.governanceCheck = 'fail';
      blockers.push(`Governance: ${govResult.reason}`);
    } else if (govResult.status === 'escalated') {
      details.governanceCheck = 'escalate';
    } else if (govResult.status === 'requires_approval') {
      details.governanceCheck = 'escalate';
      details.approvalRequired = true;
    } else {
      details.governanceCheck = 'pass';
    }

    // ── 5. Risk check ─────────────────────────────────────────────────────
    if (ctx.clientId || ctx.ip) {
      const riskResult = await this.risk.assess({
        clientId: ctx.clientId,
        ip: ctx.ip,
        provider: ctx.provider,
      });
      if (riskResult.blocked) {
        details.riskCheck = 'block';
        blockers.push(`Risk score ${riskResult.riskScore} — blocked`);
      } else if (riskResult.riskLevel === 'step_up') {
        details.riskCheck = 'flag';
      } else {
        details.riskCheck = 'pass';
      }
    }

    // ── Final decision ────────────────────────────────────────────────────
    let decision: PolicyDecision;
    let reason: string;

    if (blockers.length > 0) {
      decision = 'deny';
      reason = blockers.join('; ');
    } else if (details.riskCheck === 'flag') {
      decision = 'step_up';
      reason = 'Step-up authentication required due to elevated risk';
    } else if (details.approvalRequired) {
      decision = 'escalate';
      reason = details.approvalChain
        ? `Approval required: ${details.approvalChain.name} (${details.approvalChain.steps?.length ?? 0} steps)`
        : 'Manual approval required per governance policy';
    } else {
      decision = 'allow';
      reason = 'All policy checks passed';
    }

    const result: PolicyResult = {
      decision,
      allowed: decision === 'allow',
      reason,
      details,
      requiresApproval: details.approvalRequired,
      blockers,
    };

    // Emit policy event
    this.eventBus.emit('policy.evaluated', {
      decision, action: ctx.action, clientId: ctx.clientId, tenantId: ctx.tenantId, amountEur: ctx.amountEur,
    });

    return result;
  }
}
