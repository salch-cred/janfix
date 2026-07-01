-- The seed data auto-generated one placeholder "Corporator, Ward N (...)"
-- representative row per ward (60 total). These are job-role placeholders,
-- not real named individuals, and should not appear anywhere in the app
-- (representatives list, leaderboard, issue "local representative" cards).
--
-- The earlier attempt in update_representatives.sql used
--   DELETE FROM public.representatives WHERE role = 'corporator';
-- which matched 0 rows because the seeded role is stored as 'Corporator'
-- (capital C). This migration is case-insensitive and also clears any
-- foreign-key references first so the delete does not fail.

-- 1. Detach any issues currently assigned to a corporator placeholder.
UPDATE public.issues
SET assigned_representative_id = NULL
WHERE assigned_representative_id IN (
  SELECT id FROM public.representatives WHERE role ILIKE 'corporator'
);

-- 2. Detach any assignment rules referencing a corporator placeholder.
UPDATE public.assignment_rules
SET representative_id = NULL
WHERE representative_id IN (
  SELECT id FROM public.representatives WHERE role ILIKE 'corporator'
);

-- 3. Remove the placeholder representative rows for good.
DELETE FROM public.representatives WHERE role ILIKE 'corporator';
