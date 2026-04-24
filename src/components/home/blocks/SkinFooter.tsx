import { Link } from "react-router-dom";
import {
  Plane,
  Phone,
  Mail,
  MapPin,
  Facebook,
  Instagram,
  Youtube,
  Linkedin,
  Twitter,
  ArrowUpRight,
  ShieldCheck,
  Sparkles,
  Globe2,
} from "lucide-react";
import { useBlockOverride } from "@/hooks/useBlockOverride";
import { useSiteBranding } from "@/hooks/useSiteBranding";
import { useFooterData } from "@/hooks/useFooterData";
import { useTenantFooterFacts } from "@/hooks/useTenantFooterFacts";

/**
 * footer.skin-columns — editorial split-canvas footer.
 *
 *  ┌───────────────────────────────────────────────────────────────┐
 *  │  LEFT  ░ Brand panel: logo, tagline, socials, trust strip     │
 *  │  RIGHT ░ Newsletter card + 3 link columns + contact panel     │
 *  └───────────────────────────────────────────────────────────────┘
 *
 *  Design rules:
 *    • Asymmetric split (5 / 7) instead of the previous 12-col grid.
 *    • Brand panel uses the tenant's primary color as a vertical band so
 *      the footer feels distinct from the body and matches the brand.
 *    • Right side sits on a neutral surface for readability.
 *    • Payment badges only render the methods THIS tenant actually
 *      accepts, sourced from useTenantFooterFacts. If the tenant has no
 *      configured methods we hide the row entirely — no fake badges.
 *    • Top destinations are pulled from real bookings when there's enough
 *      signal; otherwise the column falls back to a generic explore list.
 */

const SOCIAL_ICONS = {
  facebook: Facebook,
  twitter: Twitter,
  instagram: Instagram,
  youtube: Youtube,
  linkedin: Linkedin,
} as const;

const SkinFooter = () => {
  const ov = useBlockOverride();
  const c = ov?.content || {};
  const { branding } = useSiteBranding();
  const { footer, contact, social } = useFooterData();
  const facts = useTenantFooterFacts();

  const siteName = (c.site_name as string) || branding.site_name || "Your Brand";
  const tagline =
    (c.tagline as string) ||
    (footer.description as string) ||
    "Your trusted travel partner for flights, hotels, tours and more.";
  const logoUrl = (c.logo_url as string) || branding.logo_url;
  const initials = siteName
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // ─── Top destinations: real bookings → curated fallback ───
  const overrideDestinations =
    Array.isArray(c.destinations) && (c.destinations as any[]).length
      ? (c.destinations as Array<{ label: string; href?: string }>)
      : null;
  const destinations =
    overrideDestinations ??
    facts.topDestinations ??
    [
      { label: "Dubai", href: "/flights?to=DXB" },
      { label: "Bangkok", href: "/flights?to=BKK" },
      { label: "Singapore", href: "/flights?to=SIN" },
      { label: "Kuala Lumpur", href: "/flights?to=KUL" },
      { label: "Maldives", href: "/flights?to=MLE" },
    ];

  const companyLinks =
    Array.isArray(c.company_links) && (c.company_links as any[]).length
      ? (c.company_links as Array<{ label: string; href?: string }>)
      : [
          { label: "About", href: "/about" },
          { label: "Contact", href: "/contact" },
          { label: "Blog", href: "/blog" },
          { label: "Careers", href: "/careers" },
        ];

  const supportLinks =
    Array.isArray(c.support_links) && (c.support_links as any[]).length
      ? (c.support_links as Array<{ label: string; href?: string }>)
      : [
          { label: "Help Center", href: "/help" },
          { label: "Privacy", href: "/privacy" },
          { label: "Terms", href: "/terms" },
          { label: "Refunds", href: "/cancellation" },
        ];

  // ─── Contact ───
  const phone = (c.phone as string) || contact.phone || "";
  const email = (c.email as string) || contact.email || "";
  const address = (c.address as string) || contact.address || "";

  // ─── Social ───
  const socials: Array<{ key: keyof typeof SOCIAL_ICONS; url: string }> = [];
  (["instagram", "facebook", "youtube", "linkedin", "twitter"] as const).forEach((k) => {
    const url = (c[`social_${k}`] as string) || (social[k] as string);
    if (url) socials.push({ key: k, url });
  });

  // ─── Payment methods (real, tenant-specific). Override wins for studio editing. ───
  const overridePayments =
    Array.isArray(c.payment_methods) && (c.payment_methods as any[]).length
      ? (c.payment_methods as Array<{ label: string }>)
      : null;
  const paymentMethods =
    overridePayments ?? facts.paymentMethods.map((m) => ({ label: m.label }));

  const copyright =
    (c.copyright as string) ||
    (footer.copyright_text as string) ||
    `© ${new Date().getFullYear()} ${siteName}. All rights reserved.`;

  // ─── Trust items (real signals only) ───
  // We never invent stats. Each item is shown only when its source value
  // is actually configured in the tenant's settings or derivable from data.
  type TrustItem = { label: string; value: string };
  const trustItems: TrustItem[] = [];
  const estYear =
    (c.est_year as string | number) ||
    (contact.est_year as string | number) ||
    (footer.est_year as string | number);
  if (estYear) {
    const years = Math.max(1, new Date().getFullYear() - Number(estYear));
    trustItems.push({ label: "Established", value: `${years}+ years` });
  }
  const license = (c.license_no as string) || (contact.civil_aviation_license as string) || (contact.iata_number as string);
  if (license) {
    const licenseLabel = (c.license_label as string) || (contact.license_label as string) || "Licensed";
    trustItems.push({ label: licenseLabel, value: license });
  }

  return (
    <footer className="relative mt-16 text-foreground">
      {/* Hairline accent at the very top */}
      <div
        aria-hidden
        className="h-[3px] w-full"
        style={{
          background:
            "linear-gradient(90deg, hsl(var(--primary)) 0%, hsl(var(--accent)) 50%, hsl(var(--primary)) 100%)",
        }}
      />

      <div className="bg-background border-t border-border/60">
        <div className="container mx-auto px-4 lg:px-6">
          <div className="grid lg:grid-cols-12 gap-0 lg:gap-10 py-12 lg:py-16">
            {/* ───── LEFT: Brand panel (5/12) ───── */}
            <div className="lg:col-span-5">
              <div
                className="relative rounded-3xl p-7 lg:p-9 overflow-hidden text-primary-foreground"
                style={{
                  background:
                    "linear-gradient(160deg, hsl(var(--primary)) 0%, hsl(var(--primary)/0.88) 100%)",
                  boxShadow: "0 22px 60px -28px hsl(var(--primary) / 0.55)",
                }}
              >
                {/* Subtle grid texture */}
                <div
                  aria-hidden
                  className="absolute inset-0 opacity-[0.07] pointer-events-none"
                  style={{
                    backgroundImage:
                      "linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)",
                    backgroundSize: "28px 28px",
                  }}
                />
                {/* Accent glow */}
                <div
                  aria-hidden
                  className="absolute -top-16 -right-10 w-56 h-56 rounded-full pointer-events-none"
                  style={{
                    background:
                      "radial-gradient(closest-side, hsl(var(--accent) / 0.55), transparent 70%)",
                  }}
                />

                <div className="relative">
                  <Link to="/" className="inline-flex items-center gap-3 mb-5">
                    {logoUrl ? (
                      <img
                        src={logoUrl}
                        alt={siteName}
                        className="h-10 w-auto object-contain brightness-0 invert"
                      />
                    ) : (
                      <>
                        <div className="w-11 h-11 rounded-xl bg-primary-foreground/15 ring-1 ring-primary-foreground/30 grid place-items-center font-bold text-base">
                          {initials || <Plane className="w-4 h-4" />}
                        </div>
                        <span
                          className="text-2xl font-semibold tracking-tight"
                          style={{
                            fontFamily:
                              "'DM Serif Display', 'Playfair Display', Georgia, serif",
                          }}
                        >
                          {siteName}
                        </span>
                      </>
                    )}
                  </Link>

                  <p className="text-[14px] leading-relaxed text-primary-foreground/85 max-w-[42ch]">
                    {tagline}
                  </p>

                  {/* Trust strip — only renders verifiable, real signals.
                      We never invent badges. Each card is shown only when we
                      have real data backing it. */}
                  {(facts.paymentMethods.length > 0 || trustItems.length > 0) && (
                    <div className="mt-7 grid grid-cols-2 gap-3 max-w-md">
                      {facts.paymentMethods.length > 0 && (
                        <div className="flex items-start gap-2.5 rounded-xl bg-primary-foreground/10 ring-1 ring-primary-foreground/20 p-3">
                          <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0" />
                          <div>
                            <div className="text-[11px] font-bold uppercase tracking-wider">
                              Secure Checkout
                            </div>
                            <div className="text-[10.5px] text-primary-foreground/75 leading-tight">
                              {facts.paymentMethods.length}{" "}
                              {facts.paymentMethods.length === 1 ? "method" : "methods"} accepted
                            </div>
                          </div>
                        </div>
                      )}
                      {trustItems.map((t) => (
                        <div key={t.label} className="flex items-start gap-2.5 rounded-xl bg-primary-foreground/10 ring-1 ring-primary-foreground/20 p-3">
                          <Globe2 className="w-4 h-4 mt-0.5 shrink-0" />
                          <div>
                            <div className="text-[11px] font-bold uppercase tracking-wider">
                              {t.label}
                            </div>
                            <div className="text-[10.5px] text-primary-foreground/75 leading-tight">
                              {t.value}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Socials */}
                  {socials.length > 0 && (
                    <div className="mt-7 flex items-center gap-2">
                      {socials.map(({ key, url }) => {
                        const Icon = SOCIAL_ICONS[key];
                        return (
                          <a
                            key={key}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={key}
                            className="w-9 h-9 rounded-full bg-primary-foreground/10 hover:bg-primary-foreground hover:text-primary border border-primary-foreground/25 flex items-center justify-center transition-all"
                          >
                            <Icon className="w-4 h-4" />
                          </a>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ───── RIGHT: Newsletter + columns + contact (7/12) ───── */}
            <div className="lg:col-span-7 mt-10 lg:mt-0 flex flex-col gap-8">
              {/* Newsletter card */}
              <form
                onSubmit={(e) => e.preventDefault()}
                className="rounded-2xl border border-border/60 bg-muted/30 p-5 sm:p-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
              >
                <div className="flex items-center gap-3 sm:flex-1">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-foreground leading-tight">
                      Travel intelligence, weekly
                    </div>
                    <div className="text-xs text-muted-foreground leading-tight mt-0.5">
                      Hand-picked deals & destination guides — no spam.
                    </div>
                  </div>
                </div>
                <div className="flex items-stretch gap-2 sm:max-w-sm w-full">
                  <input
                    type="email"
                    placeholder="you@email.com"
                    aria-label="Email address"
                    className="flex-1 min-w-0 h-10 px-3 rounded-lg bg-background border border-border/60 text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <button
                    type="submit"
                    className="h-10 px-4 rounded-lg bg-foreground text-background text-xs font-bold uppercase tracking-wider hover:bg-primary transition-colors inline-flex items-center gap-1.5"
                  >
                    Join
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </form>

              {/* Link grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-4">
                <FooterCol title="Top Destinations" items={destinations} />
                <FooterCol title="Company" items={companyLinks} />
                <FooterCol title="Support" items={supportLinks} />
                {/* Contact column */}
                <div>
                  <h4 className="text-[11px] font-bold uppercase tracking-[0.18em] text-foreground mb-4">
                    Reach Us
                  </h4>
                  <ul className="space-y-2.5 text-sm text-muted-foreground">
                    {phone && (
                      <li className="flex items-start gap-2">
                        <Phone className="w-3.5 h-3.5 mt-1 text-primary shrink-0" />
                        <a href={`tel:${phone}`} className="hover:text-foreground transition-colors">
                          {phone}
                        </a>
                      </li>
                    )}
                    {email && (
                      <li className="flex items-start gap-2">
                        <Mail className="w-3.5 h-3.5 mt-1 text-primary shrink-0" />
                        <a
                          href={`mailto:${email}`}
                          className="hover:text-foreground transition-colors break-all"
                        >
                          {email}
                        </a>
                      </li>
                    )}
                    {address && (
                      <li className="flex items-start gap-2">
                        <MapPin className="w-3.5 h-3.5 mt-1 text-primary shrink-0" />
                        <span className="leading-snug">{address}</span>
                      </li>
                    )}
                    {!phone && !email && !address && (
                      <li className="text-xs italic text-muted-foreground/70">
                        Contact details coming soon.
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* ───── Bottom strip ───── */}
          <div className="border-t border-border/60 py-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <p className="text-xs text-muted-foreground">{copyright}</p>

            {/* Payment methods — only what this tenant truly accepts */}
            {paymentMethods.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] uppercase tracking-[0.22em] font-bold text-muted-foreground/80 mr-1">
                  We accept
                </span>
                {paymentMethods.map((p) => (
                  <span
                    key={p.label}
                    className="px-2.5 py-1 rounded-md bg-foreground/[0.04] border border-border/60 text-foreground/80 text-[10px] font-bold tracking-wide"
                  >
                    {p.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
};

const FooterCol = ({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; href?: string }>;
}) => (
  <div>
    <h4 className="text-[11px] font-bold uppercase tracking-[0.18em] text-foreground mb-4">
      {title}
    </h4>
    <ul className="space-y-2.5">
      {items.map((it) => (
        <li key={it.label}>
          <Link
            to={it.href || "#"}
            className="text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            {it.label}
          </Link>
        </li>
      ))}
    </ul>
  </div>
);

export default SkinFooter;

