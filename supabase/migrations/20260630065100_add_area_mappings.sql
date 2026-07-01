
CREATE TABLE IF NOT EXISTS public.area_mappings (
  id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  keyword TEXT NOT NULL UNIQUE,
  ward_id INT REFERENCES public.wards(id) ON DELETE SET NULL,
  constituency TEXT,
  city TEXT,
  priority INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS area_mappings_keyword_idx ON public.area_mappings (keyword);
GRANT SELECT ON public.area_mappings TO anon, authenticated;
GRANT ALL ON public.area_mappings TO service_role;
ALTER TABLE public.area_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "area_mappings public read" ON public.area_mappings FOR SELECT USING (true);

-- Seed: all 60 ward names/areas map to their own ward + constituency
DO $$
DECLARE
  _ward RECORD;
BEGIN
  FOR _ward IN
    SELECT w.id, w.number, w.name, w.area, w.city,
           CASE
             WHEN w.number <= 30 THEN 'Mangaluru City South'
             ELSE 'Mangaluru City North'
           END AS constituency
    FROM public.wards w
    ORDER BY w.number
  LOOP
    -- by ward name
    INSERT INTO public.area_mappings (keyword, ward_id, constituency, city, priority)
    VALUES (lower(_ward.name), _ward.id, _ward.constituency, _ward.city, 10)
    ON CONFLICT (keyword) DO NOTHING;
    -- by area name (if different from ward name)
    IF lower(_ward.area) != lower(_ward.name) THEN
      INSERT INTO public.area_mappings (keyword, ward_id, constituency, city, priority)
      VALUES (lower(_ward.area), _ward.id, _ward.constituency, _ward.city, 10)
      ON CONFLICT (keyword) DO NOTHING;
    END IF;
  END LOOP;
END $$;

-- Extra known locality mappings for Mangaluru (not already covered by ward names)
INSERT INTO public.area_mappings (keyword, ward_id, constituency, city, priority) VALUES
  ('valachil',       (SELECT id FROM public.wards WHERE name = 'Deralakatte'),  'Mangaluru City South', 'Mangaluru', 15),
  ('bangalagudde',   (SELECT id FROM public.wards WHERE name = 'Deralakatte'),  'Mangaluru City South', 'Mangaluru', 15),
  ('thokkotu',       (SELECT id FROM public.wards WHERE name = 'Thokkottu'),    'Mangaluru City South', 'Mangaluru', 15),
  ('kotekar',        (SELECT id FROM public.wards WHERE name = 'Kotekar'),      'Mangaluru City South', 'Mangaluru', 15),
  ('ullal',          (SELECT id FROM public.wards WHERE name = 'Ullal'),        'Mangaluru City South', 'Mangaluru', 15),
  ('deralakatte',    (SELECT id FROM public.wards WHERE name = 'Deralakatte'),  'Mangaluru City South', 'Mangaluru', 15),
  ('shirthady',      (SELECT id FROM public.wards WHERE name = 'Shirthady'),    'Mangaluru City South', 'Mangaluru', 15),
  ('hosabettu',      (SELECT id FROM public.wards WHERE name = 'Hosabettu'),    'Mangaluru City South', 'Mangaluru', 15),
  ('mudushedde',     (SELECT id FROM public.wards WHERE name = 'Mudushedde'),   'Mangaluru City South', 'Mangaluru', 15),
  ('krishnapur',     (SELECT id FROM public.wards WHERE name = 'Krishnapur'),   'Mangaluru City South', 'Mangaluru', 15),
  ('surathkal',      (SELECT id FROM public.wards WHERE name = 'Surathkal'),    'Mangaluru City North', 'Mangaluru', 15),
  ('panambur',       (SELECT id FROM public.wards WHERE name = 'Panambur'),     'Mangaluru City North', 'Mangaluru', 15),
  ('baikampady',     (SELECT id FROM public.wards WHERE name = 'Baikampady'),   'Mangaluru City North', 'Mangaluru', 15),
  ('tannirbavi',     (SELECT id FROM public.wards WHERE name = 'Tannirbavi'),   'Mangaluru City North', 'Mangaluru', 15),
  ('katipalla',      (SELECT id FROM public.wards WHERE name = 'Katipalla'),    'Mangaluru City North', 'Mangaluru', 15),
  ('kavoor',         (SELECT id FROM public.wards WHERE name = 'Kavoor'),       'Mangaluru City North', 'Mangaluru', 15),
  ('vamanjoor',      (SELECT id FROM public.wards WHERE name = 'Vamanjoor'),    'Mangaluru City North', 'Mangaluru', 15),
  ('adyar',          (SELECT id FROM public.wards WHERE name = 'Adyar'),        'Mangaluru City North', 'Mangaluru', 15),
  ('kinnigoli',      (SELECT id FROM public.wards WHERE name = 'Kinnigoli'),    'Mangaluru City North', 'Mangaluru', 15),
  ('gantalkatte',    (SELECT id FROM public.wards WHERE name = 'Gantalkatte'),  'Mangaluru City North', 'Mangaluru', 15),
  ('kottara',        (SELECT id FROM public.wards WHERE name = 'Kottara'),      'Mangaluru City North', 'Mangaluru', 15),
  ('kunjathbail',    (SELECT id FROM public.wards WHERE name = 'Kunjathbail'),  'Mangaluru City North', 'Mangaluru', 15),
  ('pumpwell',       (SELECT id FROM public.wards WHERE name = 'Pumpwell'),     'Mangaluru City South', 'Mangaluru', 15),
  ('kankanady',      (SELECT id FROM public.wards WHERE name = 'Kankanady'),    'Mangaluru City South', 'Mangaluru', 15),
  ('bendoor',        (SELECT id FROM public.wards WHERE name = 'Bendoor'),      'Mangaluru City South', 'Mangaluru', 15),
  ('jeppu',          (SELECT id FROM public.wards WHERE name = 'Jeppu'),        'Mangaluru City South', 'Mangaluru', 15),
  ('bolar',          (SELECT id FROM public.wards WHERE name = 'Bolar'),        'Mangaluru City South', 'Mangaluru', 15),
  ('kudroli',        (SELECT id FROM public.wards WHERE name = 'Kudroli'),      'Mangaluru City South', 'Mangaluru', 15),
  ('mangaladevi',    (SELECT id FROM public.wards WHERE name = 'Mangaladevi'),  'Mangaluru City South', 'Mangaluru', 15),
  ('urwa',           (SELECT id FROM public.wards WHERE name = 'Urwa'),         'Mangaluru City South', 'Mangaluru', 15),
  ('padil',          (SELECT id FROM public.wards WHERE name = 'Padil'),        'Mangaluru City South', 'Mangaluru', 15),
  ('kulur',          (SELECT id FROM public.wards WHERE name = 'Kulur'),        'Mangaluru City South', 'Mangaluru', 15),
  ('kadri',          (SELECT id FROM public.wards WHERE name = 'Kadri'),        'Mangaluru City South', 'Mangaluru', 15),
  ('kadri hills',    (SELECT id FROM public.wards WHERE name = 'Kadri Hills'),  'Mangaluru City South', 'Mangaluru', 15),
  ('kapikad',        (SELECT id FROM public.wards WHERE name = 'Kapikad'),      'Mangaluru City South', 'Mangaluru', 15),
  ('thumbay',        (SELECT id FROM public.wards WHERE name = 'Thumbay'),      'Mangaluru City South', 'Mangaluru', 15),
  ('shamboor',       (SELECT id FROM public.wards WHERE name = 'Shamboor'),     'Mangaluru City North', 'Mangaluru', 15)
ON CONFLICT (keyword) DO NOTHING;

-- Rural DK taluk/area mappings → no ward, but constituency + city = NULL for ZP jurisdiction
INSERT INTO public.area_mappings (keyword, ward_id, constituency, city, priority) VALUES
  ('bantwal',     NULL, 'Bantwal',    NULL, 5),
  ('puttur',      NULL, 'Puttur',     NULL, 5),
  ('sullia',      NULL, 'Sullia (SC)',NULL, 5),
  ('belthangady', NULL, 'Belthangady',NULL, 5),
  ('moodabidri',  NULL, 'Moodabidri', NULL, 5),
  ('kinnigoli village', NULL, 'Mangaluru City North', NULL, 5),
  ('mulki',       NULL, 'Mangaluru',  NULL, 5)
ON CONFLICT (keyword) DO NOTHING;
