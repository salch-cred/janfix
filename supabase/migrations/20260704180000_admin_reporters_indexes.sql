-- Supporting indexes for the new admin "Reporters" page and analytics
-- (adminListDevicesFn, adminAnalyticsDetailFn in src/lib/admin.functions.ts).
--
-- Postgres only auto-indexes the leftmost column of a composite primary key.
-- issue_votes, issue_thanks, and issue_supporters all have PRIMARY KEY
-- (issue_id, device_id), so lookups filtered ONLY by device_id (as the
-- Reporters page does, to aggregate activity per device) would otherwise
-- require a full table scan. issues.device_id and devices.last_seen were
-- also never indexed. These indexes keep the Reporters page and dashboard
-- fast as report volume grows.

CREATE INDEX IF NOT EXISTS issues_device_idx ON public.issues(device_id);
CREATE INDEX IF NOT EXISTS issue_votes_device_idx ON public.issue_votes(device_id);
CREATE INDEX IF NOT EXISTS issue_thanks_device_idx ON public.issue_thanks(device_id);
CREATE INDEX IF NOT EXISTS issue_supporters_device_idx ON public.issue_supporters(device_id);
CREATE INDEX IF NOT EXISTS issue_comments_device_idx ON public.issue_comments(device_id);

-- Reporters page sorts by most recently active device.
CREATE INDEX IF NOT EXISTS devices_last_seen_idx ON public.devices(last_seen DESC);
