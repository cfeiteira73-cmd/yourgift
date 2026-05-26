-- BudgetAllocation
CREATE TABLE "budget_allocations" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "department_id" TEXT,
  "period" TEXT NOT NULL,
  "category" TEXT,
  "total_eur" DECIMAL(14,2) NOT NULL,
  "reserved_eur" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "committed_eur" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "spent_eur" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'EUR',
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "budget_allocations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "budget_allocations_org_dept_period_cat_key"
  ON "budget_allocations"("organization_id","period","category")
  WHERE "department_id" IS NULL AND "category" IS NOT NULL;
CREATE INDEX "budget_allocations_org_idx" ON "budget_allocations"("organization_id");

-- BudgetTransaction
CREATE TABLE "budget_transactions" (
  "id" TEXT NOT NULL,
  "budget_allocation_id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "amount_eur" DECIMAL(14,2) NOT NULL,
  "reference_id" TEXT,
  "reference_type" TEXT,
  "note" TEXT,
  "created_by" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "budget_transactions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "budget_transactions_allocation_idx" ON "budget_transactions"("budget_allocation_id");
CREATE INDEX "budget_transactions_ref_idx" ON "budget_transactions"("reference_id");

-- WorkflowProcurementRequest (renamed table to avoid conflict with existing procurement_requests)
CREATE TABLE "workflow_procurement_requests" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL DEFAULT 'default',
  "organization_id" TEXT,
  "requester_id" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "title" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT,
  "supplier_code" TEXT,
  "estimated_cost_eur" DECIMAL(14,2),
  "actual_cost_eur" DECIMAL(14,2),
  "quantity" INTEGER,
  "delivery_days" INTEGER,
  "risk_score" DECIMAL(5,2),
  "approval_chain_id" TEXT,
  "current_step" INTEGER NOT NULL DEFAULT 0,
  "budget_allocation_id" TEXT,
  "policy_decision" TEXT,
  "policy_reason" TEXT,
  "approved_by" TEXT,
  "rejected_by" TEXT,
  "rejection_reason" TEXT,
  "fulfilled_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "workflow_procurement_requests_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "workflow_procurement_requests_tenant_idx" ON "workflow_procurement_requests"("tenant_id");
CREATE INDEX "workflow_procurement_requests_requester_idx" ON "workflow_procurement_requests"("requester_id");
CREATE INDEX "workflow_procurement_requests_status_idx" ON "workflow_procurement_requests"("status");
CREATE INDEX "workflow_procurement_requests_org_idx" ON "workflow_procurement_requests"("organization_id");

-- Demo allocation: org "default", period "2026", €500K
INSERT INTO "budget_allocations" ("id","organization_id","period","total_eur","currency")
VALUES ('demo-budget-2026','default','2026',500000,'EUR');
