-- logistics_providers: DHL, UPS, FedEx, DPD, GLS, TNT
CREATE TABLE logistics_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE, -- 'dhl' | 'ups' | 'fedex' | 'dpd' | 'gls' | 'tnt'
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  strengths TEXT[] NOT NULL DEFAULT '{}', -- ['europe','express','heavy']
  api_available BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO logistics_providers (code, name, strengths, api_available) VALUES
  ('dhl', 'DHL Express', ARRAY['international','express','tracking'], true),
  ('ups', 'UPS', ARRAY['usa','heavy','reliable'], true),
  ('fedex', 'FedEx', ARRAY['express','international','premium'], true),
  ('dpd', 'DPD', ARRAY['europe','parcels','cost-effective'], false),
  ('gls', 'GLS', ARRAY['europe','affordable','parcels'], false),
  ('tnt', 'TNT', ARRAY['europe','b2b','pallets'], false);

-- shipping_zones: origin-destination zone mapping (1=cheapest, 5=most expensive)
CREATE TABLE shipping_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_code TEXT NOT NULL,
  origin_country TEXT NOT NULL, -- ISO 3166-1 alpha-2
  destination_country TEXT NOT NULL,
  zone_level INT NOT NULL CHECK (zone_level BETWEEN 1 AND 5),
  transit_days_min INT NOT NULL DEFAULT 1,
  transit_days_max INT NOT NULL DEFAULT 5,
  requires_customs BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(provider_code, origin_country, destination_country)
);

-- Seed key zones (NL and PL as origins since Midocean=NL, PF Concept=PL)
INSERT INTO shipping_zones (provider_code, origin_country, destination_country, zone_level, transit_days_min, transit_days_max, requires_customs) VALUES
-- DHL from NL
('dhl','NL','PT',2,2,4,false),('dhl','NL','ES',2,2,4,false),('dhl','NL','DE',1,1,2,false),
('dhl','NL','FR',2,2,3,false),('dhl','NL','IT',2,2,4,false),('dhl','NL','GB',3,2,4,true),
('dhl','NL','US',4,3,6,true),('dhl','NL','AE',4,3,5,true),('dhl','NL','CH',3,2,3,true),
('dhl','NL','PL',1,1,3,false),('dhl','NL','BE',1,1,2,false),('dhl','NL','NL',1,1,1,false),
-- DPD from NL
('dpd','NL','PT',2,3,5,false),('dpd','NL','ES',2,3,5,false),('dpd','NL','DE',1,1,3,false),
('dpd','NL','FR',2,2,4,false),('dpd','NL','IT',2,3,5,false),('dpd','NL','PL',1,2,3,false),
-- DHL from PL
('dhl','PL','PT',3,3,5,false),('dhl','PL','ES',3,3,5,false),('dhl','PL','DE',1,1,2,false),
('dhl','PL','FR',2,2,4,false),('dhl','PL','GB',3,2,4,true),('dhl','PL','NL',1,1,2,false),
-- GLS from NL
('gls','NL','PT',2,3,6,false),('gls','NL','ES',2,3,6,false),('gls','NL','DE',1,1,2,false),
('gls','NL','FR',2,2,4,false),('gls','NL','NL',1,1,1,false);

-- shipping_rate_cards: price per weight band per zone level
CREATE TABLE shipping_rate_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_code TEXT NOT NULL,
  zone_level INT NOT NULL CHECK (zone_level BETWEEN 1 AND 5),
  weight_from_kg DECIMAL(6,2) NOT NULL, -- inclusive lower bound
  weight_to_kg DECIMAL(6,2) NOT NULL,   -- exclusive upper bound
  base_price DECIMAL(10,2) NOT NULL,    -- EUR
  price_per_kg DECIMAL(8,4) NOT NULL,   -- EUR per kg over weight_from
  fuel_surcharge_pct DECIMAL(5,2) NOT NULL DEFAULT 15.0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(provider_code, zone_level, weight_from_kg)
);

-- Seed rate cards (simplified but realistic EUR rates)
INSERT INTO shipping_rate_cards (provider_code, zone_level, weight_from_kg, weight_to_kg, base_price, price_per_kg, fuel_surcharge_pct) VALUES
-- DHL rates
('dhl',1,0,1,6.90,0.00,15),('dhl',1,1,5,8.50,1.20,15),('dhl',1,5,10,13.00,1.80,15),('dhl',1,10,30,20.00,1.50,15),('dhl',1,30,999,45.00,1.20,15),
('dhl',2,0,1,9.50,0.00,15),('dhl',2,1,5,12.00,1.80,15),('dhl',2,5,10,18.00,2.20,15),('dhl',2,10,30,28.00,1.90,15),('dhl',2,30,999,65.00,1.60,15),
('dhl',3,0,1,14.00,0.00,15),('dhl',3,1,5,18.00,2.50,15),('dhl',3,5,10,26.00,3.00,15),('dhl',3,10,30,40.00,2.50,15),('dhl',3,30,999,95.00,2.00,15),
('dhl',4,0,1,22.00,0.00,15),('dhl',4,1,5,28.00,3.50,15),('dhl',4,5,10,40.00,4.00,15),('dhl',4,10,30,65.00,3.50,15),('dhl',4,30,999,150.00,3.00,15),
('dhl',5,0,1,35.00,0.00,15),('dhl',5,1,5,45.00,5.00,15),('dhl',5,5,10,65.00,5.50,15),('dhl',5,10,30,100.00,4.50,15),('dhl',5,30,999,220.00,4.00,15),
-- DPD rates (cheaper than DHL, EU only)
('dpd',1,0,1,4.50,0.00,12),('dpd',1,1,5,5.50,0.90,12),('dpd',1,5,10,8.00,1.20,12),('dpd',1,10,30,13.00,1.10,12),('dpd',1,30,999,30.00,0.90,12),
('dpd',2,0,1,6.50,0.00,12),('dpd',2,1,5,8.00,1.20,12),('dpd',2,5,10,12.00,1.60,12),('dpd',2,10,30,19.00,1.40,12),('dpd',2,30,999,45.00,1.20,12),
-- GLS rates (cheapest EU option)
('gls',1,0,1,3.80,0.00,10),('gls',1,1,5,4.80,0.80,10),('gls',1,5,10,7.00,1.00,10),('gls',1,10,30,11.00,0.95,10),('gls',1,30,999,26.00,0.80,10),
('gls',2,0,1,5.80,0.00,10),('gls',2,1,5,7.20,1.00,10),('gls',2,5,10,11.00,1.40,10),('gls',2,10,30,17.00,1.25,10),('gls',2,30,999,40.00,1.10,10);

-- shipping_quotes: computed shipping quotes (stored for audit and ML)
CREATE TABLE shipping_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_id TEXT, -- order/quote/request id
  reference_type TEXT, -- 'order' | 'procurement_brief' | 'estimate'
  origin_country TEXT NOT NULL,
  destination_country TEXT NOT NULL,
  weight_kg DECIMAL(8,3) NOT NULL,
  length_cm DECIMAL(6,1),
  width_cm DECIMAL(6,1),
  height_cm DECIMAL(6,1),
  volumetric_weight_kg DECIMAL(8,3),
  effective_weight_kg DECIMAL(8,3) NOT NULL,
  options JSONB NOT NULL DEFAULT '[]', -- [{provider, zone, baseCost, fuelSurcharge, total, transitDays}]
  selected_provider TEXT,
  selected_cost DECIMAL(10,2),
  selection_reason TEXT, -- 'cheapest' | 'fastest' | 'best_margin'
  currency TEXT NOT NULL DEFAULT 'EUR',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_shipping_quotes_reference ON shipping_quotes(reference_id, reference_type);
CREATE INDEX idx_shipping_quotes_created ON shipping_quotes(created_at DESC);
