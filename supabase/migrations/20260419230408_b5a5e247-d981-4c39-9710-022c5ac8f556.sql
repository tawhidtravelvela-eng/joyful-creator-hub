-- ============================================================
-- Phase A: Affiliate Quick-Launch + B2B Studio Gating
-- ============================================================

-- 1) Gate full Studio behind a tenant flag (B2B only)
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS whitelabel_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.tenants.whitelabel_enabled IS
  'When true, this B2B tenant has access to the full White-label Studio (page builder, theme editor, AI generator). Toggled by super-admin after purchase.';

-- 2) Affiliate sites: one row per affiliate, holds template + brand + domain
CREATE TABLE IF NOT EXISTS public.affiliate_sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL UNIQUE REFERENCES public.affiliates(id) ON DELETE CASCADE,

  -- Template selection (modern | classic | bold | minimal)
  template_key text NOT NULL DEFAULT 'modern',

  -- Branding
  site_name text NOT NULL DEFAULT 'My Travel Site',
  tagline text,
  logo_url text,
  favicon_url text,
  primary_color text NOT NULL DEFAULT '#0EA5E9',
  accent_color text,

  -- Hero / homepage copy
  hero_title text,
  hero_subtitle text,
  hero_image_url text,

  -- Which search widgets to show on landing
  show_flights boolean NOT NULL DEFAULT true,
  show_hotels boolean NOT NULL DEFAULT true,
  show_tours boolean NOT NULL DEFAULT true,
  show_transfers boolean NOT NULL DEFAULT false,

  -- Domain
  subdomain text UNIQUE,                -- e.g. "mybrand" → mybrand.travelvela.com
  custom_domain text UNIQUE,            -- e.g. "fly.mybrand.com" (CNAME)
  custom_domain_verified boolean NOT NULL DEFAULT false,

  -- Featured destinations (array of destination ids/slugs to highlight)
  featured_destinations jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Social links (optional, shown in footer)
  social_links jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Lifecycle
  is_published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_sites_affiliate ON public.affiliate_sites(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_sites_subdomain ON public.affiliate_sites(subdomain) WHERE subdomain IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_affiliate_sites_custom_domain ON public.affiliate_sites(custom_domain) WHERE custom_domain IS NOT NULL;

ALTER TABLE public.affiliate_sites ENABLE ROW LEVEL SECURITY;

-- Affiliates manage their own site
CREATE POLICY "Affiliates manage own site"
  ON public.affiliate_sites
  FOR ALL
  TO authenticated
  USING (public.is_affiliate_owner(affiliate_id))
  WITH CHECK (public.is_affiliate_owner(affiliate_id));

-- Admins can manage all sites
CREATE POLICY "Admins manage all affiliate sites"
  ON public.affiliate_sites
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Public can read published sites (needed for the public renderer)
CREATE POLICY "Public can view published affiliate sites"
  ON public.affiliate_sites
  FOR SELECT
  TO anon, authenticated
  USING (is_published = true);

-- Updated_at trigger
CREATE TRIGGER trg_affiliate_sites_updated_at
  BEFORE UPDATE ON public.affiliate_sites
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 3) Affiliate campaigns: named tracking buckets for marketing pushes
CREATE TABLE IF NOT EXISTS public.affiliate_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,

  name text NOT NULL,
  slug text NOT NULL,                          -- url-safe identifier, e.g. "spring-promo"
  description text,
  utm_source text,
  utm_medium text,
  utm_campaign text,

  -- Where the campaign points users
  target_url text,                             -- optional landing override
  target_product_type text,                    -- 'flight' | 'hotel' | 'tour' | 'transfer' | null

  -- Lifecycle
  is_active boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  ends_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (affiliate_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_affiliate_campaigns_affiliate ON public.affiliate_campaigns(affiliate_id);

ALTER TABLE public.affiliate_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Affiliates manage own campaigns"
  ON public.affiliate_campaigns
  FOR ALL
  TO authenticated
  USING (public.is_affiliate_owner(affiliate_id))
  WITH CHECK (public.is_affiliate_owner(affiliate_id));

CREATE POLICY "Admins manage all campaigns"
  ON public.affiliate_campaigns
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_affiliate_campaigns_updated_at
  BEFORE UPDATE ON public.affiliate_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 4) Support tickets (used by B2C end-users on affiliate sites + main app)
-- Kept tenant-agnostic; affiliates never see these.
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number text NOT NULL UNIQUE DEFAULT ('TKT-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(md5(random()::text), 1, 5))),

  -- Source attribution (so we know which site the request came from, but never expose to affiliate)
  source_affiliate_id uuid REFERENCES public.affiliates(id) ON DELETE SET NULL,
  source_tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  source_url text,

  -- Submitter (logged-in user OR anonymous via form)
  user_id uuid,
  guest_name text,
  guest_email text,
  guest_phone text,

  -- Ticket content
  subject text NOT NULL,
  message text NOT NULL,
  category text NOT NULL DEFAULT 'general',     -- general | booking | payment | refund | technical | other
  related_booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,

  -- Workflow
  status text NOT NULL DEFAULT 'open',          -- open | pending | resolved | closed
  priority text NOT NULL DEFAULT 'normal',      -- low | normal | high | urgent
  assigned_to uuid,                             -- staff user id

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON public.support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_source_aff ON public.support_tickets(source_affiliate_id) WHERE source_affiliate_id IS NOT NULL;

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Anyone can submit a ticket (logged-in or guest)
CREATE POLICY "Anyone can create a support ticket"
  ON public.support_tickets
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Logged-in users can view their own tickets
CREATE POLICY "Users view own tickets"
  ON public.support_tickets
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Admins (us) manage everything
CREATE POLICY "Admins manage all tickets"
  ON public.support_tickets
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Note: affiliates have NO policy here, so they can never read tickets.

CREATE TRIGGER trg_support_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 5) Support ticket messages (threaded replies)
CREATE TABLE IF NOT EXISTS public.support_ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_type text NOT NULL,                   -- 'user' | 'staff' | 'system'
  sender_user_id uuid,
  body text NOT NULL,
  is_internal_note boolean NOT NULL DEFAULT false, -- staff-only notes hidden from user
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON public.support_ticket_messages(ticket_id);

ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;

-- Users can view non-internal messages on their own tickets
CREATE POLICY "Users view own ticket messages"
  ON public.support_ticket_messages
  FOR SELECT
  TO authenticated
  USING (
    is_internal_note = false
    AND EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_id AND t.user_id = auth.uid()
    )
  );

-- Users can reply on their own tickets
CREATE POLICY "Users reply to own tickets"
  ON public.support_ticket_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_type = 'user'
    AND is_internal_note = false
    AND EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_id AND t.user_id = auth.uid()
    )
  );

-- Admins manage all messages
CREATE POLICY "Admins manage all ticket messages"
  ON public.support_ticket_messages
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));