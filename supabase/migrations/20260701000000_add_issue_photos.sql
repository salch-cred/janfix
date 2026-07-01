-- Optional additional photos attached to an issue report (beyond the required primary photo).
CREATE TABLE public.issue_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  path TEXT,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX issue_photos_issue_idx ON public.issue_photos(issue_id, position);

GRANT SELECT, INSERT ON public.issue_photos TO anon, authenticated;
GRANT ALL ON public.issue_photos TO service_role;
ALTER TABLE public.issue_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "issue photos public read" ON public.issue_photos FOR SELECT USING (true);
CREATE POLICY "issue photos public insert" ON public.issue_photos FOR INSERT WITH CHECK (true);
