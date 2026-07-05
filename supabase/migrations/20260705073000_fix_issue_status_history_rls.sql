-- Fixes: "new row violates row-level security policy for table
-- issue_status_history" seen when submitting a new report.
--
-- createIssueFn inserts the very first status-history row for a new issue
-- with status = 'reported' and by_admin = false. The original citizen INSERT
-- policy only allowed status IS NULL (meant for citizen "current photo"
-- updates), so that insert was rejected whenever it ran without full
-- service-role privileges (e.g. if the server's Supabase key is not the true
-- service_role secret). This widens the citizen policy to also allow the
-- initial 'reported' status, while still preventing citizens from setting any
-- other status or from ever setting by_admin = true.

DROP POLICY IF EXISTS "history public insert citizen" ON public.issue_status_history;
CREATE POLICY "history public insert citizen" ON public.issue_status_history FOR INSERT
  WITH CHECK (by_admin = false AND (status IS NULL OR status = 'reported'));
