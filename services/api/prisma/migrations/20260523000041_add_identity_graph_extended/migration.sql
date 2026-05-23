-- OrgDepartment
CREATE TABLE "org_departments" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT,
  "parent_id" TEXT,
  "budget_limit_eur" DECIMAL(14,2),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "org_departments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "org_departments_org_code_key" ON "org_departments"("organization_id", "code") WHERE "code" IS NOT NULL;
CREATE INDEX "org_departments_org_id_idx" ON "org_departments"("organization_id");

-- UserDepartment
CREATE TABLE "user_departments" (
  "id" TEXT NOT NULL,
  "client_id" TEXT NOT NULL,
  "department_id" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'member',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "user_departments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "user_departments_client_dept_key" ON "user_departments"("client_id", "department_id");
CREATE INDEX "user_departments_dept_id_idx" ON "user_departments"("department_id");

-- IdentityDelegation
CREATE TABLE "identity_delegations" (
  "id" TEXT NOT NULL,
  "delegator_id" TEXT NOT NULL,
  "delegatee_id" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "organization_id" TEXT,
  "budget_limit_eur" DECIMAL(14,2),
  "expires_at" TIMESTAMPTZ,
  "revoked_at" TIMESTAMPTZ,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "identity_delegations_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "identity_delegations_delegator_idx" ON "identity_delegations"("delegator_id");
CREATE INDEX "identity_delegations_delegatee_idx" ON "identity_delegations"("delegatee_id");
CREATE INDEX "identity_delegations_active_idx" ON "identity_delegations"("is_active");

-- ApprovalChain
CREATE TABLE "approval_chains" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "trigger_type" TEXT NOT NULL,
  "threshold_eur" DECIMAL(14,2),
  "category" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "approval_chains_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "approval_chains_org_id_idx" ON "approval_chains"("organization_id");
CREATE INDEX "approval_chains_trigger_idx" ON "approval_chains"("trigger_type");

-- ApprovalChainStep
CREATE TABLE "approval_chain_steps" (
  "id" TEXT NOT NULL,
  "approval_chain_id" TEXT NOT NULL,
  "step_order" INTEGER NOT NULL,
  "approver_id" TEXT,
  "approver_role" TEXT,
  "timeout_hours" INTEGER NOT NULL DEFAULT 24,
  "escalate_to" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "approval_chain_steps_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "approval_chain_steps_chain_id_idx" ON "approval_chain_steps"("approval_chain_id");
