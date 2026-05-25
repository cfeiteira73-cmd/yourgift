// FILE: services/api/src/chaos/financial-chaos.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';

// ── Exported types ──────────────────────────────────────────────────────────

export type FinancialFailureScenario =
  | 'webhook_duplicate'
  | 'missing_webhook'
  | 'partial_commit'
  | 'refund_without_ledger'
  | 'invoice_job_lost'
  | 'duplicate_ledger_entry'
  | 'ghost_payment';

export interface FailureSimulationResult {
  scenarioId: string;
  scenario: FinancialFailureScenario;
  simulatedAt: Date;
  injectedFaults: string[];
  expectedDetectionMethod: string;
  detectedByReconciliation: boolean;
  repairEvents: string[];
  recoverySteps: string[];
}

export interface RecoveryGuarantee {
  scenario: string;
  detectable: boolean;
  recoverable: boolean;
  notes: string;
}

// ── Internal helpers ────────────────────────────────────────────────────────

function randomRef(): string {
  return `CHAOS-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

const CHAOS_TENANT = 'chaos_test';

// ── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class FinancialChaosService {
  private readonly logger = new Logger(FinancialChaosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  // ── Main entry point ────────────────────────────────────────────────────

  async simulateScenario(
    scenario: FinancialFailureScenario,
    targetOrderId?: string,
  ): Promise<FailureSimulationResult> {
    const scenarioId = `sim_${scenario}_${Date.now()}`;
    const simulatedAt = new Date();

    this.logger.warn(`[CHAOS] Injecting scenario: ${scenario} (id=${scenarioId})`);

    let result: FailureSimulationResult;

    switch (scenario) {
      case 'webhook_duplicate':
        result = await this.injectWebhookDuplicate(scenarioId, simulatedAt, targetOrderId);
        break;
      case 'missing_webhook':
        result = await this.injectMissingWebhook(scenarioId, simulatedAt, targetOrderId);
        break;
      case 'partial_commit':
        result = await this.injectPartialCommit(scenarioId, simulatedAt, targetOrderId);
        break;
      case 'refund_without_ledger':
        result = await this.injectRefundWithoutLedger(scenarioId, simulatedAt, targetOrderId);
        break;
      case 'invoice_job_lost':
        result = await this.injectInvoiceJobLost(scenarioId, simulatedAt, targetOrderId);
        break;
      case 'duplicate_ledger_entry':
        result = await this.injectDuplicateLedgerEntry(scenarioId, simulatedAt, targetOrderId);
        break;
      case 'ghost_payment':
        result = await this.injectGhostPayment(scenarioId, simulatedAt, targetOrderId);
        break;
    }

    // Append simulation audit record to event_log
    await this.prisma.eventLog.create({
      data: {
        entity: 'system',
        entityId: scenarioId,
        event: 'financial.chaos.injected',
        actorType: 'system',
        payload: {
          scenarioId,
          scenario,
          simulatedAt: simulatedAt.toISOString(),
          injectedFaults: result.injectedFaults,
        } as object,
      },
    }).catch((err: Error) => {
      this.logger.error(`Failed to log chaos injection event: ${err.message}`);
    });

    this.eventBus.emit('chaos.financial.injected', {
      scenarioId,
      scenario,
      simulatedAt: simulatedAt.toISOString(),
    });

    return result;
  }

  // ── Scenario: webhook_duplicate ─────────────────────────────────────────
  // Simulates a Stripe webhook delivered twice. Creates duplicate event in event_log.
  // Idempotency guard (StripeEvent table) should block the second processing.

  private async injectWebhookDuplicate(
    scenarioId: string,
    simulatedAt: Date,
    targetOrderId?: string,
  ): Promise<FailureSimulationResult> {
    const orderId = targetOrderId ?? await this.findOrCreateChaosOrder();
    const fakeStripeEventId = `evt_chaos_dup_${Date.now()}`;

    // Inject duplicate event_log entries — simulates the webhook handler firing twice
    await this.prisma.eventLog.createMany({
      data: [
        {
          orderId,
          entity: 'order',
          entityId: orderId,
          event: 'checkout.session.completed',
          actorType: 'system',
          payload: {
            stripeEventId: fakeStripeEventId,
            injectedByScenario: scenarioId,
            duplicate: false,
          } as object,
        },
        {
          orderId,
          entity: 'order',
          entityId: orderId,
          event: 'checkout.session.completed',
          actorType: 'system',
          payload: {
            stripeEventId: fakeStripeEventId,
            injectedByScenario: scenarioId,
            duplicate: true,
          } as object,
        },
      ],
    });

    return {
      scenarioId,
      scenario: 'webhook_duplicate',
      simulatedAt,
      injectedFaults: [
        `Duplicate event_log entries created for orderId=${orderId}`,
        `Both entries carry stripeEventId=${fakeStripeEventId}`,
      ],
      expectedDetectionMethod:
        'StripeEvent idempotency table: second insert of evt_id will violate unique constraint and abort processing. Event_log duplicate query: SELECT count(*) > 1 FROM event_logs WHERE event=checkout.session.completed AND payload->>stripeEventId = :id',
      detectedByReconciliation: false,
      repairEvents: [
        `Remove duplicate event_log entry for stripeEventId=${fakeStripeEventId}`,
        'Verify StripeEvent record exists to prevent future reprocessing',
      ],
      recoverySteps: [
        '1. Query event_log for duplicate (stripeEventId, event) pairs',
        '2. Keep the first entry, soft-delete or flag the duplicate',
        '3. Verify StripeEvent table has row for this evt_id',
        '4. Confirm order status is correct (paid once, not twice)',
        '5. Check LedgerTransaction — should have exactly one entry per order',
      ],
    };
  }

  // ── Scenario: missing_webhook ───────────────────────────────────────────
  // Creates an order with status='created' and a StripeEvent record saying it was paid,
  // but the order was never updated. Gap detectable by Stripe cross-check.

  private async injectMissingWebhook(
    scenarioId: string,
    simulatedAt: Date,
    targetOrderId?: string,
  ): Promise<FailureSimulationResult> {
    let orderId: string;

    if (targetOrderId) {
      orderId = targetOrderId;
    } else {
      // Create a new order in 'created' state
      const client = await this.prisma.client.findFirst({ select: { id: true } });
      if (!client) {
        return this.buildNoDataResult(scenarioId, 'missing_webhook', simulatedAt, 'No client found to create chaos order');
      }

      const order = await this.prisma.order.create({
        data: {
          ref: randomRef(),
          clientId: client.id,
          status: 'created',
          tenantId: CHAOS_TENANT,
          shippingAddress: { chaos: true, scenario: scenarioId } as object,
          stripePaymentId: `pi_chaos_missing_${Date.now()}`,
          totalAmount: 99.99,
        },
      });
      orderId = order.id;
    }

    // Create a StripeEvent record saying this payment was processed
    const fakeStripeEventId = `evt_chaos_missing_${Date.now()}`;
    await this.prisma.stripeEvent.create({
      data: {
        id: fakeStripeEventId,
        type: 'checkout.session.completed',
        processedAt: simulatedAt,
      },
    });

    // Log intent: order is 'created' but StripeEvent says it was completed
    await this.prisma.eventLog.create({
      data: {
        orderId,
        entity: 'order',
        entityId: orderId,
        event: 'chaos.missing_webhook.injected',
        actorType: 'system',
        payload: {
          scenarioId,
          fakeStripeEventId,
          orderStatus: 'created',
          note: 'StripeEvent exists but order was never updated to paid',
        } as object,
      },
    });

    return {
      scenarioId,
      scenario: 'missing_webhook',
      simulatedAt,
      injectedFaults: [
        `Order ${orderId} created with status='created'`,
        `StripeEvent ${fakeStripeEventId} created suggesting payment was processed`,
        `Order never transitioned to 'paid' — webhook was lost`,
      ],
      expectedDetectionMethod:
        'Stripe cross-check: PI with succeeded status in Stripe has orderId in metadata but DB order.status != paid. Also detectable via: orders with stripePaymentId but status != paid older than 1 hour.',
      detectedByReconciliation: false,
      repairEvents: [
        `order.payment_confirmed_repair for orderId=${orderId}`,
        'Update order status to paid',
        'Create LedgerTransaction for this order',
        'Emit order.paid event to trigger downstream (invoice, fulfillment)',
      ],
      recoverySteps: [
        '1. Query: SELECT * FROM orders WHERE status=created AND stripe_payment_id IS NOT NULL AND updated_at < NOW() - INTERVAL 1 HOUR',
        '2. For each found order, verify PI status in Stripe API',
        '3. If PI.status = succeeded: run repair — update order.status = paid, create ledger entry, emit order.paid',
        '4. If PI.status != succeeded: investigate payment failure',
        '5. Replay invoice.generate job for repaired orders',
      ],
    };
  }

  // ── Scenario: partial_commit ────────────────────────────────────────────
  // Creates a paid order with NO ledger entry — detectable by reconciliation drift.

  private async injectPartialCommit(
    scenarioId: string,
    simulatedAt: Date,
    targetOrderId?: string,
  ): Promise<FailureSimulationResult> {
    let orderId: string;
    let totalAmount: number;

    if (targetOrderId) {
      orderId = targetOrderId;
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        select: { totalAmount: true },
      });
      totalAmount = (order?.totalAmount ?? 0) as number;
    } else {
      const client = await this.prisma.client.findFirst({ select: { id: true } });
      if (!client) {
        return this.buildNoDataResult(scenarioId, 'partial_commit', simulatedAt, 'No client found');
      }
      totalAmount = 250.0;
      const order = await this.prisma.order.create({
        data: {
          ref: randomRef(),
          clientId: client.id,
          status: 'paid',
          tenantId: CHAOS_TENANT,
          shippingAddress: { chaos: true, scenario: scenarioId } as object,
          stripePaymentId: `pi_chaos_partial_${Date.now()}`,
          totalAmount,
        },
      });
      orderId = order.id;
    }

    // Intentionally omit creating LedgerTransaction — this is the partial commit fault
    await this.prisma.eventLog.create({
      data: {
        orderId,
        entity: 'order',
        entityId: orderId,
        event: 'chaos.partial_commit.injected',
        actorType: 'system',
        payload: {
          scenarioId,
          note: 'Order marked paid but no LedgerTransaction created — simulates partial commit',
          expectedLedgerAmount: totalAmount,
        } as object,
      },
    });

    return {
      scenarioId,
      scenario: 'partial_commit',
      simulatedAt,
      injectedFaults: [
        `Order ${orderId} set to status='paid' with totalAmount=${totalAmount}`,
        'No LedgerTransaction created for this order',
        'Simulates DB transaction that committed the order status update but rolled back the ledger write',
      ],
      expectedDetectionMethod:
        'Reconciliation drift check: sum(ledger_entries.amount WHERE account_code LIKE revenue%) != sum(orders.total_amount WHERE status=paid). Also: orphan_payment check finds orders with stripePaymentId but no LedgerTransaction.',
      detectedByReconciliation: false,
      repairEvents: [
        `Create LedgerTransaction for orderId=${orderId} amount=${totalAmount}`,
        'Post debit to AR (1100) and credit to Revenue (4000)',
        'Emit ledger.transaction.created event',
      ],
      recoverySteps: [
        '1. Identify orphan paid orders: SELECT o.id FROM orders o LEFT JOIN ledger_transactions lt ON lt.reference_id = o.id AND lt.reference_type = order WHERE o.status = paid AND lt.id IS NULL',
        '2. For each orphan, create LedgerTransaction with correct amount',
        '3. Post double-entry: debit AR, credit Revenue',
        '4. Recompute reconciliation run to verify drift is resolved',
        '5. Alert finance team with details of repaired transactions',
      ],
    };
  }

  // ── Scenario: refund_without_ledger ─────────────────────────────────────
  // Creates a Refund record with no corresponding LedgerTransaction.

  private async injectRefundWithoutLedger(
    scenarioId: string,
    simulatedAt: Date,
    targetOrderId?: string,
  ): Promise<FailureSimulationResult> {
    const orderId = targetOrderId ?? await this.findOrCreateChaosOrder('paid');
    const refundAmount = 49.99;

    // Create orphan Refund — no ledger entry
    const refund = await this.prisma.refund.create({
      data: {
        orderId,
        stripeRefundId: `re_chaos_${Date.now()}`,
        amount: refundAmount,
        currency: 'EUR',
        reason: 'chaos_scenario_refund_without_ledger',
        status: 'succeeded',
        refundedBy: 'chaos_engine',
        ledgerTxId: null, // intentionally orphaned
        metadata: { scenarioId, injected: true } as object,
      },
    });

    await this.prisma.eventLog.create({
      data: {
        orderId,
        entity: 'order',
        entityId: orderId,
        event: 'chaos.refund_without_ledger.injected',
        actorType: 'system',
        payload: {
          scenarioId,
          refundId: refund.id,
          amount: refundAmount,
          note: 'Refund created with no corresponding LedgerTransaction',
        } as object,
      },
    });

    return {
      scenarioId,
      scenario: 'refund_without_ledger',
      simulatedAt,
      injectedFaults: [
        `Refund ${refund.id} created for orderId=${orderId} amount=€${refundAmount}`,
        'No LedgerTransaction created to reverse the revenue entry',
        'ledgerTxId on Refund is NULL',
      ],
      expectedDetectionMethod:
        'Orphan refund check: SELECT r.id FROM refunds r WHERE r.ledger_tx_id IS NULL AND r.status = succeeded. Also detectable via reconciliation: total refunds do not match ledger credit notes.',
      detectedByReconciliation: false,
      repairEvents: [
        `Create LedgerTransaction reversing revenue for refundId=${refund.id}`,
        'Post debit to Revenue (4000) and credit to AR (1100)',
        `Update refunds SET ledger_tx_id = :newTxId WHERE id = ${refund.id}`,
      ],
      recoverySteps: [
        '1. Find orphan refunds: SELECT * FROM refunds WHERE ledger_tx_id IS NULL AND status = succeeded',
        '2. For each orphan refund, create a reversing LedgerTransaction',
        '3. Update refund.ledger_tx_id with the new transaction ID',
        '4. Verify ledger balance by re-running reconciliation',
        '5. Notify accounting team of the repaired entries',
      ],
    };
  }

  // ── Scenario: invoice_job_lost ──────────────────────────────────────────
  // Creates a paid order with no pending Job of type 'invoice.generate'.

  private async injectInvoiceJobLost(
    scenarioId: string,
    simulatedAt: Date,
    targetOrderId?: string,
  ): Promise<FailureSimulationResult> {
    const orderId = targetOrderId ?? await this.findOrCreateChaosOrder('paid');

    // Intentionally do NOT create a Job for invoice.generate
    await this.prisma.eventLog.create({
      data: {
        orderId,
        entity: 'order',
        entityId: orderId,
        event: 'chaos.invoice_job_lost.injected',
        actorType: 'system',
        payload: {
          scenarioId,
          note: 'Order paid but invoice.generate job was never enqueued — simulates job loss',
          orderId,
        } as object,
      },
    });

    return {
      scenarioId,
      scenario: 'invoice_job_lost',
      simulatedAt,
      injectedFaults: [
        `Order ${orderId} exists with status=paid`,
        'No Job of type invoice.generate was created for this order',
        'Simulates BullMQ job that was dropped before persistence',
      ],
      expectedDetectionMethod:
        'Missing invoice check: SELECT o.id FROM orders o LEFT JOIN jobs j ON j.type = invoice.generate AND (j.payload->>orderId) = o.id WHERE o.status = paid AND j.id IS NULL. Also: orders delivered > 48h with no invoice.generated event_log entry.',
      detectedByReconciliation: false,
      repairEvents: [
        `Enqueue Job { type: invoice.generate, payload: { orderId: ${orderId} } }`,
        `Emit order.invoice_required event for orderId=${orderId}`,
      ],
      recoverySteps: [
        '1. Query: SELECT o.id FROM orders o LEFT JOIN jobs j ON j.type=invoice.generate AND j.payload->>orderId = o.id WHERE o.status IN (paid, delivered) AND j.id IS NULL',
        '2. For each order without an invoice job, create a new Job record with type=invoice.generate',
        '3. Add job to BullMQ queue with high priority',
        '4. Monitor job completion and verify invoice.generated event_log entry is created',
        '5. Alert client with the invoice once generated',
      ],
    };
  }

  // ── Scenario: duplicate_ledger_entry ────────────────────────────────────
  // Creates two LedgerTransactions for the same orderId.

  private async injectDuplicateLedgerEntry(
    scenarioId: string,
    simulatedAt: Date,
    targetOrderId?: string,
  ): Promise<FailureSimulationResult> {
    const orderId = targetOrderId ?? await this.findOrCreateChaosOrder('paid');
    const amount = 199.99;

    // Find or create a ledger account
    let revenueAccount = await this.prisma.ledgerAccount.findFirst({
      where: { code: { startsWith: '4' }, isActive: true },
      select: { code: true },
    });

    if (!revenueAccount) {
      revenueAccount = await this.prisma.ledgerAccount.create({
        data: {
          code: '4000',
          name: 'Revenue',
          accountType: 'revenue',
          normalBalance: 'credit',
          isSystem: true,
          isActive: true,
        },
      });
    }

    const accountCode = revenueAccount.code;

    // Create first (legitimate) LedgerTransaction
    const tx1 = await this.prisma.ledgerTransaction.create({
      data: {
        description: `[CHAOS] Order ${orderId} payment — original`,
        referenceType: 'order',
        referenceId: orderId,
        totalAmount: amount,
        currency: 'EUR',
        tenantId: CHAOS_TENANT,
        entries: {
          create: [
            {
              accountCode,
              entryType: 'credit',
              amount,
              currency: 'EUR',
              description: `Revenue for order ${orderId}`,
              referenceType: 'order',
              referenceId: orderId,
              tenantId: CHAOS_TENANT,
            },
          ],
        },
      },
    });

    // Create second (duplicate) LedgerTransaction for the same order
    const tx2 = await this.prisma.ledgerTransaction.create({
      data: {
        description: `[CHAOS] Order ${orderId} payment — DUPLICATE`,
        referenceType: 'order',
        referenceId: orderId,
        totalAmount: amount,
        currency: 'EUR',
        tenantId: CHAOS_TENANT,
        entries: {
          create: [
            {
              accountCode,
              entryType: 'credit',
              amount,
              currency: 'EUR',
              description: `[DUPLICATE] Revenue for order ${orderId}`,
              referenceType: 'order',
              referenceId: orderId,
              tenantId: CHAOS_TENANT,
            },
          ],
        },
      },
    });

    await this.prisma.eventLog.create({
      data: {
        orderId,
        entity: 'order',
        entityId: orderId,
        event: 'chaos.duplicate_ledger_entry.injected',
        actorType: 'system',
        payload: {
          scenarioId,
          tx1Id: tx1.id,
          tx2Id: tx2.id,
          duplicatedAmount: amount,
        } as object,
      },
    });

    return {
      scenarioId,
      scenario: 'duplicate_ledger_entry',
      simulatedAt,
      injectedFaults: [
        `Two LedgerTransactions created for orderId=${orderId}`,
        `tx1=${tx1.id} (original), tx2=${tx2.id} (duplicate)`,
        `Each with amount=€${amount} — total ledger overstatement: €${(amount * 2).toFixed(2)}`,
      ],
      expectedDetectionMethod:
        'Duplicate charge check: SELECT reference_id, COUNT(*) FROM ledger_transactions WHERE reference_type = order GROUP BY reference_id HAVING COUNT(*) > 1. Also caught by drift check: ledger total > sum(orders.total_amount).',
      detectedByReconciliation: false,
      repairEvents: [
        `Void LedgerTransaction ${tx2.id} (the duplicate)`,
        'Post reversing entries to nullify the duplicate',
        'Add unique constraint or idempotency key to prevent future duplicates',
      ],
      recoverySteps: [
        '1. Identify duplicates: SELECT reference_id, array_agg(id) FROM ledger_transactions WHERE reference_type=order GROUP BY reference_id HAVING COUNT(*) > 1',
        '2. For each duplicate set, keep the earliest transaction, void the rest',
        '3. Create reversing LedgerTransactions for voided entries (debit Revenue, credit AR)',
        '4. Add idempotency key (reference_type + reference_id) as unique constraint or check at application level',
        '5. Rerun reconciliation to confirm drift is resolved',
      ],
    };
  }

  // ── Scenario: ghost_payment ─────────────────────────────────────────────
  // Creates a paid order with a stripePaymentId that doesn't exist in StripeEvent table.

  private async injectGhostPayment(
    scenarioId: string,
    simulatedAt: Date,
    targetOrderId?: string,
  ): Promise<FailureSimulationResult> {
    const fakePaymentIntentId = `pi_ghost_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    let orderId: string;

    if (targetOrderId) {
      orderId = targetOrderId;
      // Update the target order with the fake PI ID
      await this.prisma.order.update({
        where: { id: orderId },
        data: { stripePaymentId: fakePaymentIntentId },
      });
    } else {
      const client = await this.prisma.client.findFirst({ select: { id: true } });
      if (!client) {
        return this.buildNoDataResult(scenarioId, 'ghost_payment', simulatedAt, 'No client found');
      }
      const order = await this.prisma.order.create({
        data: {
          ref: randomRef(),
          clientId: client.id,
          status: 'paid',
          tenantId: CHAOS_TENANT,
          shippingAddress: { chaos: true, scenario: scenarioId } as object,
          stripePaymentId: fakePaymentIntentId,
          totalAmount: 175.0,
        },
      });
      orderId = order.id;
    }

    // Intentionally do NOT create a StripeEvent record for this PI
    await this.prisma.eventLog.create({
      data: {
        orderId,
        entity: 'order',
        entityId: orderId,
        event: 'chaos.ghost_payment.injected',
        actorType: 'system',
        payload: {
          scenarioId,
          fakePaymentIntentId,
          note: 'Order paid with stripePaymentId that has no StripeEvent record — ghost payment',
        } as object,
      },
    });

    return {
      scenarioId,
      scenario: 'ghost_payment',
      simulatedAt,
      injectedFaults: [
        `Order ${orderId} set to status=paid with stripePaymentId=${fakePaymentIntentId}`,
        `No StripeEvent record exists for ${fakePaymentIntentId}`,
        'Simulates a payment that was never actually processed by Stripe',
      ],
      expectedDetectionMethod:
        'Stripe cross-check: orders.stripe_payment_id not found in Stripe API paymentIntents.list(). Also: SELECT o.id FROM orders o LEFT JOIN stripe_events se ON se.id = o.stripe_payment_id WHERE o.status = paid AND se.id IS NULL.',
      detectedByReconciliation: false,
      repairEvents: [
        `Verify ${fakePaymentIntentId} against Stripe API`,
        `If PI not found: revert order.status to created and alert fraud team`,
        `If PI found but not in StripeEvent table: add StripeEvent record and validate`,
      ],
      recoverySteps: [
        '1. Query: SELECT o.id, o.stripe_payment_id FROM orders o LEFT JOIN stripe_events se ON se.id = o.stripe_payment_id WHERE o.status = paid AND o.stripe_payment_id IS NOT NULL AND se.id IS NULL',
        '2. For each ghost payment candidate, call Stripe API: paymentIntents.retrieve(pi_id)',
        '3. If PI not found in Stripe: flag as potential fraud, revert order to created status',
        '4. If PI found with status=succeeded: add StripeEvent record, order is legitimate',
        '5. If PI found with status!=succeeded: revert order, investigate',
        '6. Alert fraud/finance team regardless of outcome',
      ],
    };
  }

  // ── Full simulation suite ───────────────────────────────────────────────

  async runFullSimulationSuite(): Promise<FailureSimulationResult[]> {
    const scenarios: FinancialFailureScenario[] = [
      'webhook_duplicate',
      'missing_webhook',
      'partial_commit',
      'refund_without_ledger',
      'invoice_job_lost',
      'duplicate_ledger_entry',
      'ghost_payment',
    ];

    const results: FailureSimulationResult[] = [];

    for (const scenario of scenarios) {
      try {
        this.logger.log(`[CHAOS SUITE] Running scenario: ${scenario}`);
        const result = await this.simulateScenario(scenario);
        results.push(result);
      } catch (err) {
        this.logger.error(
          `[CHAOS SUITE] Scenario ${scenario} threw an error: ${(err as Error).message}`,
          (err as Error).stack,
        );
        // Create a failure result so the suite continues
        results.push({
          scenarioId: `sim_${scenario}_failed`,
          scenario,
          simulatedAt: new Date(),
          injectedFaults: [`Scenario failed to inject: ${(err as Error).message}`],
          expectedDetectionMethod: 'N/A — injection failed',
          detectedByReconciliation: false,
          repairEvents: [],
          recoverySteps: [`Fix injection error: ${(err as Error).message}`],
        });
      }
    }

    this.eventBus.emit('chaos.financial.suite.completed', {
      completedAt: new Date().toISOString(),
      scenariosRun: scenarios.length,
      resultsCount: results.length,
    });

    return results;
  }

  // ── Static recovery guarantees analysis ────────────────────────────────

  verifyRecoveryGuarantees(): RecoveryGuarantee[] {
    return [
      {
        scenario: 'webhook_duplicate',
        detectable: true,
        recoverable: true,
        notes:
          'Detected by StripeEvent unique constraint (PRIMARY KEY on evt_id) blocking double-insert. Recoverable by removing the extra event_log entry and verifying single LedgerTransaction.',
      },
      {
        scenario: 'missing_webhook',
        detectable: true,
        recoverable: true,
        notes:
          'Detected by Stripe cross-check: PI succeeded in Stripe but order.status != paid. Recoverable by replaying order.paid event and creating LedgerTransaction + invoice job.',
      },
      {
        scenario: 'partial_commit',
        detectable: true,
        recoverable: true,
        notes:
          'Detected by orphan_payment reconciliation check (paid order with no LedgerTransaction) and drift check. Recoverable by creating the missing LedgerTransaction.',
      },
      {
        scenario: 'refund_without_ledger',
        detectable: true,
        recoverable: true,
        notes:
          'Detected by checking refunds.ledger_tx_id IS NULL. Recoverable by creating a reversing LedgerTransaction and linking it to the refund record.',
      },
      {
        scenario: 'invoice_job_lost',
        detectable: true,
        recoverable: true,
        notes:
          'Detected by missing invoice check: paid orders with no invoice.generated event_log entry older than 48h. Recoverable by re-enqueuing the invoice.generate job.',
      },
      {
        scenario: 'duplicate_ledger_entry',
        detectable: true,
        recoverable: true,
        notes:
          'Detected by duplicate charge check and ledger drift. Recoverable by voiding the duplicate LedgerTransaction with reversing entries. Prevention: add DB unique constraint on (reference_type, reference_id) or application-level idempotency.',
      },
      {
        scenario: 'ghost_payment',
        detectable: true,
        recoverable: true,
        notes:
          'Detected by Stripe cross-check (PI not in Stripe API) or by LEFT JOIN orders/stripe_events. Recoverable by reverting order status; may indicate fraud requiring escalation.',
      },
    ];
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  private async findOrCreateChaosOrder(status = 'created'): Promise<string> {
    const existing = await this.prisma.order.findFirst({
      where: { tenantId: CHAOS_TENANT, status },
      select: { id: true },
    });

    if (existing) return existing.id;

    const client = await this.prisma.client.findFirst({ select: { id: true } });
    if (!client) {
      throw new Error('No client found in DB — cannot create chaos order');
    }

    const order = await this.prisma.order.create({
      data: {
        ref: randomRef(),
        clientId: client.id,
        status,
        tenantId: CHAOS_TENANT,
        shippingAddress: { chaos: true } as object,
        totalAmount: 100.0,
        ...(status === 'paid' ? { stripePaymentId: `pi_chaos_base_${Date.now()}` } : {}),
      },
    });

    return order.id;
  }

  private buildNoDataResult(
    scenarioId: string,
    scenario: FinancialFailureScenario,
    simulatedAt: Date,
    reason: string,
  ): FailureSimulationResult {
    return {
      scenarioId,
      scenario,
      simulatedAt,
      injectedFaults: [`Injection skipped: ${reason}`],
      expectedDetectionMethod: 'N/A — no data available to inject fault',
      detectedByReconciliation: false,
      repairEvents: [],
      recoverySteps: ['Ensure seed data exists in the database before running chaos scenarios'],
    };
  }
}
