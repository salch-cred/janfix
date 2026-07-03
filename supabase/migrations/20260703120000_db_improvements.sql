-- ============================================================================
-- 1. TRIGGERS FOR AUTO-UPDATING COUNTERS
-- ============================================================================

-- A. Auto-update supporters_count on issues table
CREATE OR REPLACE FUNCTION public.tg_update_issue_supporters_count()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.issues 
    SET supporters_count = supporters_count + 1 
    WHERE id = NEW.issue_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.issues 
    SET supporters_count = GREATEST(0, supporters_count - 1) 
    WHERE id = OLD.issue_id;
  END IF;
  RETURN NULL;
END $$;

CREATE OR REPLACE TRIGGER trg_issue_supporters_count
AFTER INSERT OR DELETE ON public.issue_supporters
FOR EACH ROW EXECUTE FUNCTION public.tg_update_issue_supporters_count();


-- B. Auto-update thanked_count on issues table
CREATE OR REPLACE FUNCTION public.tg_update_issue_thanks_count()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.issues 
    SET thanked_count = thanked_count + 1 
    WHERE id = NEW.issue_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.issues 
    SET thanked_count = GREATEST(0, thanked_count - 1) 
    WHERE id = OLD.issue_id;
  END IF;
  RETURN NULL;
END $$;

CREATE OR REPLACE TRIGGER trg_issue_thanks_count
AFTER INSERT OR DELETE ON public.issue_thanks
FOR EACH ROW EXECUTE FUNCTION public.tg_update_issue_thanks_count();


-- C. Atomic view counter increment function
CREATE OR REPLACE FUNCTION public.increment_issue_views(issue_id UUID)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  UPDATE public.issues SET views = views + 1 WHERE id = issue_id;
END;
$$;


-- ============================================================================
-- 2. SECURITY & RLS POLICY ENHANCEMENTS
-- ============================================================================

-- A. Restrict issue_watchers read access (Prevent email/phone leak of watchers)
DROP POLICY IF EXISTS "watchers read" ON public.issue_watchers;
CREATE POLICY "watchers read" ON public.issue_watchers FOR SELECT
  USING (
    public.is_admin() 
    OR device_id = COALESCE(
      current_setting('request.headers', true)::json->>'x-device-id', 
      device_id
    )
  );

-- B. Restrict devices public updates
DROP POLICY IF EXISTS "devices public update" ON public.devices;
CREATE POLICY "devices public update" ON public.devices FOR UPDATE
  USING (
    device_id = COALESCE(
      current_setting('request.headers', true)::json->>'x-device-id',
      device_id
    )
  );

-- C. Restrict votes public updates
DROP POLICY IF EXISTS "votes public update" ON public.issue_votes;
CREATE POLICY "votes public update" ON public.issue_votes FOR UPDATE
  USING (
    device_id = COALESCE(
      current_setting('request.headers', true)::json->>'x-device-id',
      device_id
    )
  );

-- D. Add RLS policy for DELETE on issue_votes (allows voters to delete/retract votes)
DROP POLICY IF EXISTS "votes public delete" ON public.issue_votes;
CREATE POLICY "votes public delete" ON public.issue_votes FOR DELETE
  USING (
    device_id = COALESCE(
      current_setting('request.headers', true)::json->>'x-device-id',
      device_id
    )
  );


-- ============================================================================
-- 3. INDEX OPTIMIZATIONS FOR FOREIGN KEYS & PERFORMANCE
-- ============================================================================
CREATE INDEX IF NOT EXISTS representatives_authority_idx ON public.representatives(authority_id);
CREATE INDEX IF NOT EXISTS representatives_ward_idx ON public.representatives(ward_id);

CREATE INDEX IF NOT EXISTS rules_category_idx ON public.assignment_rules(category_id);
CREATE INDEX IF NOT EXISTS rules_ward_idx ON public.assignment_rules(ward_id);
CREATE INDEX IF NOT EXISTS rules_authority_idx ON public.assignment_rules(authority_id);
CREATE INDEX IF NOT EXISTS rules_representative_idx ON public.assignment_rules(representative_id);

CREATE INDEX IF NOT EXISTS issues_duplicate_idx ON public.issues(duplicate_of_id) WHERE duplicate_of_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS issues_assigned_authority_idx ON public.issues(assigned_authority_id);
CREATE INDEX IF NOT EXISTS issues_assigned_representative_idx ON public.issues(assigned_representative_id);

CREATE INDEX IF NOT EXISTS official_posted_by_idx ON public.issue_official_updates(posted_by);
