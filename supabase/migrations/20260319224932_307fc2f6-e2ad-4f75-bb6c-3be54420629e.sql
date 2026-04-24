-- 1. CRITICAL: Bank accounts - restrict to authenticated users only
DROP POLICY IF EXISTS "Public read active bank_accounts" ON public.bank_accounts;
CREATE POLICY "Authenticated read active bank_accounts"
  ON public.bank_accounts FOR SELECT TO authenticated
  USING (is_active = true);

-- 2. Blog posts - only show published posts publicly
DROP POLICY IF EXISTS "Public read blog_posts" ON public.blog_posts;
CREATE POLICY "Public read published blog_posts"
  ON public.blog_posts FOR SELECT TO anon, authenticated
  USING (status = 'published' OR has_role(auth.uid(), 'admin'::app_role));

-- 3. Provider groups - restrict to authenticated only
DROP POLICY IF EXISTS "Public read provider_groups" ON public.provider_groups;
CREATE POLICY "Authenticated read provider_groups"
  ON public.provider_groups FOR SELECT TO authenticated
  USING (true);

-- 4. Whitelabel sites - restrict anon access
DROP POLICY IF EXISTS "Public read active whitelabel sites" ON public.whitelabel_sites;
CREATE POLICY "Authenticated read active whitelabel sites"
  ON public.whitelabel_sites FOR SELECT TO authenticated
  USING (is_active = true AND status = 'approved');
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'whitelabel_sites' AND policyname = 'Service read whitelabel_sites') THEN
    CREATE POLICY "Service read whitelabel_sites"
      ON public.whitelabel_sites FOR SELECT TO service_role
      USING (true);
  END IF;
END $$;

-- 5. message_dedup - RLS enabled but no policies
CREATE POLICY "Service manage message_dedup"
  ON public.message_dedup FOR ALL TO service_role
  USING (true);