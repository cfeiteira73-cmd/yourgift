CREATE TABLE "pricing_rules" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "rule_type" TEXT NOT NULL,
  "target_id" TEXT,
  "min_quantity" INTEGER NOT NULL DEFAULT 1,
  "max_quantity" INTEGER,
  "discount_type" TEXT NOT NULL,
  "discount_value" DOUBLE PRECISION NOT NULL,
  "margin_min" DOUBLE PRECISION,
  "client_tier" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "pricing_rules_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "pricing_rules_rule_type_is_active_idx" ON "pricing_rules"("rule_type", "is_active");
CREATE INDEX "pricing_rules_client_tier_idx" ON "pricing_rules"("client_tier");
