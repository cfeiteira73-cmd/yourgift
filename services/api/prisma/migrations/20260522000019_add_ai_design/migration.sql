-- Brand template registry (per-company brand rules for AI compliance)
CREATE TABLE brand_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  name TEXT NOT NULL,
  primary_color TEXT NOT NULL DEFAULT '#000000',
  secondary_color TEXT NOT NULL DEFAULT '#ffffff',
  accent_color TEXT,
  logo_url TEXT,
  font_family TEXT DEFAULT 'Inter',
  style_keywords TEXT[] NOT NULL DEFAULT '{}',
  forbidden_colors TEXT[] NOT NULL DEFAULT '{}',
  min_logo_clearance INT NOT NULL DEFAULT 10,
  preferred_layouts TEXT[] NOT NULL DEFAULT '{}',
  brand_score_threshold NUMERIC(4,1) NOT NULL DEFAULT 70.0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- AI design generation jobs
CREATE TABLE ai_design_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'default',
  company_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  brand_template_id UUID REFERENCES brand_templates(id),
  prompt_context JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending',
  provider TEXT NOT NULL DEFAULT 'openai',
  model TEXT,
  raw_response JSONB,
  attempts INT NOT NULL DEFAULT 0,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Generated design mockups (output of ai_design_jobs)
CREATE TABLE design_mockups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES ai_design_jobs(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  company_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  image_url TEXT,
  thumbnail_url TEXT,
  brand_score NUMERIC(5,1) NOT NULL DEFAULT 0,
  quality_score NUMERIC(5,1) NOT NULL DEFAULT 0,
  composite_score NUMERIC(5,1) NOT NULL DEFAULT 0,
  scoring_breakdown JSONB NOT NULL DEFAULT '{}',
  is_approved BOOLEAN NOT NULL DEFAULT false,
  is_print_ready BOOLEAN NOT NULL DEFAULT false,
  print_spec JSONB NOT NULL DEFAULT '{}',
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_brand_templates_company ON brand_templates(company_id);
CREATE INDEX idx_ai_design_jobs_tenant ON ai_design_jobs(tenant_id);
CREATE INDEX idx_ai_design_jobs_status ON ai_design_jobs(status);
CREATE INDEX idx_design_mockups_job ON design_mockups(job_id);
CREATE INDEX idx_design_mockups_company ON design_mockups(company_id);
CREATE INDEX idx_design_mockups_score ON design_mockups(composite_score DESC);

-- Seed default brand template
INSERT INTO brand_templates (company_id, name, primary_color, secondary_color, style_keywords, preferred_layouts) VALUES
  ('default', 'Default Corporate', '#1a1a2e', '#4da3ff', ARRAY['professional', 'modern', 'clean'], ARRAY['centered', 'left-aligned']);
