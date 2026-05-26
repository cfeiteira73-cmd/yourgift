-- Decision Intelligence Network (Sprint 15)
-- Cross-tenant learning graph: anonymized, aggregated, normalized

CREATE TABLE "network_learning_events" (
  "id" TEXT NOT NULL,
  "tenantHash" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "supplierCode" TEXT,
  "routeKey" TEXT,
  "category" TEXT,
  "outcome" TEXT NOT NULL DEFAULT 'success',
  "marginImpactPct" DECIMAL(8,4),
  "deliveryVarianceDays" INTEGER,
  "costVariancePct" DECIMAL(8,4),
  "region" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "network_learning_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "network_learning_events_supplierCode_idx" ON "network_learning_events"("supplierCode");
CREATE INDEX "network_learning_events_routeKey_idx" ON "network_learning_events"("routeKey");
CREATE INDEX "network_learning_events_category_idx" ON "network_learning_events"("category");
CREATE INDEX "network_learning_events_eventType_idx" ON "network_learning_events"("eventType");

CREATE TABLE "supplier_global_scores" (
  "id" TEXT NOT NULL,
  "supplierCode" TEXT NOT NULL,
  "supplierName" TEXT NOT NULL,
  "globalReliabilityScore" DECIMAL(5,2) NOT NULL DEFAULT 75,
  "failureProbabilityPct" DECIMAL(5,2) NOT NULL DEFAULT 5,
  "avgLeadTimeDays" DECIMAL(5,2) NOT NULL DEFAULT 14,
  "leadTimeVarianceDays" DECIMAL(5,2) NOT NULL DEFAULT 2,
  "avgMarginContributionPct" DECIMAL(8,4) NOT NULL DEFAULT 0,
  "totalEvents" INTEGER NOT NULL DEFAULT 0,
  "activeTenantCount" INTEGER NOT NULL DEFAULT 0,
  "lastUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "supplier_global_scores_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "supplier_global_scores_supplierCode_key" ON "supplier_global_scores"("supplierCode");

CREATE TABLE "route_intelligence" (
  "id" TEXT NOT NULL,
  "originCountry" TEXT NOT NULL,
  "destinationCountry" TEXT NOT NULL,
  "carrierCode" TEXT NOT NULL,
  "avgTransitDays" DECIMAL(5,2) NOT NULL DEFAULT 5,
  "transitVarianceDays" DECIMAL(5,2) NOT NULL DEFAULT 1,
  "customsDelayProbabilityPct" DECIMAL(5,2) NOT NULL DEFAULT 10,
  "costVolatilityPct" DECIMAL(5,2) NOT NULL DEFAULT 5,
  "onTimeDeliveryRatePct" DECIMAL(5,2) NOT NULL DEFAULT 90,
  "totalShipments" INTEGER NOT NULL DEFAULT 0,
  "lastUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "route_intelligence_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "route_intelligence_origin_dest_carrier_key" ON "route_intelligence"("originCountry","destinationCountry","carrierCode");

CREATE TABLE "category_intelligence" (
  "id" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "region" TEXT NOT NULL,
  "avgMarginPct" DECIMAL(8,4) NOT NULL DEFAULT 25,
  "demandTrend" TEXT NOT NULL DEFAULT 'stable',
  "riskScore" DECIMAL(5,2) NOT NULL DEFAULT 30,
  "seasonalPeaks" JSONB NOT NULL DEFAULT '[]',
  "topSupplierCodes" JSONB NOT NULL DEFAULT '[]',
  "totalOrders" INTEGER NOT NULL DEFAULT 0,
  "lastUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "category_intelligence_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "category_intelligence_category_region_key" ON "category_intelligence"("category","region");

CREATE TABLE "network_benchmarks" (
  "id" TEXT NOT NULL,
  "benchmarkType" TEXT NOT NULL,
  "category" TEXT,
  "region" TEXT,
  "carrierCode" TEXT,
  "globalAvgValue" DECIMAL(12,4) NOT NULL,
  "globalP25Value" DECIMAL(12,4) NOT NULL,
  "globalP75Value" DECIMAL(12,4) NOT NULL,
  "sampleCount" INTEGER NOT NULL DEFAULT 0,
  "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "network_benchmarks_pkey" PRIMARY KEY ("id")
);

-- Seed: supplier global scores (6 carriers from Sprint 13)
INSERT INTO "supplier_global_scores" ("id","supplierCode","supplierName","globalReliabilityScore","failureProbabilityPct","avgLeadTimeDays","leadTimeVarianceDays","avgMarginContributionPct","totalEvents","activeTenantCount") VALUES
('sgs-mid','mid','Midocean',88.5,3.2,12.0,1.5,24.8,412,18),
('sgs-pfc','pfc','PF Concept',84.2,4.8,14.5,2.1,22.3,387,16),
('sgs-dhl','dhl','DHL Express',91.3,2.1,4.5,0.8,18.5,834,24),
('sgs-fed','fedex','FedEx',89.7,2.6,5.0,1.0,17.9,621,21),
('sgs-ups','ups','UPS',87.1,3.4,6.0,1.2,16.4,543,19),
('sgs-dpd','dpd','DPD',82.6,5.1,7.5,1.8,15.8,298,14);

-- Seed: route intelligence (10 key routes)
INSERT INTO "route_intelligence" ("id","originCountry","destinationCountry","carrierCode","avgTransitDays","transitVarianceDays","customsDelayProbabilityPct","costVolatilityPct","onTimeDeliveryRatePct","totalShipments") VALUES
('ri-de-fr-dhl','DE','FR','dhl',2.5,0.5,2.0,3.2,96.8,234),
('ri-de-gb-fed','DE','GB','fedex',3.5,1.0,18.5,12.4,88.2,187),
('ri-de-us-fed','DE','US','fedex',5.0,1.2,8.0,15.6,91.4,312),
('ri-de-pt-dhl','DE','PT','dhl',3.0,0.8,3.5,4.1,94.2,143),
('ri-de-es-dpd','DE','ES','dpd',3.5,1.1,4.2,5.8,92.1,98),
('ri-nl-fr-ups','NL','FR','ups',2.0,0.4,2.5,3.0,97.1,176),
('ri-nl-us-fed','NL','US','fedex',5.5,1.3,9.0,14.8,90.3,267),
('ri-fr-gb-dhl','FR','GB','dhl',2.5,0.7,19.2,11.8,87.6,154),
('ri-pt-br-fed','PT','BR','fedex',8.0,2.1,22.4,18.9,79.3,87),
('ri-de-ae-fed','DE','AE','fedex',4.0,1.0,12.6,16.2,85.4,76);

-- Seed: category intelligence (6 categories × 2 regions)
INSERT INTO "category_intelligence" ("id","category","region","avgMarginPct","demandTrend","riskScore","seasonalPeaks","topSupplierCodes","totalOrders") VALUES
('ci-apparel-eu','apparel','EU',28.4,'rising',25.0,'[11,12,1]','["mid","pfc"]',1243),
('ci-tech-eu','tech','EU',22.1,'stable',35.0,'[11,12]','["mid"]',876),
('ci-lifestyle-eu','lifestyle','EU',31.2,'rising',20.0,'[12,2,5]','["pfc","mid"]',987),
('ci-apparel-us','apparel','US',26.8,'stable',28.0,'[11,12,1]','["mid"]',654),
('ci-tech-us','tech','US',20.5,'falling',42.0,'[11]','["mid"]',432),
('ci-gifts-eu','gifts','EU',34.5,'rising',18.0,'[12,2,6]','["pfc","mid"]',1567);

-- Seed: network benchmarks
INSERT INTO "network_benchmarks" ("id","benchmarkType","category","region","carrierCode","globalAvgValue","globalP25Value","globalP75Value","sampleCount") VALUES
('nb-margin-eu','decision_margin',NULL,'EU',NULL,27.50,22.00,34.00,4821),
('nb-delivery-eu','delivery_days',NULL,'EU',NULL,4.20,2.50,6.50,6234),
('nb-cost-unit','cost_per_unit',NULL,NULL,NULL,18.40,12.00,26.00,8912),
('nb-approval','approval_speed',NULL,NULL,NULL,4.30,1.50,8.00,3241),
('nb-margin-us','decision_margin',NULL,'US',NULL,24.80,19.00,31.00,2341);
