-- procurement_briefs: natural language procurement requests
CREATE TABLE procurement_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'default',
  description TEXT NOT NULL,           -- raw user input
  parsed_quantity INT,                 -- extracted quantity
  parsed_budget_eur DECIMAL(14,2),     -- extracted budget in EUR
  parsed_destination TEXT,             -- extracted destination country/city
  parsed_timeline_days INT,            -- extracted delivery timeline
  parsed_urgency TEXT DEFAULT 'normal',-- 'low' | 'normal' | 'high' | 'critical'
  parsed_category TEXT,                -- detected product category
  parsed_keywords TEXT[] DEFAULT '{}', -- luxury, branded, eco-friendly, etc.
  status TEXT NOT NULL DEFAULT 'processing', -- 'processing' | 'planned' | 'approved' | 'executing' | 'failed'
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_procurement_briefs_status ON procurement_briefs(status);
CREATE INDEX idx_procurement_briefs_created ON procurement_briefs(created_at DESC);

-- procurement_plans: AI-generated procurement plans
CREATE TABLE procurement_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id UUID NOT NULL REFERENCES procurement_briefs(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL DEFAULT 'default',

  -- Recommended supplier
  recommended_supplier TEXT NOT NULL,
  fallback_supplier TEXT,
  routing_confidence DECIMAL(5,2) NOT NULL DEFAULT 75.00, -- 0-100
  routing_reason TEXT NOT NULL,

  -- Product recommendations
  suggested_products JSONB NOT NULL DEFAULT '[]', -- [{name, category, unitPrice, qty, supplierId}]

  -- Financial plan
  unit_cost DECIMAL(12,4),
  quantity INT,
  total_product_cost DECIMAL(14,2),
  estimated_shipping DECIMAL(12,2),
  print_cost DECIMAL(12,2) DEFAULT 0,
  platform_fee DECIMAL(12,2),
  total_cost DECIMAL(14,2),
  sale_price_recommended DECIMAL(14,2),
  expected_margin_pct DECIMAL(5,2),

  -- Timeline
  production_days INT,
  shipping_days INT,
  total_days INT,
  delivery_date_estimate DATE,
  meets_deadline BOOLEAN DEFAULT true,

  -- Risk assessment
  risk_level TEXT DEFAULT 'low', -- 'low' | 'medium' | 'high'
  risk_factors JSONB DEFAULT '[]', -- [{factor, impact, mitigation}]
  confidence_score DECIMAL(5,2) DEFAULT 75.00, -- 0-100

  -- AI notes
  ai_reasoning TEXT,
  ai_recommendations TEXT[] DEFAULT '{}',
  ai_warnings TEXT[] DEFAULT '{}',

  -- Status
  is_approved BOOLEAN DEFAULT false,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  workflow_instance_id TEXT, -- if execution was started

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(brief_id) -- one plan per brief
);
CREATE INDEX idx_procurement_plans_brief_id ON procurement_plans(brief_id);
