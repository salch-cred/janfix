-- ============================================================================
-- 1. AUTHORITY STATS VIEW
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
-- 2. WARD STATS VIEW
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
-- 3. REPRESENTATIVE STATS VIEW
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
-- 3b. ANALYTICS VIEW
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
-- 4. HEAT SCORING ALGORITHM
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

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trg_issue_self_heat_score ON public.issues;
DROP TRIGGER IF EXISTS trg_issue_insert_heat_score ON public.issues;
DROP TRIGGER IF EXISTS trg_heat_score_supporters ON public.issue_supporters;
DROP TRIGGER IF EXISTS trg_heat_score_votes ON public.issue_votes;
DROP TRIGGER IF EXISTS trg_heat_score_comments ON public.issue_comments;
DROP TRIGGER IF EXISTS trg_heat_score_watchers ON public.issue_watchers;

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

-- Backfill all existing issues
UPDATE public.issues SET heat_score = public.compute_heat_score(id);

-- ============================================================================
-- 5. DEVICE AUTO-UPSERT ON ISSUE INSERT
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
-- 6. ATOMIC ISSUE VOTING & STATUS TRANSITION RPC
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
-- 7. ATOMIC DUPLICATE DETECTION SIMILARITY SCORING RPC
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
