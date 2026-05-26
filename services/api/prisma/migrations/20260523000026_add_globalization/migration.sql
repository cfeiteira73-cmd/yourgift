-- currencies: supported currencies with formatting rules
CREATE TABLE currencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE, -- ISO 4217: EUR, USD, GBP, etc.
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  decimal_places INT NOT NULL DEFAULT 2,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed with 10 major currencies
INSERT INTO currencies (code, name, symbol, decimal_places) VALUES
  ('EUR', 'Euro', '€', 2),
  ('USD', 'US Dollar', '$', 2),
  ('GBP', 'British Pound', '£', 2),
  ('CHF', 'Swiss Franc', 'CHF', 2),
  ('PLN', 'Polish Zloty', 'zł', 2),
  ('CZK', 'Czech Koruna', 'Kč', 2),
  ('SEK', 'Swedish Krona', 'kr', 2),
  ('DKK', 'Danish Krone', 'kr', 2),
  ('NOK', 'Norwegian Krone', 'kr', 2),
  ('HUF', 'Hungarian Forint', 'Ft', 0);

-- exchange_rates: daily rates relative to EUR base
-- Note: drops existing simple exchange_rates table if present and replaces with richer version
DROP TABLE IF EXISTS exchange_rates CASCADE;

CREATE TABLE exchange_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_currency TEXT NOT NULL,
  to_currency TEXT NOT NULL,
  rate DECIMAL(14,6) NOT NULL,
  rate_date DATE NOT NULL DEFAULT CURRENT_DATE,
  source TEXT NOT NULL DEFAULT 'manual', -- 'manual' | 'ecb' | 'openexchangerates'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(from_currency, to_currency, rate_date)
);
CREATE INDEX idx_exchange_rates_currencies ON exchange_rates(from_currency, to_currency);
CREATE INDEX idx_exchange_rates_date ON exchange_rates(rate_date DESC);

-- Seed with approximate rates (EUR base, today's approximate values)
INSERT INTO exchange_rates (from_currency, to_currency, rate, source) VALUES
  ('EUR', 'USD', 1.085000, 'seed'),
  ('EUR', 'GBP', 0.857000, 'seed'),
  ('EUR', 'CHF', 0.963000, 'seed'),
  ('EUR', 'PLN', 4.258000, 'seed'),
  ('EUR', 'CZK', 25.120000, 'seed'),
  ('EUR', 'SEK', 11.620000, 'seed'),
  ('EUR', 'DKK', 7.461000, 'seed'),
  ('EUR', 'NOK', 11.850000, 'seed'),
  ('EUR', 'HUF', 395.000000, 'seed'),
  ('USD', 'EUR', 0.922000, 'seed'),
  ('GBP', 'EUR', 1.167000, 'seed');

-- vat_rules: VAT rates by country code and product category
CREATE TABLE vat_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL, -- ISO 3166-1 alpha-2
  country_name TEXT NOT NULL,
  standard_rate DECIMAL(5,2) NOT NULL, -- e.g. 23.00 for 23%
  reduced_rate DECIMAL(5,2), -- e.g. 13.00
  category_overrides JSONB NOT NULL DEFAULT '{}', -- {promotional_items: 13, food: 6}
  is_eu_member BOOLEAN NOT NULL DEFAULT false,
  vat_number_prefix TEXT, -- e.g. 'PT', 'DE', 'FR'
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(country_code)
);

-- Seed EU + major trading partners
INSERT INTO vat_rules (country_code, country_name, standard_rate, reduced_rate, is_eu_member, vat_number_prefix) VALUES
  ('PT', 'Portugal', 23.00, 13.00, true, 'PT'),
  ('ES', 'Spain', 21.00, 10.00, true, 'ES'),
  ('DE', 'Germany', 19.00, 7.00, true, 'DE'),
  ('FR', 'France', 20.00, 5.50, true, 'FR'),
  ('IT', 'Italy', 22.00, 10.00, true, 'IT'),
  ('NL', 'Netherlands', 21.00, 9.00, true, 'NL'),
  ('BE', 'Belgium', 21.00, 6.00, true, 'BE'),
  ('PL', 'Poland', 23.00, 8.00, true, 'PL'),
  ('CZ', 'Czech Republic', 21.00, 12.00, true, 'CZ'),
  ('SE', 'Sweden', 25.00, 12.00, true, 'SE'),
  ('DK', 'Denmark', 25.00, null, true, 'DK'),
  ('AT', 'Austria', 20.00, 10.00, true, 'AT'),
  ('GB', 'United Kingdom', 20.00, 5.00, false, 'GB'),
  ('CH', 'Switzerland', 8.10, 2.60, false, 'CHE'),
  ('US', 'United States', 0.00, null, false, null),
  ('AE', 'United Arab Emirates', 5.00, null, false, null),
  ('SA', 'Saudi Arabia', 15.00, null, false, null);

-- regional_routing_rules: which suppliers to prefer per region
CREATE TABLE regional_routing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region TEXT NOT NULL, -- 'EU', 'UK', 'MENA', 'NA', 'APAC'
  country_codes TEXT[] NOT NULL DEFAULT '{}', -- countries in this region
  preferred_suppliers TEXT[] NOT NULL DEFAULT '{}', -- supplier names in priority order
  excluded_suppliers TEXT[] NOT NULL DEFAULT '{}',
  max_lead_time_days INT NOT NULL DEFAULT 30,
  currency TEXT NOT NULL DEFAULT 'EUR',
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(region)
);

INSERT INTO regional_routing_rules (region, country_codes, preferred_suppliers, max_lead_time_days, currency) VALUES
  ('EU', ARRAY['PT','ES','DE','FR','IT','NL','BE','PL','CZ','SE','DK','AT'], ARRAY['midocean','pf_concept'], 14, 'EUR'),
  ('UK', ARRAY['GB'], ARRAY['pf_concept','midocean'], 10, 'GBP'),
  ('CH', ARRAY['CH'], ARRAY['midocean'], 12, 'CHF'),
  ('MENA', ARRAY['AE','SA','QA','KW'], ARRAY['midocean'], 21, 'USD'),
  ('NA', ARRAY['US','CA'], ARRAY['midocean'], 21, 'USD');
