-- Fixes: "new row violates row-level security policy for table
-- issue_status_history" seen when submitting a new report (and would also
-- have hit voting).
--
-- createIssueFn inserts the first status-history row for a new issue with
-- status = 'reported', by_admin = false. voteIssueFn can also auto-flip an
-- issue's status (e.g. to 'community_verified' / 'community_confirmed') with
-- by_admin = false. The original citizen INSERT policy only allowed
-- status IS NULL (meant for citizen "current photo" updates), so any of
-- these citizen-triggered inserts were rejected whenever they ran without
-- full service-role privileges (e.g. if the server's Supabase key is not the
-- true service_role secret). This widens the citizen policy to allow any
-- status value as long as by_admin stays false, so citizens can never mark
-- an update as coming from the authority, but the app's own status logic
-- (report submission, vote-triggered flips, etc.) is never blocked.

DROP POLICY IF EXISTS "history public insert citizen" ON public.issue_status_history;
CREATE POLICY "history public insert citizen" ON public.issue_status_history FOR INSERT
  WITH CHECK (by_admin = false);
