-- Organization
CREATE TABLE "organizations" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "domain" TEXT,
  "plan" TEXT NOT NULL DEFAULT 'free',
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "organizations_domain_key" ON "organizations"("domain") WHERE "domain" IS NOT NULL;

-- UserOrganization
CREATE TABLE "user_organizations" (
  "id" TEXT NOT NULL,
  "client_id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'member',
  "joined_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "user_organizations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "user_organizations_client_org_key" ON "user_organizations"("client_id", "organization_id");
CREATE INDEX "user_organizations_client_id_idx" ON "user_organizations"("client_id");
CREATE INDEX "user_organizations_org_id_idx" ON "user_organizations"("organization_id");

-- AppPermission
CREATE TABLE "app_permissions" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "description" TEXT,
  "resource" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "app_permissions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "app_permissions_code_key" ON "app_permissions"("code");

-- RolePermission
CREATE TABLE "role_permissions" (
  "id" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "permission_id" TEXT NOT NULL,
  CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "role_permissions_role_permission_key" ON "role_permissions"("role", "permission_id");
CREATE INDEX "role_permissions_role_idx" ON "role_permissions"("role");

-- Seed permissions
INSERT INTO "app_permissions" ("id","code","description","resource","action") VALUES
  (gen_random_uuid()::text,'procurement.view','View procurement decisions','procurement','view'),
  (gen_random_uuid()::text,'procurement.create','Create procurement orders','procurement','create'),
  (gen_random_uuid()::text,'procurement.approve','Approve procurement decisions','procurement','approve'),
  (gen_random_uuid()::text,'orders.view','View orders','orders','view'),
  (gen_random_uuid()::text,'orders.create','Create orders','orders','create'),
  (gen_random_uuid()::text,'finance.view','View financial data','finance','view'),
  (gen_random_uuid()::text,'finance.approve','Approve financial transactions','finance','approve'),
  (gen_random_uuid()::text,'users.view','View team members','users','view'),
  (gen_random_uuid()::text,'users.manage','Manage team members','users','manage'),
  (gen_random_uuid()::text,'analytics.view','View analytics','analytics','view'),
  (gen_random_uuid()::text,'settings.manage','Manage organization settings','settings','manage'),
  (gen_random_uuid()::text,'governance.view','View governance policies','governance','view'),
  (gen_random_uuid()::text,'governance.manage','Manage governance policies','governance','manage');
