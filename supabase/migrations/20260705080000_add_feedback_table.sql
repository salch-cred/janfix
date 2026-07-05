CREATE TABLE public.feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  email TEXT,
  message TEXT NOT NULL,
  device_id TEXT,
  page_url TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX feedback_created_idx ON public.feedback(created_at DESC);

GRANT INSERT ON public.feedback TO anon, authenticated;
GRANT ALL ON public.feedback TO service_role;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feedback public insert" ON public.feedback FOR INSERT WITH CHECK (true);
CREATE POLICY "feedback admin read" ON public.feedback FOR SELECT USING (public.is_admin());
CREATE POLICY "feedback admin update" ON public.feedback FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "feedback admin delete" ON public.feedback FOR DELETE USING (public.is_admin());
