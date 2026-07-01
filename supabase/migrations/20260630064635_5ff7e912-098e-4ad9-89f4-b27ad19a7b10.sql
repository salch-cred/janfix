
CREATE POLICY "storage public read" ON storage.objects FOR SELECT
  USING (bucket_id IN ('issue-photos','repair-photos','authority-logos','rep-photos'));

CREATE POLICY "storage public insert issues" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'issue-photos');

CREATE POLICY "storage admin insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('repair-photos','authority-logos','rep-photos') AND public.is_admin());

CREATE POLICY "storage admin update" ON storage.objects FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "storage admin delete" ON storage.objects FOR DELETE TO authenticated
  USING (public.is_admin());
