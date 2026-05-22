-- Accrual accounting entries (deferred revenue + accrued expenses)
CREATE TABLE accrual_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'default',
  reference_type TEXT NOT NULL,   -- 'order' | 'campaign' | 'subscription'
  reference_id TEXT NOT NULL,
  entry_type TEXT NOT NULL,       -- 'deferred_revenue' | 'accrued_expense' | 'recognized_revenue' | 'settled_expense'
  amount NUMERIC(14,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  recognition_date DATE,          -- when revenue should be recognized
  recognized_at TIMESTAMPTZ,      -- when it was actually recognized
  settled_at TIMESTAMPTZ,         -- when expense was settled
  description TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cost allocations (per order/tenant/department)
CREATE TABLE cost_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'default',
  order_id TEXT,
  department TEXT,                -- 'marketing' | 'operations' | 'tech' | 'sales'
  cost_type TEXT NOT NULL,        -- 'platform' | 'fulfillment' | 'supplier' | 'overhead'
  allocated_amount NUMERIC(14,2) NOT NULL,
  base_amount NUMERIC(14,2) NOT NULL,
  allocation_rate NUMERIC(6,4) NOT NULL DEFAULT 1.0,
  currency TEXT NOT NULL DEFAULT 'EUR',
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_accrual_entries_reference ON accrual_entries(reference_type, reference_id);
CREATE INDEX idx_accrual_entries_tenant ON accrual_entries(tenant_id);
CREATE INDEX idx_accrual_entries_type ON accrual_entries(entry_type);
CREATE INDEX idx_cost_allocations_tenant ON cost_allocations(tenant_id);
CREATE INDEX idx_cost_allocations_order ON cost_allocations(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX idx_cost_allocations_period ON cost_allocations(period_start, period_end);
