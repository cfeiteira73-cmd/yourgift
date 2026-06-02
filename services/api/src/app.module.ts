import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { TelemetryModule } from './common/telemetry/telemetry.module';
import { PiiModule } from './common/pii/pii.module';
import { OrdersModule } from './orders/orders.module';
import { ProductsModule } from './products/products.module';
import { AuthModule } from './auth/auth.module';
import { PricingModule } from './pricing/pricing.module';
import { PaymentsModule } from './payments/payments.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { ArtworkModule } from './artwork/artwork.module';
import { PrismaModule } from './prisma/prisma.module';
import { EventBusModule } from './events/event-bus.module';
import { HealthModule } from './health/health.module';
import { QuotesModule } from './quotes/quotes.module';
import { ApprovalsModule } from './approvals/approvals.module';
import { BudgetsModule } from './budgets/budgets.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { CompanyStoresModule } from './company-stores/company-stores.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AiModule } from './ai/ai.module';
import { AdminAuthModule } from './admin-auth/admin-auth.module';
import { SlackModule } from './slack/slack.module';
import { JobsModule } from './jobs/jobs.module';
import { HubSpotModule } from './hubspot/hubspot.module';
import { NotionModule } from './notion/notion.module';
import { InventoryModule } from './inventory/inventory.module';
import { ClientsModule } from './clients/clients.module';
import { CompaniesModule } from './companies/companies.module';
import { BambooHRModule } from './bamboohr/bamboohr.module';
import { RetentionModule } from './retention/retention.module';
import { HiBobModule } from './hibob/hibob.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { StorePortalModule } from './store-portal/store-portal.module';
import { EventLogModule } from './event-log/event-log.module';
import { EventSourcingModule } from './event-sourcing/event-sourcing.module';
import { CurrencyModule } from './currency/currency.module';
import { TeamsModule } from './teams/teams.module';
import { FinancialModule } from './financial/financial.module';
import { IntelligenceModule } from './intelligence/intelligence.module';
import { ProjectionsModule } from './projections/projections.module';
import { LedgerModule } from './ledger/ledger.module';
import { AutomationModule } from './automation/automation.module';
import { TenantsModule } from './tenants/tenants.module';
import { FinancialIntelligenceModule } from './financial-intelligence/financial-intelligence.module';
import { WorkflowsModule } from './workflows/workflows.module';
import { AIDesignModule } from './ai-design/ai-design.module';
import { EventPlatformModule } from './event-platform/event-platform.module';
import { FinancialConsolidationModule } from './financial-consolidation/financial-consolidation.module';
import { ProductionModule } from './production/production.module';
import { CustomerSuccessModule } from './customer-success/customer-success.module';
import { EmployeePortalModule } from './employee-portal/employee-portal.module';
import { ObservabilityModule } from './observability/observability.module';
import { GlobalizationModule } from './globalization/globalization.module';
import { LogisticsModule } from './logistics/logistics.module';
import { MarginProtectionModule } from './margin-protection/margin-protection.module';
import { ProcurementAgentModule } from './procurement-agent/procurement-agent.module';
import { DecisionEngineModule } from './decision-engine/decision-engine.module';
import { NetworkIntelligenceModule } from './network-intelligence/network-intelligence.module';
import { GovernanceModule } from './governance/governance.module';
import { ProofEngineModule } from './proof-engine/proof-engine.module';
import { CategoryIntelligenceModule } from './category-intelligence/category-intelligence.module';
import { CashFlowModule } from './cash-flow/cash-flow.module';
import { BudgetLedgerModule } from './budget-ledger/budget-ledger.module';
import { PolicyExecutionModule } from './policy-execution/policy-execution.module';
import { ProcurementWorkflowModule } from './procurement-workflow/procurement-workflow.module';
import { FailsafeModule } from './failsafe/failsafe.module';
import { QueueModule } from './queue/queue.module';
import { WorkersModule } from './queue/workers/workers.module';
import { EnterpriseIdentityModule } from './enterprise-identity/enterprise-identity.module';
import { TracingModule } from './tracing/tracing.module';
import { IncidentModule } from './incident/incident.module';
import { ReconciliationModule } from './reconciliation/reconciliation.module';
import { RecoveryModule } from './recovery/recovery.module';
import { RateLimitModule } from './rate-limit/rate-limit.module';
import { ReliabilityModule } from './reliability/reliability.module';
import { ModelOpsModule } from './model-ops/model-ops.module';
import { ChaosModule } from './chaos/chaos.module';
import { TenantEconomicsModule } from './tenant-economics/tenant-economics.module';
import { DataPlatformModule } from './data-platform/data-platform.module';
import { RefundsModule } from './refunds/refunds.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { RfqModule } from './rfq/rfq.module';
import { FulfillmentModule } from './fulfillment/fulfillment.module';
import { CartModule } from './cart/cart.module';
import { InvoicesModule } from './invoices/invoices.module';
import { FinancialReplayModule } from './financial-replay/financial-replay.module';
import { SreModule } from './sre/sre.module';
import { CostIntelligenceModule } from './cost-intelligence/cost-intelligence.module';
import { LearningLoopModule } from './learning-loop/learning-loop.module';
import { ControlPlaneModule } from './control-plane/control-plane.module';
import { CommerceIntelligenceModule } from './commerce-intelligence/commerce-intelligence.module';
import { SecurityCertificationModule } from './security-certification/security-certification.module';
import { FinancialTraceModule } from './financial-trace/financial-trace.module';
import { LifecycleModule } from './lifecycle/lifecycle.module';
import { MaturityModule } from './maturity/maturity.module';
import { ProductionActivationModule } from './production-activation/production-activation.module';
import { StripeRecoveryModule } from './stripe-recovery/stripe-recovery.module';
import { OperationalDashboardModule } from './operational-dashboard/operational-dashboard.module';
import { ErrorBudgetModule } from './error-budget/error-budget.module';
import { CustomerOpsModule } from './customer-ops/customer-ops.module';
import { DeploymentSafetyModule } from './deployment-safety/deployment-safety.module';
import { GoLiveModule } from './go-live/go-live.module';
import { LiveValidationModule } from './live-validation/live-validation.module';
import { FinancialTruthModule } from './financial-truth/financial-truth.module';
import { OperationsCenterModule } from './operations-center/operations-center.module';
import { SupportOpsModule } from './support-ops/support-ops.module';
import { BusinessRealityModule } from './business-reality/business-reality.module';
import { FailureLabModule } from './failure-lab/failure-lab.module';
import { ReportGeneratorModule } from './report-generator/report-generator.module';
import { SystemStateModule } from './system-state/system-state.module';
import { FinancialCausalityModule } from './financial-causality/financial-causality.module';
import { ProductionPipelineModule } from './production-pipeline/production-pipeline.module';
import { FulfillmentEngineModule } from './fulfillment-engine/fulfillment-engine.module';
import { ShipmentTrackingModule } from './shipment-tracking/shipment-tracking.module';
import { CustomerPortalModule } from './customer-portal/customer-portal.module';
import { SupportTicketsModule } from './support-tickets/support-tickets.module';
import { OperationsHubModule } from './operations-hub/operations-hub.module';
import { SupplierRoutingModule } from './supplier-routing/supplier-routing.module';
import { SupplierIntelligenceModule } from './supplier-intelligence/supplier-intelligence.module';
import { FilePipelineModule } from './file-pipeline/file-pipeline.module';
import { ProductionSimulationModule } from './production-simulation/production-simulation.module';
import { MakitoModule } from './makito/makito.module';
import { APP_GUARD } from '@nestjs/core';
import { TenantGuard } from './common/guards/tenant.guard';
import { TenantThrottlerGuard } from './common/throttler/tenant-throttler.guard';

@Module({
  imports: [
    TelemetryModule,
    PiiModule,
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,   // 1 second
        limit: 20,   // 20 requests/second
      },
      {
        name: 'long',
        ttl: 60_000, // 1 minute
        limit: 200,  // 200 requests/minute
      },
    ]),
    PrismaModule,
    EventBusModule,
    HealthModule,
    AuthModule,
    ProductsModule,
    OrdersModule,
    PricingModule,
    PaymentsModule,
    SuppliersModule,
    MakitoModule,
    ArtworkModule,
    QuotesModule,
    ApprovalsModule,
    BudgetsModule,
    CampaignsModule,
    AnalyticsModule,
    CompanyStoresModule,
    NotificationsModule,
    AiModule,
    AdminAuthModule,
    SlackModule,
    JobsModule,
    HubSpotModule,
    NotionModule,
    InventoryModule,
    ClientsModule,
    CompaniesModule,
    BambooHRModule,
    WebhooksModule,
    StorePortalModule,
    EventLogModule,
    EventSourcingModule,
    CurrencyModule,
    TeamsModule,
    FinancialModule,
    RetentionModule,
    HiBobModule,
    IntelligenceModule,
    ProjectionsModule,
    LedgerModule,
    AutomationModule,
    TenantsModule,
    FinancialIntelligenceModule,
    WorkflowsModule,
    AIDesignModule,
    EventPlatformModule,
    FinancialConsolidationModule,
    ProductionModule,
    CustomerSuccessModule,
    EmployeePortalModule,
    ObservabilityModule,
    GlobalizationModule,
    LogisticsModule,
    MarginProtectionModule,
    ProcurementAgentModule,
    DecisionEngineModule,
    NetworkIntelligenceModule,
    GovernanceModule,
    ProofEngineModule,
    CategoryIntelligenceModule,
    CashFlowModule,
    BudgetLedgerModule,
    PolicyExecutionModule,
    ProcurementWorkflowModule,
    FailsafeModule,
    QueueModule,
    WorkersModule,
    EnterpriseIdentityModule,
    TracingModule,
    IncidentModule,
    ReconciliationModule,
    RecoveryModule,
    RateLimitModule,
    ReliabilityModule,
    ModelOpsModule,
    ChaosModule,
    TenantEconomicsModule,
    DataPlatformModule,
    RefundsModule,
    SubscriptionsModule,
    RfqModule,
    FulfillmentModule,
    CartModule,
    InvoicesModule,
    FinancialReplayModule,
    SreModule,
    CostIntelligenceModule,
    LearningLoopModule,
    ControlPlaneModule,
    CommerceIntelligenceModule,
    SecurityCertificationModule,
    FinancialTraceModule,
    LifecycleModule,
    MaturityModule,
    ProductionActivationModule,
    StripeRecoveryModule,
    OperationalDashboardModule,
    ErrorBudgetModule,
    CustomerOpsModule,
    DeploymentSafetyModule,
    GoLiveModule,
    LiveValidationModule,
    FinancialTruthModule,
    OperationsCenterModule,
    SupportOpsModule,
    BusinessRealityModule,
    FailureLabModule,
    ReportGeneratorModule,
    SystemStateModule,
    FinancialCausalityModule,
    ProductionPipelineModule,
    FulfillmentEngineModule,
    ShipmentTrackingModule,
    CustomerPortalModule,
    SupportTicketsModule,
    OperationsHubModule,
    SupplierRoutingModule,
    SupplierIntelligenceModule,
    FilePipelineModule,
    ProductionSimulationModule,
  ],
  providers: [
    // Rate limiting — per tenant (not per IP) for authenticated requests
    { provide: APP_GUARD, useClass: TenantThrottlerGuard },
    // Multi-tenant data isolation
    { provide: APP_GUARD, useClass: TenantGuard },
  ],
})
export class AppModule {}
