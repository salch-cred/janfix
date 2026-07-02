-- Jurisdiction rule engine scaffolding (see the "Mangaluru / Dakshina Kannada
-- Civic Jurisdiction" governance knowledge base for the research this is
-- based on). This EXTENDS the existing assignment_rules/area_mappings
-- tables; it does not replace them. It adds:
--   1. Reference tables for DK's administrative hierarchy (taluks, gram
--      panchayats) so future rules/road ownership can be taluk-aware.
--   2. A road_segments scaffold table (no geometry yet -- populate once real
--      GIS/road-ownership data is sourced).
--   3. jurisdiction_rules: a scope-aware (mcc / rural / state_highway /
--      national_highway / any) category -> authority overlay, editable from
--      the admin panel, used as a fallback layer by the resolver when no
--      ward-specific assignment_rules row exists. Rows with confidence='low'
--      mark genuinely ambiguous jurisdictions and flag matching issues with
--      needs_review = true instead of silently guessing.

CREATE TABLE IF NOT EXISTS public.taluks (
  id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  sub_division TEXT
);
INSERT INTO public.taluks (name, sub_division) VALUES
  ('Mangaluru', 'Mangaluru'),
  ('Bantwal', 'Mangaluru'),
  ('Moodabidri', 'Mangaluru'),
  ('Ullala', 'Mangaluru'),
  ('Mulki', 'Mangaluru'),
  ('Puttur', 'Puttur'),
  ('Sullia', 'Puttur'),
  ('Belthangady', 'Puttur'),
  ('Kadaba', 'Puttur')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.gram_panchayats (
  id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  taluk_id INT REFERENCES public.taluks(id) ON DELETE SET NULL,
  UNIQUE (name, taluk_id)
);
-- Seed a known reference point (Farangipet GP, Bantwal taluk -- the area
-- that covers Valachil/Bangalagudde). Extend via the admin panel as more GP
-- data is sourced; this is intentionally not an exhaustive list of DK's 223
-- gram panchayats.
INSERT INTO public.gram_panchayats (name, taluk_id)
SELECT 'Farangipet', t.id FROM public.taluks t WHERE t.name = 'Bantwal'
ON CONFLICT (name, taluk_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.road_segments (
  id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  owner_type TEXT NOT NULL CHECK (owner_type IN ('MCC','PWD','NHAI','GramPanchayat','Private','Unknown')),
  owner_authority_id INT REFERENCES public.authorities(id) ON DELETE SET NULL,
  taluk_id INT REFERENCES public.taluks(id) ON DELETE SET NULL,
  notes TEXT
);
-- No geometry column yet -- add PostGIS geometry once real road-ownership
-- GIS data (MCC/PWD/NHAI/OSM) is sourced. Scaffolded now so the schema
-- doesn't need another breaking migration later.

CREATE TABLE IF NOT EXISTS public.jurisdiction_rules (
  id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  category_id INT NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('mcc','rural','state_highway','national_highway','any')),
  taluk_id INT REFERENCES public.taluks(id) ON DELETE SET NULL,
  authority_id INT REFERENCES public.authorities(id) ON DELETE SET NULL,
  confidence TEXT NOT NULL DEFAULT 'medium' CHECK (confidence IN ('high','medium','low')),
  notes TEXT,
  priority INT NOT NULL DEFAULT 10,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS jurisdiction_rules_category_scope_idx ON public.jurisdiction_rules (category_id, scope_type);
-- Idempotency for the taluk-agnostic seed rows below (taluk_id IS NULL).
CREATE UNIQUE INDEX IF NOT EXISTS jurisdiction_rules_cat_scope_global_uniq
  ON public.jurisdiction_rules (category_id, scope_type) WHERE taluk_id IS NULL;

GRANT SELECT ON public.taluks TO anon, authenticated;
GRANT SELECT ON public.gram_panchayats TO anon, authenticated;
GRANT SELECT ON public.road_segments TO anon, authenticated;
GRANT SELECT ON public.jurisdiction_rules TO anon, authenticated;
GRANT ALL ON public.taluks TO service_role;
GRANT ALL ON public.gram_panchayats TO service_role;
GRANT ALL ON public.road_segments TO service_role;
GRANT ALL ON public.jurisdiction_rules TO service_role;
ALTER TABLE public.taluks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gram_panchayats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.road_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jurisdiction_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "taluks public read" ON public.taluks FOR SELECT USING (true);
CREATE POLICY "gram_panchayats public read" ON public.gram_panchayats FOR SELECT USING (true);
CREATE POLICY "road_segments public read" ON public.road_segments FOR SELECT USING (true);
CREATE POLICY "jurisdiction_rules public read" ON public.jurisdiction_rules FOR SELECT USING (true);

ALTER TABLE public.issues
  ADD COLUMN IF NOT EXISTS needs_review BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS jurisdiction_confidence TEXT;

-- Seed jurisdiction_rules from the researched Category -> Authority mapping
-- (see the governance knowledge base doc, section 6). confidence='low' rows
-- are explicitly-flagged ambiguities and will set needs_review=true on
-- matching issues instead of silently guessing.
DO $$
DECLARE
  _cat_pothole INT; _cat_road INT; _cat_garbage INT; _cat_sewage INT; _cat_water INT;
  _cat_street INT; _cat_footpath INT; _cat_drain INT; _cat_tree INT; _cat_toilet INT;
  _cat_dumping INT; _cat_traffic INT; _cat_others INT;
  _mcc_roads INT; _mcc_health INT; _kuwsdb INT; _mescom INT; _traffic_police INT;
  _pwd INT; _nhai INT; _mcc_hort INT; _mcc_gen INT; _mcc_engg INT; _zp_dk INT; _dk_admin INT;
BEGIN
  SELECT id INTO _cat_pothole FROM public.categories WHERE slug = 'pothole';
  SELECT id INTO _cat_road FROM public.categories WHERE slug = 'road-damage';
  SELECT id INTO _cat_garbage FROM public.categories WHERE slug = 'garbage';
  SELECT id INTO _cat_sewage FROM public.categories WHERE slug = 'sewage';
  SELECT id INTO _cat_water FROM public.categories WHERE slug = 'water-leakage';
  SELECT id INTO _cat_street FROM public.categories WHERE slug = 'streetlight';
  SELECT id INTO _cat_footpath FROM public.categories WHERE slug = 'footpath';
  SELECT id INTO _cat_drain FROM public.categories WHERE slug = 'drain';
  SELECT id INTO _cat_tree FROM public.categories WHERE slug = 'tree-hazard';
  SELECT id INTO _cat_toilet FROM public.categories WHERE slug = 'public-toilet';
  SELECT id INTO _cat_dumping FROM public.categories WHERE slug = 'illegal-dumping';
  SELECT id INTO _cat_traffic FROM public.categories WHERE slug = 'traffic-signal';
  SELECT id INTO _cat_others FROM public.categories WHERE slug = 'others';

  SELECT id INTO _mcc_roads FROM public.authorities WHERE name = 'MCC Roads Department';
  SELECT id INTO _mcc_health FROM public.authorities WHERE name = 'MCC Health Department';
  SELECT id INTO _kuwsdb FROM public.authorities WHERE name = 'KUWS&DB';
  SELECT id INTO _mescom FROM public.authorities WHERE name = 'MESCOM';
  SELECT id INTO _traffic_police FROM public.authorities WHERE name = 'Mangaluru Traffic Police';
  SELECT id INTO _pwd FROM public.authorities WHERE name = 'PWD Karnataka';
  SELECT id INTO _nhai FROM public.authorities WHERE name = 'NHAI';
  SELECT id INTO _mcc_hort FROM public.authorities WHERE name = 'MCC Horticulture';
  SELECT id INTO _mcc_gen FROM public.authorities WHERE name = 'MCC General Administration';
  SELECT id INTO _mcc_engg FROM public.authorities WHERE name = 'MCC Engineering';
  SELECT id INTO _zp_dk FROM public.authorities WHERE name = 'Zilla Panchayat Dakshina Kannada';
  SELECT id INTO _dk_admin FROM public.authorities WHERE name = 'DK District Administration';

  INSERT INTO public.jurisdiction_rules (category_id, scope_type, authority_id, confidence, notes, priority) VALUES
    (_cat_pothole, 'mcc', _mcc_roads, 'high', 'MCC Roads Dept owns corporation roads', 20),
    (_cat_pothole, 'rural', _zp_dk, 'medium', 'Proxy for Gram Panchayat until GP-specific authorities are added', 20),
    (_cat_pothole, 'state_highway', _pwd, 'high', 'PWD owns state highways/major district roads', 20),
    (_cat_pothole, 'national_highway', _nhai, 'high', 'NHAI owns national highways', 20),
    (_cat_road, 'mcc', _mcc_roads, 'high', 'MCC Roads Dept owns corporation roads', 20),
    (_cat_road, 'rural', _zp_dk, 'medium', 'Proxy for Gram Panchayat until GP-specific authorities are added', 20),
    (_cat_road, 'state_highway', _pwd, 'high', 'PWD owns state highways/major district roads', 20),
    (_cat_road, 'national_highway', _nhai, 'high', 'NHAI owns national highways', 20),
    (_cat_footpath, 'mcc', _mcc_engg, 'high', NULL, 15),
    (_cat_footpath, 'rural', _zp_dk, 'medium', 'Proxy for Gram Panchayat', 15),
    (_cat_drain, 'mcc', _mcc_engg, 'high', NULL, 15),
    (_cat_drain, 'rural', _zp_dk, 'medium', 'Proxy for Gram Panchayat', 15),
    (_cat_garbage, 'mcc', _mcc_health, 'high', NULL, 15),
    (_cat_garbage, 'rural', _zp_dk, 'medium', 'Proxy for Gram Panchayat', 15),
    (_cat_dumping, 'mcc', _mcc_health, 'high', NULL, 15),
    (_cat_dumping, 'rural', _zp_dk, 'medium', 'Proxy for Gram Panchayat', 15),
    (_cat_tree, 'mcc', _mcc_hort, 'high', NULL, 15),
    (_cat_tree, 'rural', _zp_dk, 'medium', 'Proxy for Gram Panchayat / Forest Dept if reserve forest', 15),
    (_cat_toilet, 'mcc', _mcc_gen, 'high', NULL, 15),
    (_cat_toilet, 'rural', _zp_dk, 'medium', 'Proxy for Gram Panchayat', 15),
    (_cat_traffic, 'mcc', _traffic_police, 'high', NULL, 15),
    (_cat_traffic, 'rural', _traffic_police, 'medium', NULL, 15),
    (_cat_others, 'any', _dk_admin, 'medium', 'Generic fallback', 5),
    (_cat_sewage, 'mcc', _kuwsdb, 'low', 'MCC vs KUWS&DB operational split for Mangaluru not directly confirmed -- see governance knowledge base', 15),
    (_cat_sewage, 'rural', _zp_dk, 'medium', 'Proxy for Gram Panchayat', 15),
    (_cat_water, 'mcc', _kuwsdb, 'low', 'MCC vs KUWS&DB operational split for Mangaluru not directly confirmed -- see governance knowledge base', 15),
    (_cat_water, 'rural', _zp_dk, 'medium', 'Proxy for Gram Panchayat / rural water supply scheme', 15),
    (_cat_street, 'mcc', _mescom, 'low', 'Fixture (MCC Engineering) vs electricity-infra (MESCOM) fault not distinguished yet -- see governance knowledge base', 15),
    (_cat_street, 'rural', _mescom, 'medium', NULL, 15)
  ON CONFLICT (category_id, scope_type) WHERE taluk_id IS NULL DO NOTHING;
END $$;
