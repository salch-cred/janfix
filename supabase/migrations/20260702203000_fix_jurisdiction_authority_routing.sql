-- Corrects a systemic jurisdiction-routing bug and applies findings from the
-- "Decoding Civic Responsibility in Dakshina Kannada" governance research
-- document supplied by the team.
--
-- BUG FOUND: public.assignment_rules seeded one ward-agnostic "generic" row
-- per category (see 20260630065000_seed_data.sql). src/lib/resolver.ts's
-- Layer 4 always prefers that generic row's authority over the scope-aware
-- public.jurisdiction_rules row: `genericRule?.authority_id ?? jurisdictionRule?.authority_id`.
-- Because every category had a generic row, the mcc/rural/state_highway/
-- national_highway distinction that jurisdiction_rules exists to provide was
-- never actually applied to authority assignment -- e.g. rural potholes were
-- always sent to MCC Roads instead of the Zilla/Grama Panchayat, and
-- highway potholes were never routed to PWD/NHAI.
--
-- FIX: deactivate the ward-agnostic generic rules so Layer 4 correctly falls
-- through to the scope-aware jurisdiction_rules engine (this does not touch
-- any ward-specific rule, since none exist yet).
--
-- DOC FINDINGS: the governance research document explicitly resolves the
-- three cases the original migration flagged confidence='low' pending
-- confirmation:
--   * Streetlights: citizen reports and legal ownership sit with MCC: MESCOM
--     only maintains fixtures "under agreement with MCC"; report_to = MCC.
--   * Sewage: MCC (Drainage Division / Engineering) is the named civic-amenity
--     owner for sewerage within municipal limits, not KUWS&DB.
--   * Water leakage: MCC is the named civic-amenity owner for piped, treated
--     municipal water supply within municipal limits, not KUWS&DB.
--   * Rural streetlights are legally owned by the Grama Panchayat (proxied
--     here, as elsewhere in this schema, by Zilla Panchayat Dakshina Kannada),
--     not MESCOM.

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
  _hwy_regex    TEXT := '(national\s*highway|\mnh[\s-]?\d+)';
  _shwy_regex   TEXT := '(state\s*highway|\msh[\s-]?\d+)';
BEGIN
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

  -- ==========================================================================
  -- STEP A: turn off the ward-agnostic generic rules so the scope-aware
  -- jurisdiction_rules overlay (mcc / rural / state_highway / national_highway)
  -- actually governs authority assignment, as the schema/resolver intended.
  -- ==========================================================================
  UPDATE public.assignment_rules
  SET active = false
  WHERE ward_id IS NULL AND active = true;

  -- ==========================================================================
  -- STEP B: correct the jurisdiction_rules rows per the governance research doc
  -- ==========================================================================
  UPDATE public.jurisdiction_rules
  SET authority_id = _mcc_engg, confidence = 'high',
      notes = 'Confirmed by governance research doc: MCC is legal owner and citizen report point for streetlights; MESCOM only maintains fixtures under agreement with MCC.'
  WHERE category_id = _cat_street AND scope_type = 'mcc' AND taluk_id IS NULL;

  UPDATE public.jurisdiction_rules
  SET authority_id = _zp_dk, confidence = 'medium',
      notes = 'Rural streetlights are legally owned by the Grama Panchayat per governance research doc; Zilla Panchayat DK used as the panchayat-tier proxy authority in this schema.'
  WHERE category_id = _cat_street AND scope_type = 'rural' AND taluk_id IS NULL;

  UPDATE public.jurisdiction_rules
  SET authority_id = _mcc_engg, confidence = 'high',
      notes = 'Confirmed by governance research doc: MCC (Drainage Division/Engineering) is the named civic-amenity owner for sewerage within municipal limits, not KUWS&DB.'
  WHERE category_id = _cat_sewage AND scope_type = 'mcc' AND taluk_id IS NULL;

  UPDATE public.jurisdiction_rules
  SET authority_id = _mcc_engg, confidence = 'high',
      notes = 'Confirmed by governance research doc: MCC is the named civic-amenity owner for piped, treated municipal water supply within municipal limits, not KUWS&DB.'
  WHERE category_id = _cat_water AND scope_type = 'mcc' AND taluk_id IS NULL;

  -- ==========================================================================
  -- STEP C: repair already-created issues that were misrouted by the bug in
  -- Step A (only rows still pointing at the old/incorrect authority, so any
  -- issue an admin already manually reassigned is left untouched).
  -- ==========================================================================

  -- "Others" is scope 'any' -> always DK District Administration, not MCC.
  UPDATE public.issues
  SET assigned_authority_id = _dk_admin, jurisdiction_confidence = 'medium', needs_review = false,
      assignment_reason = COALESCE(assignment_reason, '') || ' [corrected: DK District Administration per jurisdiction fix]'
  WHERE category_id = _cat_others AND assigned_authority_id = _mcc_gen;

  -- Highway-scope repair for pothole/road-damage (ward_id IS NULL = no MCC ward matched).
  UPDATE public.issues
  SET assigned_authority_id = _nhai, jurisdiction_confidence = 'medium', needs_review = false,
      assignment_reason = COALESCE(assignment_reason, '') || ' [corrected: NHAI per jurisdiction fix]'
  WHERE category_id IN (_cat_pothole, _cat_road) AND ward_id IS NULL AND assigned_authority_id = _mcc_roads
    AND (COALESCE(address,'') || ' ' || COALESCE(area,'') || ' ' || COALESCE(locality,'')) ~* _hwy_regex;

  UPDATE public.issues
  SET assigned_authority_id = _pwd, jurisdiction_confidence = 'medium', needs_review = false,
      assignment_reason = COALESCE(assignment_reason, '') || ' [corrected: PWD Karnataka per jurisdiction fix]'
  WHERE category_id IN (_cat_pothole, _cat_road) AND ward_id IS NULL AND assigned_authority_id = _mcc_roads
    AND (COALESCE(address,'') || ' ' || COALESCE(area,'') || ' ' || COALESCE(locality,'')) ~* _shwy_regex
    AND (COALESCE(address,'') || ' ' || COALESCE(area,'') || ' ' || COALESCE(locality,'')) !~* _hwy_regex;

  -- Rural fallback repair: issues with no resolved ward that were wrongly sent
  -- to an MCC department instead of the Zilla/Grama Panchayat proxy.
  UPDATE public.issues
  SET assigned_authority_id = _zp_dk, jurisdiction_confidence = 'medium', needs_review = false,
      assignment_reason = COALESCE(assignment_reason, '') || ' [corrected: Zilla Panchayat DK per jurisdiction fix]'
  WHERE ward_id IS NULL
    AND (
      (category_id IN (_cat_pothole, _cat_road) AND assigned_authority_id = _mcc_roads
        AND (COALESCE(address,'') || ' ' || COALESCE(area,'') || ' ' || COALESCE(locality,'')) !~* _hwy_regex
        AND (COALESCE(address,'') || ' ' || COALESCE(area,'') || ' ' || COALESCE(locality,'')) !~* _shwy_regex)
      OR (category_id = _cat_footpath AND assigned_authority_id = _mcc_engg)
      OR (category_id = _cat_drain AND assigned_authority_id = _mcc_engg)
      OR (category_id = _cat_garbage AND assigned_authority_id = _mcc_health)
      OR (category_id = _cat_dumping AND assigned_authority_id = _mcc_health)
      OR (category_id = _cat_tree AND assigned_authority_id = _mcc_hort)
      OR (category_id = _cat_toilet AND assigned_authority_id = _mcc_gen)
      OR (category_id = _cat_sewage AND assigned_authority_id = _kuwsdb)
      OR (category_id = _cat_water AND assigned_authority_id = _kuwsdb)
      OR (category_id = _cat_street AND assigned_authority_id = _mescom)
    );

  -- MCC-scope repair for the three doc-confirmed categories: issues that DID
  -- resolve to an MCC ward but were still routed to the utility/agency instead
  -- of MCC itself.
  UPDATE public.issues
  SET assigned_authority_id = _mcc_engg, jurisdiction_confidence = 'high', needs_review = false,
      assignment_reason = COALESCE(assignment_reason, '') || ' [corrected: MCC Engineering per governance research]'
  WHERE ward_id IS NOT NULL
    AND (
      (category_id IN (_cat_sewage, _cat_water) AND assigned_authority_id = _kuwsdb)
      OR (category_id = _cat_street AND assigned_authority_id = _mescom)
    );
END $$;
