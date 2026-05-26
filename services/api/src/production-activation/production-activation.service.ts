import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import Stripe from 'stripe';

export interface LiveMoneyStatus {
  checkedAt: Date;
  isLiveMode: boolean;
  stripeKeyValid: boolean;
  webhookSecretConfigured: boolean;
  webhookEndpointHealthy: boolean;
  payoutAccountActive: boolean;
  chargesEnabled: boolean;
  disputeWebhookConfigured: boolean;
  refundWebhookConfigured: boolean;
  settlementEventsEnabled: boolean;
  pendingDisputesCount: number;
  recentFailedWebhooks: number;
  reconciliationClean: boolean;
  goLiveVerdict: 'READY' | 'NOT_READY' | 'READY_TEST_MODE';
  blockers: string[];
  warnings: string[];
}

const REQUIRED_EVENTS = [
  'checkout.session.completed',
  'checkout.session.expired',
  'payment_intent.payment_failed',
  'charge.refunded',
  'charge.dispute.created',
  'charge.dispute.closed',
];

@Injectable()
export class ProductionActivationService {
  private readonly logger = new Logger(ProductionActivationService.name);
  private readonly stripe: Stripe;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.stripe = new Stripe(this.config.getOrThrow('STRIPE_KEY'), {
      apiVersion: '2023-10-16',
      timeout: 15_000,
      maxNetworkRetries: 1,
    });
  }

  async getLiveMoneyStatus(): Promise<LiveMoneyStatus> {
    const checkedAt = new Date();
    const stripeKey = this.config.get('STRIPE_KEY', '');
    const webhookSecret = this.config.get('STRIPE_WEBHOOK_SECRET', '');
    const isLiveMode = stripeKey.startsWith('sk_live_');
    const webhookSecretConfigured =
      webhookSecret.startsWith('whsec_') && !webhookSecret.includes('placeholder');

    const blockers: string[] = [];
    const warnings: string[] = [];

    // ── Stripe account ─────────────────────────────────────────────────────
    let stripeKeyValid = false;
    let payoutAccountActive = false;
    let chargesEnabled = false;
    try {
      const account = await this.stripe.accounts.retrieve();
      stripeKeyValid = true;
      payoutAccountActive = account.payouts_enabled ?? false;
      chargesEnabled = account.charges_enabled ?? false;
      if (!payoutAccountActive) blockers.push('Stripe payouts not enabled — complete KYC/onboarding');
      if (!chargesEnabled) blockers.push('Stripe charges not enabled — account not fully activated');
    } catch (err) {
      blockers.push(`Stripe API unreachable or key invalid: ${(err as Error).message}`);
    }

    // ── Webhook endpoints ──────────────────────────────────────────────────
    let disputeWebhookConfigured = false;
    let refundWebhookConfigured = false;
    let settlementEventsEnabled = false;
    try {
      const endpoints = await this.stripe.webhookEndpoints.list({ limit: 20 });
      const allEvents = endpoints.data
        .filter(ep => ep.status === 'enabled')
        .flatMap(ep => ep.enabled_events);
      const hasAll = (ev: string) => allEvents.includes(ev) || allEvents.includes('*');
      disputeWebhookConfigured = hasAll('charge.dispute.created');
      refundWebhookConfigured = hasAll('charge.refunded');
      settlementEventsEnabled = hasAll('checkout.session.completed');
      const missing = REQUIRED_EVENTS.filter(ev => !hasAll(ev));
      if (missing.length > 0)
        blockers.push(`Missing Stripe webhook events: ${missing.join(', ')}`);
      if (endpoints.data.filter(ep => ep.status === 'enabled').length === 0)
        blockers.push('No active Stripe webhook endpoints registered');
    } catch {
      warnings.push('Could not verify Stripe webhook endpoint configuration');
    }

    // ── Webhook delivery health ────────────────────────────────────────────
    const since24h = new Date(Date.now() - 86_400_000);
    const [failedWh, totalWh] = await Promise.all([
      this.prisma.webhookDelivery.count({ where: { success: false, createdAt: { gte: since24h } } }),
      this.prisma.webhookDelivery.count({ where: { createdAt: { gte: since24h } } }),
    ]);
    const whFailRate = totalWh > 0 ? failedWh / totalWh : 0;
    const webhookEndpointHealthy = whFailRate < 0.1;
    if (!webhookEndpointHealthy && totalWh > 10)
      warnings.push(`Webhook failure rate ${(whFailRate * 100).toFixed(1)}% last 24h (${failedWh}/${totalWh})`);

    // ── Open disputes ──────────────────────────────────────────────────────
    let pendingDisputesCount = 0;
    try {
      const disputes = await this.stripe.disputes.list({ limit: 20 });
      pendingDisputesCount = disputes.data.filter(
        d => !['won', 'lost', 'charge_refunded'].includes(d.status),
      ).length;
      if (pendingDisputesCount > 0)
        warnings.push(`${pendingDisputesCount} open dispute(s) — check Stripe dashboard`);
    } catch {
      warnings.push('Could not check open disputes');
    }

    // ── Reconciliation ─────────────────────────────────────────────────────
    const lastRecon = await this.prisma.eventLog.findFirst({
      where: { event: 'reconciliation.hourly_complete' },
      orderBy: { createdAt: 'desc' },
    });
    const reconciliationClean = lastRecon
      ? ((lastRecon.payload as Record<string, unknown>)['criticalCount'] as number) === 0
      : false;
    if (!lastRecon)
      warnings.push('No reconciliation runs found — scheduler may not have started yet');
    else if (!reconciliationClean)
      blockers.push('Last reconciliation detected critical drift — resolve before go-live');

    if (!isLiveMode)
      warnings.push('Stripe is in TEST mode. Switch STRIPE_KEY to sk_live_ in Render env vars.');
    if (!webhookSecretConfigured)
      blockers.push('STRIPE_WEBHOOK_SECRET not configured or is placeholder');

    const goLiveVerdict: LiveMoneyStatus['goLiveVerdict'] =
      blockers.length > 0 ? 'NOT_READY' : !isLiveMode ? 'READY_TEST_MODE' : 'READY';

    this.logger.log(`Live money check: ${goLiveVerdict} | blockers=${blockers.length} warnings=${warnings.length}`);

    return {
      checkedAt, isLiveMode, stripeKeyValid, webhookSecretConfigured,
      webhookEndpointHealthy, payoutAccountActive, chargesEnabled,
      disputeWebhookConfigured, refundWebhookConfigured, settlementEventsEnabled,
      pendingDisputesCount, recentFailedWebhooks: failedWh, reconciliationClean,
      goLiveVerdict, blockers, warnings,
    };
  }
}
