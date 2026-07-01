
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
