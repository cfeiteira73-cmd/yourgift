-- Tenants
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'starter',   -- 'starter' | 'growth' | 'enterprise'
  is_active BOOLEAN NOT NULL DEFAULT true,
  max_users INT NOT NULL DEFAULT 10,
  max_orders_per_month INT NOT NULL DEFAULT 500,
  settings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tenant memberships (user ↔ tenant ↔ role)
CREATE TABLE tenant_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',    -- 'owner' | 'admin' | 'member' | 'viewer'
  is_active BOOLEAN NOT NULL DEFAULT true,
  invited_by TEXT,
  joined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, user_id)
);

-- Add tenant_id to core tables (backward compatible — defaults to 'default')
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';

-- Indexes for tenant-scoped queries
CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenant_memberships_tenant ON tenant_memberships(tenant_id);
CREATE INDEX idx_tenant_memberships_user ON tenant_memberships(user_id);
CREATE INDEX idx_orders_tenant ON orders(tenant_id);
CREATE INDEX idx_clients_tenant ON clients(tenant_id);
CREATE INDEX idx_companies_tenant ON companies(tenant_id);

-- Seed default tenant (maps to existing 'default' records)
INSERT INTO tenants (id, slug, name, plan, max_users, max_orders_per_month)
VALUES ('00000000-0000-0000-0000-000000000001', 'default', 'Default Organization', 'enterprise', 1000, 100000);
