-- Proof Engine: financial impact + onboarding + adoption modes (Sprint 17)

CREATE TABLE "proof_records" (
  "id" TEXT NOT NULL,
  "decisionCardId" TEXT,
  "traceId" TEXT,
  "tenantHash" TEXT NOT NULL DEFAULT 'global',
  "savedCostEur" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "avoidedCostEur" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "marginImpactEur" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "timeSavedHours" DECIMAL(8,2) NOT NULL DEFAULT 0,
  "timeSavedValueEur" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "totalValueEur" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "category" TEXT,
  "supplierCode" TEXT,
  "region" TEXT,
  "period" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'decision_engine',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "proof_records_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "proof_records_period_idx" ON "proof_records"("period");
CREATE INDEX "proof_records_tenantHash_idx" ON "proof_records"("tenantHash");
CREATE INDEX "proof_records_supplierCode_idx" ON "proof_records"("supplierCode");

CREATE TABLE "onboarding_sessions" (
  "id" TEXT NOT NULL,
  "tenantHash" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "rawDataSummary" JSONB NOT NULL DEFAULT '{}',
  "inefficiencies" JSONB NOT NULL DEFAULT '[]',
  "savingsOpportunities" JSONB NOT NULL DEFAULT '[]',
  "supplierRiskReport" JSONB NOT NULL DEFAULT '{}',
  "totalSavingsPotentialEur" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "onboarding_sessions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "onboarding_sessions_tenantHash_idx" ON "onboarding_sessions"("tenantHash");

CREATE TABLE "tenant_adoption_modes" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "mode" TEXT NOT NULL DEFAULT 'shadow',
  "shadowSimulationsRun" INTEGER NOT NULL DEFAULT 0,
  "shadowSavingsIdentifiedEur" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "modesHistory" JSONB NOT NULL DEFAULT '[]',
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tenant_adoption_modes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tenant_adoption_modes_tenantId_key" ON "tenant_adoption_modes"("tenantId");

-- Seed: 36 realistic proof records (3 months, varied categories + suppliers)
-- Period 2026-03 (12 records)
INSERT INTO "proof_records" ("id","tenantHash","savedCostEur","avoidedCostEur","marginImpactEur","timeSavedHours","timeSavedValueEur","totalValueEur","category","supplierCode","region","period","source") VALUES
('pr-0001','a3f2b891',1240.00,380.00,520.00,8.5,340.00,2480.00,'apparel','mid','EU','2026-03','decision_engine'),
('pr-0002','b7c4d321',890.00,210.00,340.00,4.0,160.00,1600.00,'tech','dhl','EU','2026-03','decision_engine'),
('pr-0003','c9e5f412',2100.00,650.00,780.00,12.0,480.00,4010.00,'lifestyle','pfc','EU','2026-03','decision_engine'),
('pr-0004','a3f2b891',560.00,180.00,240.00,3.0,120.00,1100.00,'gifts','mid','EU','2026-03','margin_protection'),
('pr-0005','d2a1c843',3200.00,920.00,1100.00,18.0,720.00,5940.00,'apparel','fedex','US','2026-03','decision_engine'),
('pr-0006','e8f3b254',780.00,290.00,410.00,5.5,220.00,1700.00,'tech','ups','EU','2026-03','decision_engine'),
('pr-0007','b7c4d321',1450.00,410.00,590.00,9.0,360.00,2810.00,'lifestyle','mid','EU','2026-03','ai_agent'),
('pr-0008','f1a4c365',2890.00,840.00,1050.00,15.0,600.00,5380.00,'apparel','dhl','EU','2026-03','decision_engine'),
('pr-0009','a3f2b891',670.00,200.00,290.00,4.5,180.00,1340.00,'gifts','pfc','EU','2026-03','margin_protection'),
('pr-0010','g5b2d476',1890.00,540.00,720.00,11.0,440.00,3590.00,'tech','fedex','US','2026-03','decision_engine'),
('pr-0011','c9e5f412',440.00,140.00,180.00,2.5,100.00,860.00,'lifestyle','dpd','EU','2026-03','decision_engine'),
('pr-0012','h6c3e587',3410.00,980.00,1240.00,20.0,800.00,6430.00,'apparel','mid','EU','2026-03','ai_agent'),
-- Period 2026-04 (12 records)
('pr-0013','a3f2b891',1380.00,420.00,580.00,9.0,360.00,2740.00,'apparel','mid','EU','2026-04','decision_engine'),
('pr-0014','b7c4d321',1020.00,290.00,390.00,5.0,200.00,1900.00,'tech','dhl','EU','2026-04','decision_engine'),
('pr-0015','c9e5f412',2340.00,720.00,870.00,13.0,520.00,4450.00,'lifestyle','pfc','EU','2026-04','decision_engine'),
('pr-0016','d2a1c843',3580.00,1040.00,1220.00,20.0,800.00,6640.00,'apparel','fedex','US','2026-04','ai_agent'),
('pr-0017','e8f3b254',860.00,310.00,450.00,6.0,240.00,1860.00,'tech','ups','EU','2026-04','decision_engine'),
('pr-0018','a3f2b891',720.00,230.00,310.00,4.0,160.00,1420.00,'gifts','mid','EU','2026-04','margin_protection'),
('pr-0019','f1a4c365',3120.00,900.00,1140.00,17.0,680.00,5840.00,'apparel','dhl','EU','2026-04','decision_engine'),
('pr-0020','b7c4d321',1680.00,480.00,650.00,10.5,420.00,3230.00,'lifestyle','mid','EU','2026-04','ai_agent'),
('pr-0021','g5b2d476',2110.00,610.00,810.00,12.5,500.00,4030.00,'tech','fedex','US','2026-04','decision_engine'),
('pr-0022','c9e5f412',490.00,160.00,200.00,3.0,120.00,970.00,'lifestyle','dpd','EU','2026-04','decision_engine'),
('pr-0023','h6c3e587',3780.00,1080.00,1380.00,22.0,880.00,7120.00,'apparel','mid','EU','2026-04','ai_agent'),
('pr-0024','a3f2b891',930.00,280.00,370.00,5.5,220.00,1800.00,'gifts','pfc','EU','2026-04','margin_protection'),
-- Period 2026-05 (12 records)
('pr-0025','a3f2b891',1520.00,460.00,640.00,10.0,400.00,3020.00,'apparel','mid','EU','2026-05','decision_engine'),
('pr-0026','b7c4d321',1140.00,330.00,440.00,6.0,240.00,2150.00,'tech','dhl','EU','2026-05','decision_engine'),
('pr-0027','c9e5f412',2580.00,790.00,960.00,14.5,580.00,4910.00,'lifestyle','pfc','EU','2026-05','decision_engine'),
('pr-0028','d2a1c843',3940.00,1140.00,1340.00,22.0,880.00,7300.00,'apparel','fedex','US','2026-05','ai_agent'),
('pr-0029','e8f3b254',940.00,340.00,490.00,6.5,260.00,2030.00,'tech','ups','EU','2026-05','decision_engine'),
('pr-0030','f1a4c365',3440.00,990.00,1260.00,19.0,760.00,6450.00,'apparel','dhl','EU','2026-05','decision_engine'),
('pr-0031','b7c4d321',1850.00,530.00,720.00,11.5,460.00,3560.00,'lifestyle','mid','EU','2026-05','ai_agent'),
('pr-0032','g5b2d476',2320.00,670.00,890.00,13.5,540.00,4420.00,'tech','fedex','US','2026-05','decision_engine'),
('pr-0033','h6c3e587',4160.00,1190.00,1520.00,24.0,960.00,7830.00,'apparel','mid','EU','2026-05','ai_agent'),
('pr-0034','a3f2b891',1040.00,310.00,410.00,6.0,240.00,2000.00,'gifts','pfc','EU','2026-05','margin_protection'),
('pr-0035','c9e5f412',540.00,180.00,220.00,3.5,140.00,1080.00,'lifestyle','dpd','EU','2026-05','decision_engine'),
('pr-0036','a3f2b891',810.00,250.00,330.00,4.5,180.00,1570.00,'gifts','mid','EU','2026-05','margin_protection');

-- Seed: 3 tenant adoption mode records
INSERT INTO "tenant_adoption_modes" ("id","tenantId","mode","shadowSimulationsRun","shadowSavingsIdentifiedEur","modesHistory") VALUES
('tam-001','tenant_demo_1','controlled',47,18420.00,'[{"mode":"shadow","changedAt":"2026-03-01"},{"mode":"assisted","changedAt":"2026-03-15"},{"mode":"controlled","changedAt":"2026-04-01"}]'),
('tam-002','tenant_demo_2','assisted',23,8760.00,'[{"mode":"shadow","changedAt":"2026-04-01"},{"mode":"assisted","changedAt":"2026-04-22"}]'),
('tam-003','tenant_demo_3','shadow',8,2340.00,'[{"mode":"shadow","changedAt":"2026-05-01"}]');
