
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
