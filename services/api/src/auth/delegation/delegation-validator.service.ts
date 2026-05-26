import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface DelegationValidationResult {
  allowed: boolean;
  reason?: string;
}

@Injectable()
export class DelegationValidatorService {
  private get db(): any { return this.prisma; }

  constructor(private readonly prisma: PrismaService) {}

  async validate(
    delegationId: string,
    action: string,
    amount?: number,
  ): Promise<DelegationValidationResult> {
    const delegation = await this.db.identityDelegation.findUnique({
      where: { id: delegationId },
    });

    if (!delegation) {
      return { allowed: false, reason: 'Delegation not found' };
    }

    if (!delegation.isActive || delegation.revokedAt) {
      return { allowed: false, reason: 'Delegation is inactive or revoked' };
    }

    // Check expiry
    if (delegation.expiresAt && delegation.expiresAt < new Date()) {
      return { allowed: false, reason: 'Delegation has expired' };
    }

    // Check scope matches action
    // scope may be a comma-separated list of allowed actions or a wildcard
    const scopes: string[] = delegation.scope
      .split(',')
      .map((s: string) => s.trim().toLowerCase());

    const actionLower = action.toLowerCase();
    const scopeAllowed =
      scopes.includes('*') ||
      scopes.includes(actionLower) ||
      scopes.some((s: string) => actionLower.startsWith(s.replace('*', '')));

    if (!scopeAllowed) {
      return {
        allowed: false,
        reason: `Action '${action}' is not permitted by delegation scope '${delegation.scope}'`,
      };
    }

    // Check budget limit
    if (delegation.budgetLimitEur != null && amount != null) {
      const budgetLimit = Number(delegation.budgetLimitEur);
      if (amount > budgetLimit) {
        return {
          allowed: false,
          reason: `Amount ${amount} EUR exceeds delegation budget limit of ${budgetLimit} EUR`,
        };
      }
    }

    return { allowed: true };
  }
}
