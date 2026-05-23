import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
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
import { ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
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
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
