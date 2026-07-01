-- The initial migration (20260630064635) already created RLS policies on
-- storage.objects that reference the 'issue-photos', 'repair-photos',
-- 'authority-logos', and 'rep-photos' buckets, but never created the actual
-- bucket rows in storage.buckets. Without a matching bucket row, every
-- upload/download call fails client-side with "Bucket not found", even
-- though the object-level policies are correct.
--
-- issue-photos / repair-photos are read back through short-lived signed
-- URLs generated server-side, so they stay private. authority-logos and
-- rep-photos are shown directly as public <img> URLs across the app, so
-- they're created as public buckets.
insert into storage.buckets (id, name, public)
values
  ('issue-photos', 'issue-photos', false),
  ('repair-photos', 'repair-photos', false),
  ('authority-logos', 'authority-logos', true),
  ('rep-photos', 'rep-photos', true)
on conflict (id) do nothing;
