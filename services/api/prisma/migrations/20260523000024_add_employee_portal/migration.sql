-- employee_wallets: one per company/tenant
CREATE TABLE employee_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  employee_email TEXT NOT NULL,
  employee_name TEXT NOT NULL,
  department TEXT,
  balance DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_granted DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_spent DECIMAL(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'EUR',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, employee_email)
);

-- wallet_transactions: immutable credit/debit log
CREATE TABLE wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES employee_wallets(id),
  type TEXT NOT NULL, -- 'credit' | 'debit' | 'refund' | 'adjustment'
  amount DECIMAL(12,2) NOT NULL,
  balance_after DECIMAL(12,2) NOT NULL,
  description TEXT NOT NULL,
  reference_id TEXT, -- procurement_request_id or kit_deployment_id
  reference_type TEXT, -- 'procurement_request' | 'kit_deployment' | 'allowance_grant'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_wallet_transactions_wallet_id ON wallet_transactions(wallet_id);

-- onboarding_kits: predefined product bundles
CREATE TABLE onboarding_kits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'default',
  name TEXT NOT NULL,
  description TEXT,
  department TEXT, -- null = all departments
  total_value DECIMAL(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'EUR',
  is_active BOOLEAN NOT NULL DEFAULT true,
  items JSONB NOT NULL DEFAULT '[]', -- [{productId, variantId, quantity, name, price}]
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- kit_deployments: when a kit is sent to a new employee
CREATE TABLE kit_deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_id UUID NOT NULL REFERENCES onboarding_kits(id),
  wallet_id UUID NOT NULL REFERENCES employee_wallets(id),
  tenant_id TEXT NOT NULL DEFAULT 'default',
  status TEXT NOT NULL DEFAULT 'pending', -- pending | processing | shipped | delivered | cancelled
  employee_email TEXT NOT NULL,
  employee_name TEXT NOT NULL,
  shipping_address JSONB NOT NULL DEFAULT '{}',
  total_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  deployed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_kit_deployments_kit_id ON kit_deployments(kit_id);
CREATE INDEX idx_kit_deployments_wallet_id ON kit_deployments(wallet_id);
CREATE INDEX idx_kit_deployments_status ON kit_deployments(status);

-- procurement_requests: employee requests a product
CREATE TABLE procurement_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES employee_wallets(id),
  tenant_id TEXT NOT NULL DEFAULT 'default',
  company_id TEXT NOT NULL,
  employee_email TEXT NOT NULL,
  department TEXT,
  product_name TEXT NOT NULL,
  product_id TEXT,
  variant_id TEXT,
  quantity INT NOT NULL DEFAULT 1,
  unit_price DECIMAL(12,2),
  total_amount DECIMAL(12,2),
  currency TEXT NOT NULL DEFAULT 'EUR',
  status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected | ordered | delivered
  urgency TEXT NOT NULL DEFAULT 'normal', -- low | normal | high | critical
  justification TEXT,
  rejection_reason TEXT,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  order_id TEXT, -- linked order once approved
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_procurement_requests_wallet_id ON procurement_requests(wallet_id);
CREATE INDEX idx_procurement_requests_status ON procurement_requests(status);
CREATE INDEX idx_procurement_requests_tenant_id ON procurement_requests(tenant_id);

-- department_budgets: budget allocation per department
CREATE TABLE department_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'default',
  company_id TEXT NOT NULL,
  department TEXT NOT NULL,
  fiscal_year INT NOT NULL,
  fiscal_quarter INT, -- null = full year
  total_budget DECIMAL(12,2) NOT NULL,
  allocated DECIMAL(12,2) NOT NULL DEFAULT 0,
  spent DECIMAL(12,2) NOT NULL DEFAULT 0,
  committed DECIMAL(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'EUR',
  alert_threshold DECIMAL(5,2) NOT NULL DEFAULT 80.00, -- % that triggers alert
  is_locked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, company_id, department, fiscal_year, fiscal_quarter)
);
CREATE INDEX idx_department_budgets_tenant_id ON department_budgets(tenant_id);
