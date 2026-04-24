import { Link } from "react-router-dom";
import {
  Mail,
  MapPin,
  Phone,
  Sparkles,
  Facebook,
  Instagram,
  Youtube,
  Linkedin,
  Twitter,
  ArrowUpRight,
  ShieldCheck,
  Globe2,
} from "lucide-react";
import { useSiteBranding } from "@/hooks/useSiteBranding";
import { useTenant } from "@/hooks/useTenant";

/**
 * HybridFooter (v3 — "Atelier") — magazine-style footer.
 *
 * Distinct visual layout (no longer a generic 4-column grid):
 *  ┌─ accent rule ────────────────────────────────────────────────┐
 *  │ MARQUEE — endless scrolling tagline strip                    │
 *  ├──────────────────────────────────────────────────────────────┤
 *  │  Oversized serif manifesto LEFT  /  CTA card RIGHT            │
 *  ├──────────────────────────────────────────────────────────────┤
 *  │  01 Explore   02 Company   03 Reach   04 Trust                │
 *  ├──────────────────────────────────────────────────────────────┤
 *  │  © Year · siteName · socials · legal nav                     │
 *  └──────────────────────────────────────────────────────────────┘
 */

const SOCIAL_ICONS = {
  facebook: Facebook,
  twitter: Twitter,
  instagram: Instagram,
  youtube: Youtube,
  linkedin: Linkedin,
} as const;

const HybridFooter = () => {
  const { branding } = useSiteBranding();
  const { tenant } = useTenant();
  const ts = (tenant?.settings || {}) as Record<string, any>;
  const contact = (ts.contact || {}) as Record<string, string>;
  const social = (ts.social || {}) as Record<string, string>;
  const siteName = branding.site_name || tenant?.name || "Travel";
  const initials = siteName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const showWordmark = !branding.logo_url;
  const manifesto =
    ts.footer_text ||
    "Curated journeys, transparent pricing, and concierge-grade support — wherever you're headed next.";
  const year = new Date().getFullYear();

  const socials: Array<{ key: keyof typeof SOCIAL_ICONS; url: string }> = [];
  (["instagram", "facebook", "twitter", "youtube", "linkedin"] as const).forEach((k) => {
    const url = social[k];
    if (url) socials.push({ key: k, url });
  });

  const marqueeWords = [
    "Curated journeys",
    "Concierge support",
    "Transparent pricing",
    "Hand-picked stays",
    "Local guides",
    "24/7 booking desk",
    "AI itineraries",
  ];

  return (
    <footer className="relative mt-24">
      {/* Accent rule */}
      <div
        aria-hidden
        className="h-[3px] w-full"
        style={{
          background:
            "linear-gradient(90deg, hsl(var(--primary)) 0%, hsl(var(--accent)) 50%, hsl(var(--primary)) 100%)",
        }}
      />

      {/* ───── Marquee strip ───── */}
      <div className="bg-foreground text-background overflow-hidden border-y border-foreground">
        <div className="flex animate-[hybrid-marquee_36s_linear_infinite] whitespace-nowrap py-3">
          {[...Array(2)].map((_, dup) => (
            <div key={dup} className="flex items-center gap-8 pr-8 shrink-0">
              {marqueeWords.map((w, i) => (
                <span key={`${dup}-${i}`} className="flex items-center gap-8">
                  <span className="text-[10.5px] uppercase tracking-[0.32em] font-bold text-background">
                    {w}
                  </span>
                  <span className="text-[hsl(var(--accent))] text-[8px]">◆</span>
                </span>
              ))}
            </div>
          ))}
        </div>
        <style>{`
          @keyframes hybrid-marquee {
            from { transform: translateX(0); }
            to { transform: translateX(-50%); }
          }
        `}</style>
      </div>

      {/* ───── Editorial body ───── */}
      <div
        className="relative overflow-hidden"
        style={{
          background:
            "linear-gradient(180deg, hsl(var(--primary) / 0.06) 0%, hsl(var(--primary) / 0.10) 100%)",
        }}
      >
        {/* Ambient glow */}
        <div
          aria-hidden
          className="absolute -top-40 left-1/4 w-[700px] h-[400px] rounded-full pointer-events-none"
          style={{
            background:
              "radial-gradient(closest-side, hsl(var(--primary) / 0.18), transparent 70%)",
          }}
        />
        <div
          aria-hidden
          className="absolute -bottom-32 right-1/4 w-[600px] h-[400px] rounded-full pointer-events-none"
          style={{
            background:
              "radial-gradient(closest-side, hsl(var(--accent) / 0.16), transparent 70%)",
          }}
        />
        {/* Dotted grid */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(hsl(var(--foreground)) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        />

        <div className="relative container mx-auto px-4 lg:px-6 py-16 lg:py-24">
          {/* ─── Hero block: oversized manifesto + CTA card ─── */}
          <div className="grid lg:grid-cols-12 gap-10 lg:gap-12 mb-16 lg:mb-20">
            <div className="lg:col-span-8">
              <div className="flex items-center gap-3 text-[10.5px] uppercase tracking-[0.32em] text-primary font-bold mb-6">
                <span className="w-8 h-px bg-primary" />
                The Atelier
                <span className="w-8 h-px bg-primary" />
              </div>
              <h2
                className="text-[36px] sm:text-[48px] lg:text-[60px] font-semibold text-foreground leading-[0.98] tracking-tight"
                style={{
                  fontFamily:
                    "'DM Serif Display', 'Playfair Display', Georgia, serif",
                  letterSpacing: "-0.015em",
                }}
              >
                {manifesto}
              </h2>
              <div className="mt-7 flex items-center gap-3">
                <Link
                  to="/trip-planner"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-full text-[12px] font-bold uppercase tracking-[0.18em] bg-foreground text-background hover:bg-primary transition-all group"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Plan a journey with AI
                  <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </Link>
                <Link
                  to="/contact"
                  className="text-[12px] font-bold uppercase tracking-[0.18em] text-foreground/80 hover:text-primary transition-colors"
                >
                  · or speak to a specialist
                </Link>
              </div>
            </div>

            {/* Right brand card */}
            <div className="lg:col-span-4">
              <div
                className="relative rounded-3xl p-6 lg:p-7 overflow-hidden"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary)/0.85) 100%)",
                  boxShadow: "0 18px 50px -20px hsl(var(--primary) / 0.55)",
                }}
              >
                <div
                  className="absolute inset-0 opacity-[0.08] pointer-events-none"
                  style={{
                    backgroundImage:
                      "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)",
                    backgroundSize: "32px 32px",
                  }}
                />
                <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-[hsl(var(--accent)/0.35)] blur-3xl pointer-events-none" />

                <div className="relative">
                  <div className="flex items-center gap-3 mb-5">
                    {branding.logo_url ? (
                      <img
                        src={branding.logo_url}
                        alt={siteName}
                        className="h-10 w-auto object-contain brightness-0 invert"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-2xl bg-white/15 ring-1 ring-white/30 text-white grid place-items-center font-bold text-base">
                        {initials}
                      </div>
                    )}
                    {showWordmark && (
                      <div className="leading-none">
                        <div
                          className="text-2xl font-semibold text-white tracking-tight"
                          style={{
                            fontFamily:
                              "'DM Serif Display', 'Playfair Display', Georgia, serif",
                          }}
                        >
                          {siteName}
                        </div>
                        <div className="text-[9.5px] uppercase tracking-[0.28em] text-white/70 font-bold mt-1.5">
                          Travel · Curated
                        </div>
                      </div>
                    )}
                  </div>

                  <p className="text-[13.5px] text-white/85 leading-relaxed">
                    Trusted by travellers in 80+ countries. Every booking is backed
                    by our 24/7 concierge promise and best-fare guarantee.
                  </p>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="flex items-start gap-2">
                      <ShieldCheck className="w-4 h-4 text-white/90 mt-0.5" />
                      <div>
                        <div className="text-[11px] font-bold text-white uppercase tracking-wider">Secure</div>
                        <div className="text-[10.5px] text-white/70 leading-tight">PCI-DSS checkout</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Globe2 className="w-4 h-4 text-white/90 mt-0.5" />
                      <div>
                        <div className="text-[11px] font-bold text-white uppercase tracking-wider">Global</div>
                        <div className="text-[10.5px] text-white/70 leading-tight">80+ countries</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ─── Numbered link columns ─── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-8 pb-12 border-b border-foreground/10">
            <FooterColumn n="01" title="Explore" items={[
              { to: "/flights", label: "Flights" },
              { to: "/hotels", label: "Stays" },
              { to: "/tours", label: "Experiences" },
              { to: "/transfers", label: "Transfers" },
              { to: "/blog", label: "Journal" },
            ]} />
            <FooterColumn n="02" title="Company" items={[
              { to: "/about", label: "About" },
              { to: "/contact", label: "Contact" },
              { to: "/partners", label: "Partners" },
              { to: "/careers", label: "Careers" },
              { to: "/help", label: "Help Center" },
            ]} />

            {/* Reach */}
            <div>
              <div className="flex items-baseline gap-2 mb-5">
                <span
                  className="text-[36px] font-semibold text-primary leading-none tabular-nums"
                  style={{ fontFamily: "'DM Serif Display', 'Playfair Display', Georgia, serif" }}
                >
                  03
                </span>
                <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-foreground">Reach us</span>
              </div>
              <ul className="space-y-3.5 text-[13px] text-muted-foreground">
                {contact.email && (
                  <li className="flex items-start gap-2.5">
                    <Mail className="w-3.5 h-3.5 mt-0.5 text-primary shrink-0" />
                    <a href={`mailto:${contact.email}`} className="hover:text-primary transition-colors break-all">
                      {contact.email}
                    </a>
                  </li>
                )}
                {contact.phone && (
                  <li className="flex items-start gap-2.5">
                    <Phone className="w-3.5 h-3.5 mt-0.5 text-primary shrink-0" />
                    <a href={`tel:${contact.phone}`} className="hover:text-primary transition-colors">
                      {contact.phone}
                    </a>
                  </li>
                )}
                {contact.address && (
                  <li className="flex items-start gap-2.5">
                    <MapPin className="w-3.5 h-3.5 mt-0.5 text-primary shrink-0" />
                    <span className="leading-relaxed">{contact.address}</span>
                  </li>
                )}
              </ul>
            </div>

            {/* Trust */}
            <div>
              <div className="flex items-baseline gap-2 mb-5">
                <span
                  className="text-[36px] font-semibold text-primary leading-none tabular-nums"
                  style={{ fontFamily: "'DM Serif Display', 'Playfair Display', Georgia, serif" }}
                >
                  04
                </span>
                <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-foreground">Promises</span>
              </div>
              <ul className="space-y-3 text-[12.5px] text-muted-foreground leading-relaxed">
                <li className="flex items-start gap-2"><span className="text-primary mt-0.5">·</span>Best-fare guarantee on every booking</li>
                <li className="flex items-start gap-2"><span className="text-primary mt-0.5">·</span>24/7 multilingual concierge desk</li>
                <li className="flex items-start gap-2"><span className="text-primary mt-0.5">·</span>No hidden fees — ever</li>
                <li className="flex items-start gap-2"><span className="text-primary mt-0.5">·</span>Carbon-aware itineraries</li>
              </ul>
            </div>
          </div>

          {/* ─── Bottom strip ─── */}
          <div className="mt-8 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground font-semibold">
                © {year} · <span className="text-foreground font-bold">{siteName}</span>
              </div>
              {socials.length > 0 && (
                <>
                  <span className="w-px h-4 bg-border/60" />
                  <div className="flex items-center gap-1.5">
                    {socials.map(({ key, url }) => {
                      const Icon = SOCIAL_ICONS[key];
                      return (
                        <a
                          key={key}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={key}
                          className="w-8 h-8 rounded-full bg-background/70 hover:bg-foreground hover:text-background border border-border/60 hover:border-foreground text-muted-foreground flex items-center justify-center transition-all"
                        >
                          <Icon className="w-3.5 h-3.5" />
                        </a>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center gap-5 text-[11px] uppercase tracking-[0.18em] font-semibold text-muted-foreground">
              <Link to="/terms-and-conditions" className="hover:text-primary transition-colors">Terms</Link>
              <span className="w-1 h-1 rounded-full bg-primary/60" />
              <Link to="/privacy-policy" className="hover:text-primary transition-colors">Privacy</Link>
              <span className="w-1 h-1 rounded-full bg-primary/60" />
              <Link to="/refund-policy" className="hover:text-primary transition-colors">Refunds</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

const FooterColumn = ({
  n,
  title,
  items,
}: {
  n: string;
  title: string;
  items: { to: string; label: string }[];
}) => (
  <div>
    <div className="flex items-baseline gap-2 mb-5">
      <span
        className="text-[36px] font-semibold text-primary leading-none tabular-nums"
        style={{ fontFamily: "'DM Serif Display', 'Playfair Display', Georgia, serif" }}
      >
        {n}
      </span>
      <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-foreground">{title}</span>
    </div>
    <ul className="space-y-3 text-[13px] text-muted-foreground">
      {items.map((it) => (
        <li key={it.to}>
          <Link
            to={it.to}
            className="hover:text-primary transition-colors inline-flex items-center gap-1 group"
          >
            {it.label}
            <ArrowUpRight className="w-3 h-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
          </Link>
        </li>
      ))}
    </ul>
  </div>
);

export default HybridFooter;
