
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE public.app_role AS ENUM ('admin', 'moderator');
CREATE TYPE public.issue_severity AS ENUM ('low','medium','high','dangerous');
CREATE TYPE public.issue_status AS ENUM (
  'reported','community_verified','assigned','work_started',
  'resolved','community_confirmed','closed'
);
CREATE TYPE public.issue_visibility AS ENUM ('visible','hidden','duplicate','spam');
CREATE TYPE public.vote_kind AS ENUM ('exists','fixed');
CREATE TYPE public.photo_kind AS ENUM ('report','repair','citizen_after');
CREATE TYPE public.quick_reply AS ENUM ('also_saw','still_exists','already_fixed','other');

CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TABLE public.categories (
  id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name_en TEXT NOT NULL,
  name_kn TEXT,
  icon TEXT,
  color TEXT,
  sort_order INT DEFAULT 0
);
GRANT SELECT ON public.categories TO anon, authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories public read" ON public.categories FOR SELECT USING (true);

CREATE TABLE public.wards (
  id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  number INT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  area TEXT
);
GRANT SELECT ON public.wards TO anon, authenticated;
GRANT ALL ON public.wards TO service_role;
ALTER TABLE public.wards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wards public read" ON public.wards FOR SELECT USING (true);

CREATE TABLE public.authorities (
  id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT,
  logo_url TEXT,
  photo_url TEXT,
  department TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  website TEXT,
  jurisdiction TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.authorities TO anon, authenticated;
GRANT ALL ON public.authorities TO service_role;
ALTER TABLE public.authorities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authorities public read" ON public.authorities FOR SELECT USING (true);

CREATE TABLE public.representatives (
  id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  constituency TEXT,
  photo_url TEXT,
  phone TEXT,
  email TEXT,
  authority_id INT REFERENCES public.authorities(id) ON DELETE SET NULL,
  ward_id INT REFERENCES public.wards(id) ON DELETE SET NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.representatives TO anon, authenticated;
GRANT ALL ON public.representatives TO service_role;
ALTER TABLE public.representatives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "representatives public read" ON public.representatives FOR SELECT USING (true);

CREATE TABLE public.assignment_rules (
  id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  version INT NOT NULL DEFAULT 1,
  category_id INT NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  ward_id INT REFERENCES public.wards(id) ON DELETE CASCADE,
  authority_id INT NOT NULL REFERENCES public.authorities(id),
  representative_id INT REFERENCES public.representatives(id),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.assignment_rules TO anon, authenticated;
GRANT ALL ON public.assignment_rules TO service_role;
ALTER TABLE public.assignment_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rules public read" ON public.assignment_rules FOR SELECT USING (true);

CREATE TABLE public.devices (
  device_id TEXT PRIMARY KEY,
  report_count INT NOT NULL DEFAULT 0,
  trusted_at TIMESTAMPTZ,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.devices TO anon, authenticated;
GRANT ALL ON public.devices TO service_role;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "devices public read" ON public.devices FOR SELECT USING (true);
CREATE POLICY "devices public upsert" ON public.devices FOR INSERT WITH CHECK (true);
CREATE POLICY "devices public update" ON public.devices FOR UPDATE USING (true) WITH CHECK (true);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users see own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('admin','moderator')
  )
$$;

CREATE TABLE public.issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id TEXT UNIQUE NOT NULL,
  slug TEXT,
  category_id INT NOT NULL REFERENCES public.categories(id),
  description TEXT NOT NULL,
  severity public.issue_severity NOT NULL DEFAULT 'medium',
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  address TEXT,
  ward_id INT REFERENCES public.wards(id),
  area TEXT,
  locality TEXT,
  pincode TEXT,
  image_url TEXT,
  image_phash TEXT,
  status public.issue_status NOT NULL DEFAULT 'reported',
  visibility public.issue_visibility NOT NULL DEFAULT 'visible',
  duplicate_of_id UUID REFERENCES public.issues(id),
  heat_score NUMERIC NOT NULL DEFAULT 0,
  assigned_authority_id INT REFERENCES public.authorities(id),
  assigned_representative_id INT REFERENCES public.representatives(id),
  assignment_reason TEXT,
  assignment_rule_version INT,
  device_id TEXT,
  views INT NOT NULL DEFAULT 0,
  duplicate_count INT NOT NULL DEFAULT 0,
  thanked_count INT NOT NULL DEFAULT 0,
  supporters_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX issues_status_idx ON public.issues(status);
CREATE INDEX issues_category_idx ON public.issues(category_id);
CREATE INDEX issues_ward_idx ON public.issues(ward_id);
CREATE INDEX issues_geo_idx ON public.issues(lat, lng);
CREATE INDEX issues_created_idx ON public.issues(created_at DESC);
CREATE INDEX issues_heat_idx ON public.issues(heat_score DESC);
CREATE INDEX issues_visibility_idx ON public.issues(visibility);
CREATE INDEX issues_desc_trgm ON public.issues USING gin (description gin_trgm_ops);

GRANT SELECT, INSERT ON public.issues TO anon, authenticated;
GRANT UPDATE ON public.issues TO authenticated;
GRANT ALL ON public.issues TO service_role;
ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "issues public read visible" ON public.issues FOR SELECT
  USING (visibility = 'visible' OR public.is_admin());
CREATE POLICY "issues public insert" ON public.issues FOR INSERT WITH CHECK (true);
CREATE POLICY "issues admin update" ON public.issues FOR UPDATE
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "issues admin delete" ON public.issues FOR DELETE USING (public.is_admin());

CREATE TRIGGER trg_issues_updated BEFORE UPDATE ON public.issues
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE SEQUENCE IF NOT EXISTS public.issues_public_seq;
GRANT USAGE ON SEQUENCE public.issues_public_seq TO anon, authenticated;
CREATE OR REPLACE FUNCTION public.next_public_id()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE n BIGINT; BEGIN
  n := nextval('public.issues_public_seq');
  RETURN 'MGR-' || to_char(now(),'YYYY') || '-' || lpad(n::text, 5, '0');
END $$;

CREATE TABLE public.issue_votes (
  issue_id UUID NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  vote public.vote_kind NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (issue_id, device_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.issue_votes TO anon, authenticated;
GRANT ALL ON public.issue_votes TO service_role;
ALTER TABLE public.issue_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "votes public read" ON public.issue_votes FOR SELECT USING (true);
CREATE POLICY "votes public write" ON public.issue_votes FOR INSERT WITH CHECK (true);
CREATE POLICY "votes public update" ON public.issue_votes FOR UPDATE USING (true) WITH CHECK (true);

CREATE TABLE public.issue_supporters (
  issue_id UUID NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (issue_id, device_id)
);
GRANT SELECT, INSERT ON public.issue_supporters TO anon, authenticated;
GRANT ALL ON public.issue_supporters TO service_role;
ALTER TABLE public.issue_supporters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sup public read" ON public.issue_supporters FOR SELECT USING (true);
CREATE POLICY "sup public write" ON public.issue_supporters FOR INSERT WITH CHECK (true);

CREATE TABLE public.issue_thanks (
  issue_id UUID NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (issue_id, device_id)
);
GRANT SELECT, INSERT ON public.issue_thanks TO anon, authenticated;
GRANT ALL ON public.issue_thanks TO service_role;
ALTER TABLE public.issue_thanks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "thanks public read" ON public.issue_thanks FOR SELECT USING (true);
CREATE POLICY "thanks public write" ON public.issue_thanks FOR INSERT WITH CHECK (true);

CREATE TABLE public.issue_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  device_id TEXT,
  name TEXT,
  body TEXT NOT NULL,
  quick_reply public.quick_reply,
  hidden BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX comments_issue_idx ON public.issue_comments(issue_id, created_at DESC);
GRANT SELECT, INSERT ON public.issue_comments TO anon, authenticated;
GRANT UPDATE ON public.issue_comments TO authenticated;
GRANT ALL ON public.issue_comments TO service_role;
ALTER TABLE public.issue_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments read" ON public.issue_comments FOR SELECT
  USING (hidden = false OR public.is_admin());
CREATE POLICY "comments write" ON public.issue_comments FOR INSERT WITH CHECK (true);
CREATE POLICY "comments admin update" ON public.issue_comments FOR UPDATE
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE public.issue_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  status public.issue_status,
  note TEXT,
  photo_url TEXT,
  photo_kind public.photo_kind,
  by_admin BOOLEAN NOT NULL DEFAULT false,
  by_device_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX history_issue_idx ON public.issue_status_history(issue_id, created_at);
GRANT SELECT, INSERT ON public.issue_status_history TO anon, authenticated;
GRANT UPDATE ON public.issue_status_history TO authenticated;
GRANT ALL ON public.issue_status_history TO service_role;
ALTER TABLE public.issue_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "history read" ON public.issue_status_history FOR SELECT USING (true);
CREATE POLICY "history public insert citizen" ON public.issue_status_history FOR INSERT
  WITH CHECK (by_admin = false AND status IS NULL);
CREATE POLICY "history admin update" ON public.issue_status_history FOR UPDATE
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE public.issue_official_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  posted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX official_issue_idx ON public.issue_official_updates(issue_id, created_at DESC);
GRANT SELECT ON public.issue_official_updates TO anon, authenticated;
GRANT INSERT ON public.issue_official_updates TO authenticated;
GRANT ALL ON public.issue_official_updates TO service_role;
ALTER TABLE public.issue_official_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "official read" ON public.issue_official_updates FOR SELECT USING (true);
CREATE POLICY "official admin write" ON public.issue_official_updates FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

CREATE TABLE public.issue_watchers (
  issue_id UUID NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (issue_id, device_id)
);
GRANT SELECT, INSERT ON public.issue_watchers TO anon, authenticated;
GRANT ALL ON public.issue_watchers TO service_role;
ALTER TABLE public.issue_watchers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "watchers read" ON public.issue_watchers FOR SELECT USING (true);
CREATE POLICY "watchers write" ON public.issue_watchers FOR INSERT WITH CHECK (true);

CREATE POLICY "storage public read" ON storage.objects FOR SELECT
  USING (bucket_id IN ('issue-photos','repair-photos','authority-logos','rep-photos'));

CREATE POLICY "storage public insert issues" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'issue-photos');

CREATE POLICY "storage admin insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('repair-photos','authority-logos','rep-photos') AND public.is_admin());

CREATE POLICY "storage admin update" ON storage.objects FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "storage admin delete" ON storage.objects FOR DELETE TO authenticated
  USING (public.is_admin());

ALTER TABLE public.wards ADD COLUMN IF NOT EXISTS city TEXT NOT NULL DEFAULT 'Mangaluru';
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS city TEXT NOT NULL DEFAULT 'Mangaluru';
ALTER TABLE public.authorities ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.representatives ADD COLUMN IF NOT EXISTS city TEXT;

-- Seed Migration: Core Data for JanFix Mangaluru (Dakshina Kannada)
-- Idempotent — safe to run multiple times.
-- ============================================================================

-- 1. CATEGORIES --------------------------------------------------------------
INSERT INTO public.categories (slug, name_en, name_kn, icon, color, sort_order)
VALUES
  ('pothole',         'Pothole',          'ಗುಂಡಿ',           'Construction',   '#ef4444', 1),
  ('garbage',         'Garbage',          'ಕಸ',              'Trash2',         '#16a34a', 2),
  ('sewage',          'Sewage Overflow',  'ಚರಂಡಿ ಉಕ್ಕಿ',       'Droplet',        '#7c3aed', 3),
  ('water-leakage',   'Water Leakage',    'ನೀರಿನ ಸೋರಿಕೆ',      'Droplets',       '#0ea5e9', 4),
  ('streetlight',     'Broken Streetlight','ದೀಪ ಕೆಟ್ಟಿದೆ',     'Lightbulb',      '#f59e0b', 5),
  ('road-damage',     'Road Damage',      'ರಸ್ತೆ ಹಾನಿ',       'TriangleAlert',  '#dc2626', 6),
  ('footpath',        'Footpath Damage',  'ಪಾದಚಾರಿ ಮಾರ್ಗ',    'Footprints',     '#a16207', 7),
  ('drain',           'Drain Blockage',   'ಚರಂಡಿ ಕಟ್ಟು',       'Filter',         '#0891b2', 8),
  ('tree-hazard',     'Tree Hazard',      'ಮರದ ಅಪಾಯ',         'Trees',          '#15803d', 9),
  ('public-toilet',   'Public Toilet',    'ಶೌಚಾಲಯ',           'DoorOpen',       '#9333ea',10),
  ('illegal-dumping', 'Illegal Dumping',  'ಅಕ್ರಮ ಕಸ',         'Ban',            '#b91c1c',11),
  ('traffic-signal',  'Traffic Signal',   'ಸಂಚಾರ ಸಂಕೇತ',       'TrafficCone',    '#ea580c',12),
  ('others',          'Others',           'ಇತರೆ',             'HelpCircle',     '#64748b',13)
ON CONFLICT (slug) DO NOTHING;

-- 2. AUTHORITIES ------------------------------------------------------------
INSERT INTO public.authorities (name, type, department, jurisdiction, city)
VALUES
  ('MCC Roads Department',                'municipal',  'Roads',               'Mangaluru City limits',                     'Mangaluru'),
  ('MCC Health Department',               'municipal',  'Health & Sanitation', 'Mangaluru City limits',                     'Mangaluru'),
  ('KUWS&DB',                             'utility',    'Water & Drainage',    'Mangaluru urban area',                      'Mangaluru'),
  ('MESCOM',                              'utility',    'Electricity',         'Mangaluru region',                          'Mangaluru'),
  ('Mangaluru Traffic Police',            'police',     'Traffic',             'Mangaluru City',                            'Mangaluru'),
  ('PWD Karnataka',                       'state',      'Public Works',        'DK District highways & major roads',        'Mangaluru'),
  ('NHAI',                                'central',    'National Highways',   'National highways passing through DK',      NULL),
  ('MCC Horticulture',                    'municipal',  'Horticulture',        'Mangaluru City parks & trees',              'Mangaluru'),
  ('MCC General Administration',          'municipal',  'General Admin',       'Mangaluru City',                            'Mangaluru'),
  ('MCC Engineering',                     'municipal',  'Engineering',         'Mangaluru City infrastructure',             'Mangaluru'),
  ('Zilla Panchayat Dakshina Kannada',    'panchayat',  'Rural Development',   'Rural areas of DK District',                NULL),
  ('DK District Administration',          'district',   'District Admin',      'Whole Dakshina Kannada District',           NULL)
ON CONFLICT DO NOTHING;

-- 3. WARDS (60 MCC wards with locality names) ------------------------------
INSERT INTO public.wards (number, name, area, city)
VALUES
  (1,  'Kudroli',       'Kudroli',       'Mangaluru'),
  (2,  'Mangaladevi',   'Mangaladevi',   'Mangaluru'),
  (3,  'Bolar',         'Bolar',         'Mangaluru'),
  (4,  'Jeppu',         'Jeppu',         'Mangaluru'),
  (5,  'Bendoor',       'Bendoor',       'Mangaluru'),
  (6,  'Kankanady',     'Kankanady',     'Mangaluru'),
  (7,  'Urwa',          'Urwa',          'Mangaluru'),
  (8,  'Pumpwell',      'Pumpwell',      'Mangaluru'),
  (9,  'Padil',         'Padil',         'Mangaluru'),
  (10, 'Kulur',         'Kulur',         'Mangaluru'),
  (11, 'Surathkal',     'Surathkal',     'Mangaluru'),
  (12, 'Panambur',      'Panambur',      'Mangaluru'),
  (13, 'Baikampady',    'Baikampady',    'Mangaluru'),
  (14, 'Tannirbavi',    'Tannirbavi',    'Mangaluru'),
  (15, 'Hosabettu',     'Hosabettu',     'Mangaluru'),
  (16, 'Mudushedde',    'Mudushedde',    'Mangaluru'),
  (17, 'Krishnapur',    'Krishnapur',    'Mangaluru'),
  (18, 'Shirthady',     'Shirthady',     'Mangaluru'),
  (19, 'Deralakatte',   'Deralakatte',   'Mangaluru'),
  (20, 'Thokkottu',     'Thokkottu',     'Mangaluru'),
  (21, 'Kotekar',       'Kotekar',       'Mangaluru'),
  (22, 'Ullal',         'Ullal',         'Mangaluru'),
  (23, 'Katipalla',     'Katipalla',     'Mangaluru'),
  (24, 'Kavoor',        'Kavoor',        'Mangaluru'),
  (25, 'Kunjathbail',   'Kunjathbail',   'Mangaluru'),
  (26, 'Marakada',      'Marakada',      'Mangaluru'),
  (27, 'Attavar',       'Attavar',       'Mangaluru'),
  (28, 'Bejai',         'Bejai',         'Mangaluru'),
  (29, 'Kodialbail',    'Kodialbail',    'Mangaluru'),
  (30, 'Car Street',    'Car Street',    'Mangaluru'),
  (31, 'Hampankatta',   'Hampankatta',   'Mangaluru'),
  (32, 'Balmatta',      'Balmatta',      'Mangaluru'),
  (33, 'State Bank',    'State Bank',    'Mangaluru'),
  (34, 'PVS Circle',    'PVS Circle',    'Mangaluru'),
  (35, 'Falnir',        'Falnir',        'Mangaluru'),
  (36, 'Bunts Hostel',  'Bunts Hostel',  'Mangaluru'),
  (37, 'Lalbagh',       'Lalbagh',       'Mangaluru'),
  (38, 'Mannagudda',    'Mannagudda',    'Mangaluru'),
  (39, 'Kadri',         'Kadri',         'Mangaluru'),
  (40, 'Kadri Hills',   'Kadri Hills',   'Mangaluru'),
  (41, 'Kapikad',       'Kapikad',       'Mangaluru'),
  (42, 'Thumbay',       'Thumbay',       'Mangaluru'),
  (43, 'Vamanjoor',     'Vamanjoor',     'Mangaluru'),
  (44, 'Kutipuram',     'Kutipuram',     'Mangaluru'),
  (45, 'Adyar',         'Adyar',         'Mangaluru'),
  (46, 'Gantalkatte',   'Gantalkatte',   'Mangaluru'),
  (47, 'Nandigudda',    'Nandigudda',    'Mangaluru'),
  (48, 'Konchady',      'Konchady',      'Mangaluru'),
  (49, 'Paneer',        'Paneer',        'Mangaluru'),
  (50, 'Derebail',      'Derebail',      'Mangaluru'),
  (51, 'Kottara',       'Kottara',       'Mangaluru'),
  (52, 'Kodialguttu',   'Kodialguttu',   'Mangaluru'),
  (53, 'Bangra Kulur',  'Bangra Kulur',  'Mangaluru'),
  (54, 'Moodushedde',   'Moodushedde',   'Mangaluru'),
  (55, 'Yekkur',        'Yekkur',        'Mangaluru'),
  (56, 'Kinnigoli',     'Kinnigoli',     'Mangaluru'),
  (57, 'Paldane',       'Paldane',       'Mangaluru'),
  (58, 'Shamboor',      'Shamboor',      'Mangaluru'),
  (59, 'Paduperar',     'Paduperar',     'Mangaluru'),
  (60, 'Thenka Patla',  'Thenka Patla',  'Mangaluru')
ON CONFLICT (number) DO NOTHING;

-- 4. REPRESENTATIVES --------------------------------------------------------
-- We use a DO block to look up FK IDs dynamically for idempotency.
DO $$
DECLARE
  _mcc_roads    INT; _mcc_health   INT; _kuwsdb      INT;
  _mescom       INT; _traffic_police INT; _pwd        INT;
  _nhai         INT; _mcc_hort     INT; _mcc_gen     INT;
  _mcc_engg     INT; _zp_dk        INT; _dk_admin    INT;
  _cat_pothole  INT; _cat_garbage  INT; _cat_sewage  INT;
  _cat_water    INT; _cat_street   INT; _cat_road    INT;
  _cat_footpath INT; _cat_drain    INT; _cat_tree    INT;
  _cat_toilet   INT; _cat_dumping  INT; _cat_traffic INT;
  _cat_others   INT;
  _ward_rec     RECORD;
BEGIN
  -- Look up authority IDs
  SELECT id INTO _mcc_roads    FROM public.authorities WHERE name = 'MCC Roads Department';
  SELECT id INTO _mcc_health   FROM public.authorities WHERE name = 'MCC Health Department';
  SELECT id INTO _kuwsdb       FROM public.authorities WHERE name = 'KUWS&DB';
  SELECT id INTO _mescom       FROM public.authorities WHERE name = 'MESCOM';
  SELECT id INTO _traffic_police FROM public.authorities WHERE name = 'Mangaluru Traffic Police';
  SELECT id INTO _pwd          FROM public.authorities WHERE name = 'PWD Karnataka';
  SELECT id INTO _nhai         FROM public.authorities WHERE name = 'NHAI';
  SELECT id INTO _mcc_hort     FROM public.authorities WHERE name = 'MCC Horticulture';
  SELECT id INTO _mcc_gen      FROM public.authorities WHERE name = 'MCC General Administration';
  SELECT id INTO _mcc_engg     FROM public.authorities WHERE name = 'MCC Engineering';
  SELECT id INTO _zp_dk        FROM public.authorities WHERE name = 'Zilla Panchayat Dakshina Kannada';
  SELECT id INTO _dk_admin     FROM public.authorities WHERE name = 'DK District Administration';

  -- Look up category IDs
  SELECT id INTO _cat_pothole  FROM public.categories WHERE slug = 'pothole';
  SELECT id INTO _cat_garbage  FROM public.categories WHERE slug = 'garbage';
  SELECT id INTO _cat_sewage   FROM public.categories WHERE slug = 'sewage';
  SELECT id INTO _cat_water    FROM public.categories WHERE slug = 'water-leakage';
  SELECT id INTO _cat_street   FROM public.categories WHERE slug = 'streetlight';
  SELECT id INTO _cat_road     FROM public.categories WHERE slug = 'road-damage';
  SELECT id INTO _cat_footpath FROM public.categories WHERE slug = 'footpath';
  SELECT id INTO _cat_drain    FROM public.categories WHERE slug = 'drain';
  SELECT id INTO _cat_tree     FROM public.categories WHERE slug = 'tree-hazard';
  SELECT id INTO _cat_toilet   FROM public.categories WHERE slug = 'public-toilet';
  SELECT id INTO _cat_dumping  FROM public.categories WHERE slug = 'illegal-dumping';
  SELECT id INTO _cat_traffic  FROM public.categories WHERE slug = 'traffic-signal';
  SELECT id INTO _cat_others   FROM public.categories WHERE slug = 'others';

  -- ========================================================================
  -- Elected representatives / officials
  -- ========================================================================

  -- MP - Dakshina Kannada
  INSERT INTO public.representatives (name, role, constituency, authority_id, city)
  VALUES ('Capt. Brijesh Chowta', 'MP', 'Dakshina Kannada', _dk_admin, 'Mangaluru')
  ON CONFLICT DO NOTHING;

  -- MLAs
  INSERT INTO public.representatives (name, role, constituency, authority_id, city) VALUES
    ('Vedavyas Kamath',     'MLA', 'Mangaluru City South', _dk_admin, 'Mangaluru'),
    ('Dr. Bharath Shetty',  'MLA', 'Mangaluru City North', _dk_admin, 'Mangaluru'),
    ('Umanath A. Kotian',   'MLA', 'Bantwal',              _dk_admin, 'Mangaluru'),
    ('Ashok Kumar Rai',     'MLA', 'Puttur',               _dk_admin, 'Mangaluru'),
    ('Kagodu Thimmappa',    'MLA', 'Sullia (SC)',          _dk_admin, 'Mangaluru'),
    ('Harish Poonja',       'MLA', 'Belthangady',          _dk_admin, 'Mangaluru'),
    ('K. Raghavendra Nair', 'MLA', 'Mangaluru',            _dk_admin, 'Mangaluru')
  ON CONFLICT DO NOTHING;

  -- Mayor & Commissioner
  INSERT INTO public.representatives (name, role, constituency, authority_id, city) VALUES
    ('Manja',             'Mayor',         'Mangaluru City', _mcc_gen, 'Mangaluru'),
    ('Dr. M. R. Ravi',    'Commissioner',  'Mangaluru City', _mcc_gen, 'Mangaluru')
  ON CONFLICT DO NOTHING;

  -- Engineers (one per authority)
  INSERT INTO public.representatives (name, role, authority_id, city) VALUES
    ('Chief Engineer, MCC Roads',    'Engineer', _mcc_roads,    'Mangaluru'),
    ('Chief Health Officer',         'Engineer', _mcc_health,   'Mangaluru'),
    ('Executive Engineer, KUWS&DB',  'Engineer', _kuwsdb,       'Mangaluru'),
    ('Superintending Engineer, MESCOM', 'Engineer', _mescom,    'Mangaluru'),
    ('Traffic Engineer',             'Engineer', _traffic_police,'Mangaluru'),
    ('Executive Engineer, PWD',      'Engineer', _pwd,          'Mangaluru'),
    ('Project Director, NHAI',       'Engineer', _nhai,         NULL),
    ('Horticulture Officer',         'Engineer', _mcc_hort,     'Mangaluru'),
    ('Chief Engineer, MCC',          'Engineer', _mcc_engg,     'Mangaluru'),
    ('Executive Engineer, ZP DK',    'Engineer', _zp_dk,        NULL),
    ('District Engineer, DK',        'Engineer', _dk_admin,     NULL)
  ON CONFLICT DO NOTHING;

  -- 60 Corporators (one per ward)
  FOR _ward_rec IN SELECT id, number, name FROM public.wards ORDER BY number LOOP
    INSERT INTO public.representatives (name, role, constituency, ward_id, authority_id, city)
    VALUES (
      'Corporator, Ward ' || _ward_rec.number || ' (' || _ward_rec.name || ')',
      'Corporator',
      'Ward ' || _ward_rec.number || ' - ' || _ward_rec.name,
      _ward_rec.id,
      _mcc_gen,
      'Mangaluru'
    )
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- ========================================================================
  -- 5. ASSIGNMENT RULES  (category → authority)
  -- ========================================================================
  INSERT INTO public.assignment_rules (category_id, authority_id, active) VALUES
    (_cat_pothole,  _mcc_roads,    true),
    (_cat_road,     _mcc_roads,    true),
    (_cat_garbage,  _mcc_health,   true),
    (_cat_dumping,  _mcc_health,   true),
    (_cat_water,    _kuwsdb,       true),
    (_cat_sewage,   _kuwsdb,       true),
    (_cat_street,   _mescom,       true),
    (_cat_traffic,  _traffic_police, true),
    (_cat_footpath, _mcc_engg,     true),
    (_cat_drain,    _mcc_engg,     true),
    (_cat_tree,     _mcc_hort,     true),
    (_cat_toilet,   _mcc_gen,      true),
    (_cat_others,   _mcc_gen,      true)
  ON CONFLICT DO NOTHING;

END $$;

-- ============================================================================
-- 6. AUTHORITY STATS VIEW
-- ============================================================================
CREATE OR REPLACE VIEW public.authority_stats_view AS
SELECT
  a.id,
  a.name,
  a.type,
  a.logo_url,
  a.photo_url,
  a.department,
  a.phone,
  a.email,
  a.address,
  a.website,
  a.jurisdiction,
  COUNT(i.id) AS total,
  COUNT(CASE WHEN i.status IN ('resolved', 'community_confirmed', 'closed') THEN 1 END) AS resolved,
  COUNT(CASE WHEN i.status NOT IN ('resolved', 'community_confirmed', 'closed') OR i.status IS NULL THEN 1 END) AS pending,
  COALESCE(AVG(CASE WHEN i.status IN ('resolved', 'community_confirmed', 'closed') THEN EXTRACT(EPOCH FROM (i.updated_at - i.created_at)) / 86400 END), 0) AS avg_days,
  CASE WHEN COUNT(i.id) > 0 THEN ROUND((COUNT(CASE WHEN i.status IN ('resolved', 'community_confirmed', 'closed') THEN 1 END)::numeric / COUNT(i.id)) * 100) ELSE 0 END AS score
FROM public.authorities a
LEFT JOIN public.issues i ON i.assigned_authority_id = a.id AND i.visibility = 'visible'
GROUP BY a.id;

GRANT SELECT ON public.authority_stats_view TO anon, authenticated;

-- ============================================================================
-- 6b. WARD STATS VIEW
-- ============================================================================
CREATE OR REPLACE VIEW public.ward_stats_view AS
SELECT
  w.id,
  w.number,
  w.name,
  w.area,
  w.city,
  COUNT(i.id) AS total,
  COUNT(CASE WHEN i.status IN ('resolved', 'community_confirmed', 'closed') THEN 1 END) AS resolved,
  COUNT(CASE WHEN i.status NOT IN ('resolved', 'community_confirmed', 'closed') OR i.status IS NULL THEN 1 END) AS pending,
  CASE WHEN COUNT(i.id) > 0 THEN ROUND((COUNT(CASE WHEN i.status IN ('resolved', 'community_confirmed', 'closed') THEN 1 END)::numeric / COUNT(i.id)) * 100) ELSE 0 END AS score
FROM public.wards w
LEFT JOIN public.issues i ON i.ward_id = w.id AND i.visibility = 'visible'
GROUP BY w.id;

GRANT SELECT ON public.ward_stats_view TO anon, authenticated;

-- ============================================================================
-- 6c. REPRESENTATIVE STATS VIEW
-- ============================================================================
CREATE OR REPLACE VIEW public.representative_stats_view AS
SELECT
  r.id,
  r.name,
  r.role,
  r.constituency,
  r.photo_url,
  r.phone,
  r.email,
  r.authority_id,
  r.ward_id,
  r.active,
  COUNT(i.id) AS total,
  COUNT(CASE WHEN i.status IN ('resolved', 'community_confirmed', 'closed') THEN 1 END) AS resolved,
  COUNT(CASE WHEN i.status NOT IN ('resolved', 'community_confirmed', 'closed') OR i.status IS NULL THEN 1 END) AS pending,
  CASE WHEN COUNT(i.id) > 0 THEN ROUND((COUNT(CASE WHEN i.status IN ('resolved', 'community_confirmed', 'closed') THEN 1 END)::numeric / COUNT(i.id)) * 100) ELSE 0 END AS score
FROM public.representatives r
LEFT JOIN public.issues i ON i.assigned_representative_id = r.id AND i.visibility = 'visible'
GROUP BY r.id;

GRANT SELECT ON public.representative_stats_view TO anon, authenticated;

-- ============================================================================
-- 6d. ANALYTICS VIEW
-- ============================================================================
CREATE OR REPLACE VIEW public.analytics_view AS
SELECT 
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') AS today,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') AS week,
  COUNT(*) FILTER (WHERE status IN ('resolved', 'community_confirmed', 'closed')) AS resolved,
  COALESCE(AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400) FILTER (WHERE status IN ('resolved', 'community_confirmed', 'closed')), 0) AS avg_days,
  (SELECT ward_id FROM public.issues WHERE visibility = 'visible' AND ward_id IS NOT NULL GROUP BY ward_id ORDER BY COUNT(*) DESC LIMIT 1) AS top_ward_id,
  (SELECT category_id FROM public.issues WHERE visibility = 'visible' GROUP BY category_id ORDER BY COUNT(*) DESC LIMIT 1) AS top_category_id
FROM public.issues
WHERE visibility = 'visible';

GRANT SELECT ON public.analytics_view TO anon, authenticated;

-- ============================================================================
-- 7. HEAT SCORING ALGORITHM
-- ============================================================================
CREATE OR REPLACE FUNCTION public.compute_heat_score(issue_uuid UUID)
RETURNS NUMERIC LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_sev public.issue_severity;
  v_sev_weight NUMERIC;
  v_supporters BIGINT;
  v_votes_exists BIGINT;
  v_votes_fixed BIGINT;
  v_comments BIGINT;
  v_watchers BIGINT;
  v_created TIMESTAMPTZ;
  v_status public.issue_status;
  v_status_mult NUMERIC;
  v_days NUMERIC;
  v_decay NUMERIC;
  v_final_score NUMERIC;
BEGIN
  -- Get issue basic details
  SELECT severity, status, created_at, supporters_count
  INTO v_sev, v_status, v_created, v_supporters
  FROM public.issues
  WHERE id = issue_uuid;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Severity weight
  v_sev_weight := CASE v_sev
    WHEN 'low' THEN 0.2
    WHEN 'medium' THEN 0.5
    WHEN 'high' THEN 0.8
    WHEN 'dangerous' THEN 1.0
    ELSE 0.5
  END;

  -- Supporters count
  SELECT COUNT(*) INTO v_supporters FROM public.issue_supporters WHERE issue_id = issue_uuid;
  
  -- Votes
  SELECT COUNT(*) FILTER (WHERE vote = 'exists'), COUNT(*) FILTER (WHERE vote = 'fixed')
  INTO v_votes_exists, v_votes_fixed
  FROM public.issue_votes
  WHERE issue_id = issue_uuid;

  -- Comments
  SELECT COUNT(*) INTO v_comments FROM public.issue_comments WHERE issue_id = issue_uuid;

  -- Watchers
  SELECT COUNT(*) INTO v_watchers FROM public.issue_watchers WHERE issue_id = issue_uuid;

  -- Recency boost: exponential decay over 14 days
  v_days := EXTRACT(EPOCH FROM (now() - v_created)) / 86400;
  v_decay := 20 * exp(-v_days / 14);

  -- Status multiplier
  v_status_mult := CASE v_status
    WHEN 'reported' THEN 1.0
    WHEN 'acknowledged' THEN 0.9
    WHEN 'in_progress' THEN 0.7
    WHEN 'resolved' THEN 0.3
    WHEN 'community_confirmed' THEN 0.2
    WHEN 'closed' THEN 0.1
    ELSE 1.0
  END;

  -- Calculate final score
  v_final_score := (
    (v_sev_weight * 25) +
    (v_supporters * 3) +
    (v_votes_exists * 2) +
    (v_comments * 1.5) +
    (v_watchers * 1) +
    v_decay
  ) * v_status_mult;

  RETURN ROUND(v_final_score, 2);
END;
$$;

-- Trigger function for related tables
CREATE OR REPLACE FUNCTION public.tg_update_heat_score()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_issue_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_issue_id := OLD.issue_id;
  ELSE
    v_issue_id := NEW.issue_id;
  END IF;

  IF v_issue_id IS NOT NULL THEN
    UPDATE public.issues
    SET heat_score = public.compute_heat_score(v_issue_id)
    WHERE id = v_issue_id;
  END IF;

  RETURN NULL;
END;
$$;

-- Trigger function for issue self-update (status/severity changes)
CREATE OR REPLACE FUNCTION public.tg_issue_self_heat_score()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.heat_score := public.compute_heat_score(NEW.id);
  RETURN NEW;
END;
$$;

-- Trigger function for issue insert
CREATE OR REPLACE FUNCTION public.tg_issue_insert_heat_score()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_sev_weight NUMERIC;
BEGIN
  v_sev_weight := CASE NEW.severity
    WHEN 'low' THEN 0.2
    WHEN 'medium' THEN 0.5
    WHEN 'high' THEN 0.8
    WHEN 'dangerous' THEN 1.0
    ELSE 0.5
  END;
  NEW.heat_score := (v_sev_weight * 25) + 20; -- Initial decay is 20
  RETURN NEW;
END;
$$;

-- Create triggers
CREATE TRIGGER trg_issue_self_heat_score
BEFORE UPDATE OF status, severity ON public.issues
FOR EACH ROW EXECUTE FUNCTION public.tg_issue_self_heat_score();

CREATE TRIGGER trg_issue_insert_heat_score
BEFORE INSERT ON public.issues
FOR EACH ROW EXECUTE FUNCTION public.tg_issue_insert_heat_score();

CREATE TRIGGER trg_heat_score_supporters
AFTER INSERT OR DELETE ON public.issue_supporters
FOR EACH ROW EXECUTE FUNCTION public.tg_update_heat_score();

CREATE TRIGGER trg_heat_score_votes
AFTER INSERT OR UPDATE OR DELETE ON public.issue_votes
FOR EACH ROW EXECUTE FUNCTION public.tg_update_heat_score();

CREATE TRIGGER trg_heat_score_comments
AFTER INSERT OR DELETE ON public.issue_comments
FOR EACH ROW EXECUTE FUNCTION public.tg_update_heat_score();

CREATE TRIGGER trg_heat_score_watchers
AFTER INSERT OR DELETE ON public.issue_watchers
FOR EACH ROW EXECUTE FUNCTION public.tg_update_heat_score();

-- ============================================================================
-- 8. DEVICE AUTO-UPSERT ON ISSUE INSERT
-- ============================================================================
CREATE OR REPLACE FUNCTION public.tg_upsert_device_on_issue_insert()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.device_id IS NOT NULL THEN
    INSERT INTO public.devices (device_id, report_count, last_seen)
    VALUES (NEW.device_id, 1, NOW())
    ON CONFLICT (device_id)
    DO UPDATE SET 
      report_count = public.devices.report_count + 1,
      last_seen = NOW();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_upsert_device_on_issue_insert ON public.issues;
CREATE TRIGGER trg_upsert_device_on_issue_insert
BEFORE INSERT ON public.issues
FOR EACH ROW EXECUTE FUNCTION public.tg_upsert_device_on_issue_insert();

-- ============================================================================
-- 9. ATOMIC ISSUE VOTING & STATUS TRANSITION RPC
-- ============================================================================
CREATE OR REPLACE FUNCTION public.vote_issue(
  p_issue_id UUID,
  p_device_id TEXT,
  p_vote public.vote_kind
)
RETURNS TABLE(exists_count BIGINT, fixed_count BIGINT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_exists BIGINT;
  v_fixed BIGINT;
  v_total BIGINT;
  v_status public.issue_status;
BEGIN
  -- 1. Upsert vote
  INSERT INTO public.issue_votes (issue_id, device_id, vote, created_at)
  VALUES (p_issue_id, p_device_id, p_vote, NOW())
  ON CONFLICT (issue_id, device_id)
  DO UPDATE SET vote = EXCLUDED.vote, created_at = NOW();

  -- 2. Count votes
  SELECT 
    COUNT(*) FILTER (WHERE vote = 'exists'),
    COUNT(*) FILTER (WHERE vote = 'fixed')
  INTO v_exists, v_fixed
  FROM public.issue_votes
  WHERE issue_id = p_issue_id;

  v_total := v_exists + v_fixed;

  -- 3. Get current status
  SELECT status INTO v_status FROM public.issues WHERE id = p_issue_id;

  -- 4. Check auto flips
  IF v_status = 'reported' AND v_exists >= 5 AND (v_exists::numeric / v_total) >= 0.7 THEN
    UPDATE public.issues SET status = 'community_verified' WHERE id = p_issue_id;
    INSERT INTO public.issue_status_history (issue_id, status, note, by_admin, created_at)
    VALUES (p_issue_id, 'community_verified', 'Auto-verified by community (≥70% agreement)', false, NOW());
  ELSIF v_status = 'resolved' AND v_fixed >= 5 AND (v_fixed::numeric / v_total) >= 0.7 THEN
    UPDATE public.issues SET status = 'community_confirmed' WHERE id = p_issue_id;
    INSERT INTO public.issue_status_history (issue_id, status, note, by_admin, created_at)
    VALUES (p_issue_id, 'community_confirmed', 'Community confirmed fix (≥70% agreement)', false, NOW());
  END IF;

  RETURN QUERY SELECT v_exists, v_fixed;
END;
$$;

GRANT EXECUTE ON FUNCTION public.vote_issue(UUID, TEXT, public.vote_kind) TO anon, authenticated;

-- ============================================================================
-- 10. ATOMIC DUPLICATE DETECTION SIMILARITY SCORING RPC
-- ============================================================================
CREATE OR REPLACE FUNCTION public.find_duplicate_issues(
  p_category_slug TEXT,
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_desc TEXT,
  p_phash TEXT,
  p_radius_deg DOUBLE PRECISION DEFAULT 0.002
)
RETURNS TABLE (
  id UUID,
  public_id TEXT,
  slug TEXT,
  description TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  image_phash TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ,
  status public.issue_status,
  supporters_count INT,
  geo_sim NUMERIC,
  phash_sim NUMERIC,
  desc_sim NUMERIC,
  similarity_score NUMERIC,
  distance_meters NUMERIC
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cat_id INT;
BEGIN
  -- 1. Find category
  SELECT c.id INTO v_cat_id FROM public.categories c WHERE c.slug = p_category_slug;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT 
      i.id AS c_id,
      i.public_id AS c_pub_id,
      i.slug AS c_slug,
      i.description AS c_desc,
      i.lat AS c_lat,
      i.lng AS c_lng,
      i.image_phash AS c_phash,
      i.image_url AS c_img_url,
      i.created_at AS c_created,
      i.status AS c_status,
      i.supporters_count AS c_supporters,
      (6371000 * acos(
        cos(radians(p_lat)) * cos(radians(i.lat)) * cos(radians(i.lng) - radians(p_lng)) +
        sin(radians(p_lat)) * sin(radians(i.lat))
      ))::numeric AS meters
    FROM public.issues i
    WHERE i.category_id = v_cat_id
      AND i.visibility = 'visible'
      AND i.duplicate_of_id IS NULL
      AND i.created_at >= NOW() - INTERVAL '60 days'
      AND i.lat BETWEEN p_lat - p_radius_deg AND p_lat + p_radius_deg
      AND i.lng BETWEEN p_lng - p_radius_deg AND p_lng + p_radius_deg
  ),
  scored_candidates AS (
    SELECT
      c_id, c_pub_id, c_slug, c_desc, c_lat, c_lng, c_phash, c_img_url, c_created, c_status, c_supporters,
      (CASE 
        WHEN meters < 50 THEN 1.0
        WHEN meters < 100 THEN 0.7
        WHEN meters < 200 THEN 0.4
        ELSE 0.1
      END)::numeric AS g_sim,
      (CASE 
        WHEN p_phash IS NOT NULL AND c_phash IS NOT NULL AND length(p_phash) = 16 AND length(c_phash) = 16 THEN
          1.0 - (bit_count(('x' || p_phash)::bit(64) # ('x' || c_phash)::bit(64))::numeric / 64.0)
        ELSE 0.0
      END)::numeric AS p_sim,
      COALESCE(similarity(p_desc, c_desc)::numeric, 0.0) AS d_sim,
      meters AS dist_meters
    FROM candidates
  )
  SELECT 
    c_id, c_pub_id, c_slug, c_desc, c_lat, c_lng, c_phash, c_img_url, c_created, c_status, c_supporters,
    g_sim, p_sim, d_sim,
    ROUND((0.45 * g_sim + 0.35 * p_sim + 0.20 * d_sim), 2) AS sim_score,
    ROUND(dist_meters, 2)
  FROM scored_candidates
  WHERE (0.45 * g_sim + 0.35 * p_sim + 0.20 * d_sim) >= 0.45
  ORDER BY (0.45 * g_sim + 0.35 * p_sim + 0.20 * d_sim) DESC
  LIMIT 10;
END;
$$;

GRANT EXECUTE ON FUNCTION public.find_duplicate_issues(TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT, DOUBLE PRECISION) TO anon, authenticated;
