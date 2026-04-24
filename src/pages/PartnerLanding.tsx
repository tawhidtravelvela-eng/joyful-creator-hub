import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import Layout from "@/components/site/hybrid/SkinAwareLayout";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/contexts/AuthContext";
import { useTenantSiteTracking } from "@/hooks/useTenantSiteTracking";
import { useSiteBranding } from "@/hooks/useSiteBranding";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Loader2,
  Building2,
  CheckCircle2,
  ShieldCheck,
  Wallet,
  Globe2,
  Sparkles,
  ArrowRight,
  Plane,
  Hotel,
  MapPin,
  Briefcase,
  Headphones,
} from "lucide-react";
import { toast } from "sonner";
import NotFound from "@/pages/NotFound";

/**
 * Hybrid-skin partner landing page (e.g. /partners).
 *
 * Available only on tenant domains where:
 *   - tenant is active
 *   - the route slug matches `tenants.b2b_landing_slug` (default "partners")
 *
 * Falls back to NotFound on the platform domain or a slug mismatch.
 * Subdomain routing (partner.customdomain.com) is intentionally deferred
 * — tracked as a follow-up; see TenantHome / useTenant.ts.
 */

const applySchema = z.object({
  full_name: z.string().trim().min(2, "Please enter your full name").max(100),
  email: z.string().trim().email("Enter a valid email").max(255),
  company_name: z.string().trim().min(2, "Company name is required").max(150),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  message: z.string().trim().max(1000).optional().or(z.literal("")),
});

const DEFAULT_HEADLINE = "Grow your travel business with us";
const DEFAULT_SUBHEADLINE =
  "Get wholesale fares, branded booking pages, and a wallet-funded settlement account. Apply once — start selling in days.";
const DEFAULT_BULLETS = [
  { icon: ShieldCheck, title: "Wholesale rates", body: "Negotiated airline & hotel pricing across our supplier network." },
  { icon: Globe2, title: "Branded booking pages", body: "White-labelled flights, hotels, and tours under your brand." },
  { icon: Wallet, title: "Wallet & commissions", body: "Pre-funded wallet, transparent ledger, and instant commission credit." },
];

const STATS = [
  { label: "Supplier integrations", value: "40+", icon: Globe2 },
  { label: "Bookable destinations", value: "12k", icon: MapPin },
  { label: "Avg. payout", value: "T+2", icon: Wallet },
  { label: "Partner support", value: "24/7", icon: Headphones },
];

const STEPS = [
  {
    n: "01",
    title: "Apply in minutes",
    body: "Submit your agency details. Our team reviews and approves most applications within 1–2 business days.",
  },
  {
    n: "02",
    title: "Fund your wallet",
    body: "Top up your settlement wallet via bank transfer. Inventory unlocks the moment funds are credited.",
  },
  {
    n: "03",
    title: "Sell under your brand",
    body: "Use your white-labelled portal or our agent dashboard to ticket flights, stays, transfers, and tours.",
  },
];

const PRODUCT_RAILS = [
  { icon: Plane, title: "Flights", body: "GDS + LCC content with negotiated fares, hold/ticket flows, and PNR management." },
  { icon: Hotel, title: "Stays", body: "1M+ properties with live availability, instant confirmation, and post-booking support." },
  { icon: MapPin, title: "Experiences", body: "Tours, attractions, and activities with skip-the-line tickets and instant vouchers." },
  { icon: Briefcase, title: "Transfers", body: "Door-to-door ground transport — sedans, SUVs, and vans across global cities." },
];

const FAQS = [
  {
    q: "How long does approval take?",
    a: "Most agencies are approved within 1–2 business days. We may ask for a trade licence or proof of operating history before unlocking inventory.",
  },
  {
    q: "Is there a setup or monthly fee?",
    a: "No setup fee. The base partner plan is free; our white-label and custom-domain plans are billed monthly with a free trial.",
  },
  {
    q: "How do commissions work?",
    a: "Commissions are credited to your wallet the moment a booking ticketed. You can withdraw to your bank or reuse balance for new bookings.",
  },
  {
    q: "Can I use my own brand?",
    a: "Yes — every partner gets a branded booking portal. Upgrade to bring your own domain, custom CSS, and remove platform branding.",
  },
];

export default function PartnerLanding({ slug = "partners" }: { slug?: string }) {
  const { tenant, loading: tenantLoading } = useTenant();
  const { branding } = useSiteBranding();
  const { user } = useAuth();
  const navigate = useNavigate();
  useTenantSiteTracking(tenant?.id || null);

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    company_name: "",
    phone: "",
    message: "",
  });

  // Prefill email from logged-in user
  useEffect(() => {
    if (user?.email) setForm((p) => (p.email ? p : { ...p, email: user.email! }));
  }, [user]);

  if (tenantLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  // Page is tenant-scoped only. On the platform domain or slug mismatch → 404.
  if (!tenant) return <NotFound />;
  const expectedSlug = tenant.b2b_landing_slug || "partners";
  if (slug !== expectedSlug) return <NotFound />;

  // Per-tenant content overrides live under settings.partner_landing
  const content = (tenant.settings?.partner_landing as Record<string, any>) || {};
  const headline = (content.headline as string) || DEFAULT_HEADLINE;
  const subheadline = (content.subheadline as string) || DEFAULT_SUBHEADLINE;
  const heroImageUrl = (content.hero_image_url as string) || "";
  // The Hybrid header already renders the logo + agency name.
  // Use the resolved branding site_name (Studio → Brand → Site name)
  // instead of `tenant.name` which is the internal tenant record name
  // (often the founder's first name).
  const agencyName = branding.site_name || tenant.name;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = applySchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || "Please check your details");
      return;
    }
    setSubmitting(true);
    try {
      const justification = [
        parsed.data.full_name && `Name: ${parsed.data.full_name}`,
        parsed.data.phone && `Phone: ${parsed.data.phone}`,
        parsed.data.email && `Email: ${parsed.data.email}`,
        parsed.data.message && `Notes: ${parsed.data.message}`,
      ]
        .filter(Boolean)
        .join("\n");

      const insertPayload: Record<string, any> = {
        request_type: "whitelabel",
        company_name: parsed.data.company_name,
        domain_requested: tenant.domain,
        business_justification: justification,
        tenant_id: tenant.id,
      };
      // Attach user_id only when authenticated; the column is NOT NULL,
      // so unauthenticated leads can still be captured by routing the
      // request through a signed-in admin contact path in a later pass.
      if (user?.id) insertPayload.user_id = user.id;

      const { error } = await (supabase as any)
        .from("b2b_access_requests")
        .insert(insertPayload);

      if (error) {
        // Most common case for unauthenticated visitors — guide them to sign up first.
        if (!user) {
          toast.error("Please sign in or create an account to submit your application.");
          navigate("/auth", { state: { partnerApply: parsed.data } });
          return;
        }
        throw error;
      }

      setSubmitted(true);
      toast.success("Application received — our team will be in touch shortly.");
    } catch (err: any) {
      toast.error(err?.message || "Could not submit your application. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout>
      <main className="bg-background">
        {/* Hero — editorial split with ambient glow + dotted grid */}
        <section className="relative overflow-hidden border-b border-border/60">
          {/* Ambient layers */}
          <div className="pointer-events-none absolute inset-0">
            <div
              className="absolute inset-0 opacity-[0.05]"
              style={{
                backgroundImage:
                  "radial-gradient(hsl(var(--foreground)) 1px, transparent 1px)",
                backgroundSize: "32px 32px",
              }}
            />
            <div className="absolute -top-40 -right-32 w-[520px] h-[520px] rounded-full bg-[hsl(var(--primary)/0.12)] blur-[120px]" />
            <div className="absolute top-[40%] -left-40 w-[460px] h-[460px] rounded-full bg-[hsl(var(--accent)/0.10)] blur-[120px]" />
          </div>

          <div className="container mx-auto px-4 py-20 md:py-28 relative">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              <div className="lg:col-span-7 space-y-6">
                {/* Eyebrow tag */}
                <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                  <span className="w-6 h-px bg-primary/60" />
                  <Sparkles className="w-3.5 h-3.5" />
                  {agencyName} · Partner Programme
                </div>
                <h1
                  className="text-4xl md:text-6xl font-semibold text-foreground leading-[1.05] tracking-tight"
                  style={{ fontFamily: "var(--font-heading, inherit)" }}
                >
                  {headline}
                </h1>
                <p className="text-lg md:text-xl text-muted-foreground max-w-xl leading-relaxed">{subheadline}</p>

                <div className="flex flex-wrap items-center gap-3 pt-3">
                  <Button asChild size="lg" className="gap-2 shadow-[0_12px_28px_-10px_hsl(var(--primary)/0.45)]">
                    <a href="#apply">
                      Apply as a partner
                      <ArrowRight className="w-4 h-4" />
                    </a>
                  </Button>
                  <Button asChild variant="outline" size="lg">
                    <a href="/auth">Already a partner? Sign in</a>
                  </Button>
                </div>
              </div>

              {heroImageUrl ? (
                <div className="lg:col-span-5 relative">
                  <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-primary/20 via-accent/10 to-transparent blur-2xl opacity-60 pointer-events-none" />
                  <img
                    src={heroImageUrl}
                    alt=""
                    loading="lazy"
                    className="relative w-full h-auto rounded-2xl border border-border/40 shadow-[0_30px_80px_-30px_hsl(var(--primary)/0.35)] object-cover aspect-[4/3]"
                  />
                </div>
              ) : (
                <div className="lg:col-span-5 hidden lg:block relative">
                  <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-primary/20 via-accent/10 to-transparent blur-2xl opacity-60 pointer-events-none" />
                  <div className="relative aspect-[4/3] rounded-2xl bg-gradient-to-br from-primary/10 via-accent/8 to-primary/10 border border-border/50 backdrop-blur-sm flex items-center justify-center">
                    <Building2 className="w-16 h-16 text-primary/30" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Stats strip — editorial proof bar */}
        <section className="border-b border-border/40 bg-gradient-to-b from-background to-primary/[0.025]">
          <div className="container mx-auto px-4 py-10">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-8">
              {STATS.map((s) => (
                <div key={s.label} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/15 text-primary flex items-center justify-center shrink-0">
                    <s.icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div
                      className="text-2xl font-semibold text-foreground tracking-tight leading-none"
                      style={{ fontFamily: "var(--font-heading, inherit)" }}
                    >
                      {s.value}
                    </div>
                    <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground mt-1.5">
                      {s.label}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Benefits strip — editorial cards with primary rail */}
        <section className="container mx-auto px-4 py-16 md:py-20">
          <div className="max-w-2xl mb-10">
            <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary mb-3">
              <span className="w-6 h-px bg-primary/60" />
              Why partner with us
            </div>
            <h2
              className="text-3xl md:text-4xl font-semibold text-foreground tracking-tight"
              style={{ fontFamily: "var(--font-heading, inherit)" }}
            >
              Everything you need to start selling
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {DEFAULT_BULLETS.map((b) => (
              <Card
                key={b.title}
                className="group relative overflow-hidden border-border/50 bg-card/80 backdrop-blur-sm transition-all duration-300 hover:border-primary/40 hover:shadow-[0_20px_50px_-20px_hsl(var(--primary)/0.25)] hover:-translate-y-1"
              >
                <span className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary to-accent opacity-0 group-hover:opacity-100 transition-opacity" />
                <CardContent className="p-7 space-y-3">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary/15 to-accent/10 text-primary border border-primary/15 flex items-center justify-center">
                    <b.icon className="w-5 h-5" />
                  </div>
                  <h3
                    className="font-semibold text-lg text-foreground"
                    style={{ fontFamily: "var(--font-heading, inherit)" }}
                  >
                    {b.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{b.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Product rails — what you can sell */}
        <section className="border-y border-border/40 bg-muted/20">
          <div className="container mx-auto px-4 py-16 md:py-20">
            <div className="max-w-2xl mb-10">
              <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary mb-3">
                <span className="w-6 h-px bg-primary/60" />
                Inventory at your fingertips
              </div>
              <h2
                className="text-3xl md:text-4xl font-semibold text-foreground tracking-tight"
                style={{ fontFamily: "var(--font-heading, inherit)" }}
              >
                Four product rails. One partner portal.
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {PRODUCT_RAILS.map((p) => (
                <div
                  key={p.title}
                  className="group relative rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-6 transition-all hover:border-primary/40 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-18px_hsl(var(--primary)/0.22)]"
                >
                  <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/15 text-primary flex items-center justify-center mb-4">
                    <p.icon className="w-4 h-4" />
                  </div>
                  <div
                    className="font-semibold text-foreground mb-1.5"
                    style={{ fontFamily: "var(--font-heading, inherit)" }}
                  >
                    {p.title}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{p.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works — three steps */}
        <section className="container mx-auto px-4 py-16 md:py-20">
          <div className="max-w-2xl mb-10">
            <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary mb-3">
              <span className="w-6 h-px bg-primary/60" />
              How it works
            </div>
            <h2
              className="text-3xl md:text-4xl font-semibold text-foreground tracking-tight"
              style={{ fontFamily: "var(--font-heading, inherit)" }}
            >
              Three steps from sign-up to first sale
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
            {/* Connecting hairline behind cards */}
            <div
              aria-hidden
              className="hidden md:block absolute left-8 right-8 top-12 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent"
            />
            {STEPS.map((s) => (
              <div
                key={s.n}
                className="relative rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-7"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground flex items-center justify-center font-semibold text-sm shadow-[0_8px_22px_-10px_hsl(var(--primary)/0.55)]">
                    {s.n}
                  </div>
                  <div
                    className="font-semibold text-foreground"
                    style={{ fontFamily: "var(--font-heading, inherit)" }}
                  >
                    {s.title}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Apply form — editorial card */}
        <section id="apply" className="container mx-auto px-4 py-16 md:py-20 max-w-3xl scroll-mt-20">
          <Card className="relative overflow-hidden border-border/50 bg-card/85 backdrop-blur-md shadow-[0_30px_80px_-30px_hsl(var(--primary)/0.25)]">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
            <CardContent className="p-7 md:p-10">
              {submitted ? (
                <div className="text-center py-8">
                  <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-success/15 to-success/5 text-success mx-auto mb-5 flex items-center justify-center border border-success/30">
                    <div className="absolute inset-0 rounded-full bg-success/10 blur-xl" />
                    <CheckCircle2 className="relative w-8 h-8" />
                  </div>
                  <h2
                    className="text-2xl md:text-3xl font-semibold text-foreground mb-3 tracking-tight"
                    style={{ fontFamily: "var(--font-heading, inherit)" }}
                  >
                    Application received
                  </h2>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    Thanks for applying to partner with {agencyName}. Our team will review your details and reach out within 1–2 business days.
                  </p>
                </div>
              ) : (
                <>
                  <div className="mb-7">
                    <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary mb-3">
                      <span className="w-6 h-px bg-primary/60" />
                      Get started
                    </div>
                    <h2
                      className="text-2xl md:text-3xl font-semibold text-foreground mb-2 tracking-tight"
                      style={{ fontFamily: "var(--font-heading, inherit)" }}
                    >
                      Apply as a partner
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Tell us a bit about your agency — we'll review and get back to you within 1–2 business days.
                    </p>
                  </div>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="full_name">Your name *</Label>
                        <Input
                          id="full_name"
                          value={form.full_name}
                          onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))}
                          maxLength={100}
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="email">Email *</Label>
                        <Input
                          id="email"
                          type="email"
                          value={form.email}
                          onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                          maxLength={255}
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="company_name">Agency / company *</Label>
                        <Input
                          id="company_name"
                          value={form.company_name}
                          onChange={(e) => setForm((p) => ({ ...p, company_name: e.target.value }))}
                          maxLength={150}
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="phone">Phone</Label>
                        <Input
                          id="phone"
                          value={form.phone}
                          onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                          maxLength={40}
                          placeholder="Optional"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="message">Anything we should know?</Label>
                      <Textarea
                        id="message"
                        value={form.message}
                        onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
                        rows={3}
                        maxLength={1000}
                        placeholder="Markets you sell, monthly volume, products you'd like to resell…"
                      />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                      <p className="text-xs text-muted-foreground">
                        Already approved?{" "}
                        <a href="/auth" className="text-primary hover:underline font-medium">
                          Sign in to your portal
                        </a>
                        .
                      </p>
                      <Button type="submit" disabled={submitting} size="lg">
                        {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                        Submit application
                      </Button>
                    </div>
                  </form>
                </>
              )}
            </CardContent>
          </Card>
        </section>

        {/* FAQ — editorial accordion-lite */}
        <section className="border-t border-border/40 bg-muted/20">
          <div className="container mx-auto px-4 py-16 md:py-20 max-w-4xl">
            <div className="max-w-2xl mb-10">
              <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary mb-3">
                <span className="w-6 h-px bg-primary/60" />
                Frequently asked
              </div>
              <h2
                className="text-3xl md:text-4xl font-semibold text-foreground tracking-tight"
                style={{ fontFamily: "var(--font-heading, inherit)" }}
              >
                Questions partners ask
              </h2>
            </div>
            <div className="divide-y divide-border/50 rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden">
              {FAQS.map((f) => (
                <details key={f.q} className="group p-6 open:bg-primary/[0.02]">
                  <summary className="flex items-center justify-between gap-6 cursor-pointer list-none">
                    <span
                      className="font-semibold text-foreground"
                      style={{ fontFamily: "var(--font-heading, inherit)" }}
                    >
                      {f.q}
                    </span>
                    <span className="w-7 h-7 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center justify-center text-lg font-light shrink-0 group-open:rotate-45 transition-transform">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 text-sm text-muted-foreground leading-relaxed pr-12">
                    {f.a}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Closing CTA band */}
        <section className="container mx-auto px-4 py-16 md:py-20">
          <div
            className="relative overflow-hidden rounded-3xl border border-primary/20 p-10 md:p-16 text-center"
            style={{
              background:
                "linear-gradient(135deg, hsl(var(--primary) / 0.10) 0%, hsl(var(--accent) / 0.08) 100%)",
            }}
          >
            <div
              aria-hidden
              className="absolute inset-0 opacity-[0.06] pointer-events-none"
              style={{
                backgroundImage:
                  "radial-gradient(hsl(var(--foreground)) 1px, transparent 1px)",
                backgroundSize: "24px 24px",
              }}
            />
            <div className="relative">
              <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary mb-4">
                <Sparkles className="w-3.5 h-3.5" />
                Ready when you are
              </div>
              <h2
                className="text-3xl md:text-5xl font-semibold text-foreground tracking-tight max-w-2xl mx-auto"
                style={{ fontFamily: "var(--font-heading, inherit)" }}
              >
                Start selling under your own brand
              </h2>
              <p className="mt-4 text-base md:text-lg text-muted-foreground max-w-xl mx-auto">
                Apply once. Get approved in days. Sell flights, stays, experiences and transfers — all under {agencyName}.
              </p>
              <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                <Button asChild size="lg" className="gap-2 shadow-[0_12px_28px_-10px_hsl(var(--primary)/0.45)]">
                  <a href="#apply">
                    Apply as a partner
                    <ArrowRight className="w-4 h-4" />
                  </a>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <a href="/auth">Sign in to portal</a>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}