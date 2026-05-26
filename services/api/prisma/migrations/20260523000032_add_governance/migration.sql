-- GAP-OS: Governance Layer, Trust Engine, Decision Traces (Sprint 16)

CREATE TABLE "governance_policies" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT,
  "policyType" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "config" JSONB NOT NULL DEFAULT '{}',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "priority" INTEGER NOT NULL DEFAULT 100,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "governance_policies_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "governance_policies_policyType_idx" ON "governance_policies"("policyType");
CREATE INDEX "governance_policies_tenantId_idx" ON "governance_policies"("tenantId");

CREATE TABLE "policy_violations" (
  "id" TEXT NOT NULL,
  "policyId" TEXT NOT NULL,
  "decisionCardId" TEXT,
  "triggerContext" JSONB NOT NULL DEFAULT '{}',
  "violationType" TEXT NOT NULL,
  "blockedAction" TEXT NOT NULL,
  "resolvedAction" TEXT NOT NULL DEFAULT 'escalated',
  "resolvedBy" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "policy_violations_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "policy_violations_policyId_idx" ON "policy_violations"("policyId");
CREATE INDEX "policy_violations_createdAt_idx" ON "policy_violations"("createdAt");

CREATE TABLE "decision_traces" (
  "id" TEXT NOT NULL,
  "decisionCardId" TEXT,
  "traceType" TEXT NOT NULL DEFAULT 'order_triggered',
  "inputSnapshot" JSONB NOT NULL DEFAULT '{}',
  "simulationResults" JSONB NOT NULL DEFAULT '[]',
  "selectedAction" TEXT,
  "governanceStatus" TEXT NOT NULL DEFAULT 'pending',
  "governanceReason" TEXT,
  "executionStatus" TEXT NOT NULL DEFAULT 'pending',
  "executionResult" JSONB,
  "outcomeRecorded" BOOLEAN NOT NULL DEFAULT false,
  "outcomeData" JSONB,
  "trustScore" DECIMAL(5,2),
  "autonomyLevel" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "decision_traces_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "decision_traces_decisionCardId_idx" ON "decision_traces"("decisionCardId");
CREATE INDEX "decision_traces_createdAt_idx" ON "decision_traces"("createdAt");

CREATE TABLE "trust_scores" (
  "id" TEXT NOT NULL,
  "context" TEXT NOT NULL,
  "contextValue" TEXT NOT NULL,
  "explainabilityScore" DECIMAL(5,2) NOT NULL DEFAULT 80,
  "benchmarkDeviationScore" DECIMAL(5,2) NOT NULL DEFAULT 75,
  "historicalAccuracyScore" DECIMAL(5,2) NOT NULL DEFAULT 70,
  "governanceComplianceScore" DECIMAL(5,2) NOT NULL DEFAULT 90,
  "overrideFrequencyScore" DECIMAL(5,2) NOT NULL DEFAULT 85,
  "compositeScore" DECIMAL(5,2) NOT NULL DEFAULT 80,
  "autonomyLevelGranted" INTEGER NOT NULL DEFAULT 2,
  "sampleCount" INTEGER NOT NULL DEFAULT 0,
  "lastDecayAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "trust_scores_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "trust_scores_context_contextValue_key" ON "trust_scores"("context","contextValue");

CREATE TABLE "trust_events" (
  "id" TEXT NOT NULL,
  "trustScoreId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "impact" TEXT NOT NULL DEFAULT 'positive',
  "deltaScore" DECIMAL(6,3) NOT NULL DEFAULT 0,
  "context" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "trust_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "trust_events_trustScoreId_idx" ON "trust_events"("trustScoreId");

-- Seed: 5 global governance policies (one per type)
INSERT INTO "governance_policies" ("id","policyType","name","description","config","priority") VALUES
('gp-learning','learning','Global Learning Policy','Controls which signals influence the cross-tenant model','{"weightRecentEvents":0.7,"outlierSuppressionThreshold":3,"minTenantSampleSize":10,"decayFactor":0.95}',100),
('gp-execution','execution','Global Execution Policy','Autonomy thresholds for auto-execution','{"maxAutoExecuteRiskScore":35,"requireApprovalAbove":60,"blockAbove":85,"maxDailyAutoExecutions":50}',100),
('gp-financial','financial','Global Financial Policy','Margin floors and cost safety bands','{"marginFloorPct":12,"maxCostVariancePct":25,"priceSafetyBandPct":20,"maxSingleOrderEur":50000}',100),
('gp-supplier','supplier','Global Supplier Policy','Supplier approval and fallback rules','{"requireApprovedList":false,"fallbackRoutingEnabled":true,"maxSingleSupplierDependencyPct":60,"minGlobalReliabilityScore":70}',100),
('gp-audit','audit','Global Audit Policy','Traceability and retention requirements','{"fullTraceRequired":true,"immutableLogs":true,"retentionDays":365,"alertOnViolation":true}',100);

-- Seed: trust scores for 6 key suppliers
INSERT INTO "trust_scores" ("id","context","contextValue","explainabilityScore","benchmarkDeviationScore","historicalAccuracyScore","governanceComplianceScore","overrideFrequencyScore","compositeScore","autonomyLevelGranted","sampleCount") VALUES
('ts-mid','supplier','mid',85.0,82.0,88.0,95.0,90.0,87.2,2,412),
('ts-pfc','supplier','pfc',82.0,79.0,84.0,93.0,87.0,84.1,2,387),
('ts-dhl','supplier','dhl',91.0,89.0,93.0,98.0,95.0,92.4,3,834),
('ts-fedex','supplier','fedex',89.0,87.0,91.0,97.0,93.0,90.6,3,621),
('ts-ups','supplier','ups',86.0,84.0,88.0,95.0,91.0,87.8,2,543),
('ts-dpd','supplier','dpd',78.0,75.0,80.0,90.0,84.0,79.8,2,298);
