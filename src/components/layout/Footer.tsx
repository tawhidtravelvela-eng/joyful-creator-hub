import { Link } from "react-router-dom";
import {
  Plane,
  Mail,
  Phone,
  MapPin,
  Facebook,
  Twitter,
  Instagram,
  Youtube,
  Linkedin,
  Globe,
  Shield,
  Headphones,
  ArrowUpRight,
  CreditCard,
  Award,
} from "lucide-react";
import { useSiteBranding } from "@/hooks/useSiteBranding";
import { useFooterData } from "@/hooks/useFooterData";
import { cn } from "@/lib/utils";

/* ── Route mapping for support links ── */
const SUPPORT_ROUTES: Record<string, string> = {
  "Privacy Policy": "/privacy-policy",
  "Terms of Service": "/terms-and-conditions",
  "Cancellation Policy": "/refund-policy",
  "Refund Policy": "/refund-policy",
  "Help Center": "/blog",
};

const Footer = () => {
  const { branding } = useSiteBranding();
  const { footer, contact, social } = useFooterData();

  const siteName = branding.site_name || "Travel Vela";
  const description =
    footer.description ||
    "Search, compare, and book flights, hotels & tours at the best prices — trusted by travelers worldwide.";

  const quickLinks = (footer.quick_links || "Flights,Hotels,Tours,Experiences,Blog")
    .split(",")
    .map((s: string) => s.trim())
    .filter(Boolean);

  const supportLinks = (
    footer.support_links ||
    "Help Center,Cancellation Policy,Privacy Policy,Terms of Service"
  )
    .split(",")
    .map((s: string) => s.trim())
    .filter(Boolean);

  const showSocial = footer.show_social_icons !== false;
  const showContact = footer.show_contact_info !== false;

  const rawCopyright =
    footer.copyright_text || `© {year} ${siteName}. All rights reserved.`;
  const copyrightText = rawCopyright
    .replace(/\{year\}/g, String(new Date().getFullYear()))
    .replace(/© \d{4}/, `© ${new Date().getFullYear()}`);

  const email = contact.email || "support@travelvela.com";
  const phone = contact.phone || "+880 1234 567890";
  const address = contact.address || "";

  const socialLinks = [
    { icon: Facebook, url: social.facebook, label: "Facebook" },
    { icon: Twitter, url: social.twitter, label: "Twitter" },
    { icon: Instagram, url: social.instagram, label: "Instagram" },
    { icon: Youtube, url: social.youtube, label: "Youtube" },
    { icon: Linkedin, url: social.linkedin, label: "LinkedIn" },
  ].filter((s) => s.url);

  const visibleSocials = socialLinks;

  return (
    <footer className="relative overflow-hidden bg-foreground text-background">
      {/* ── Ambient glow layers ── */}
      <div className="absolute inset-0" style={{
        backgroundImage: "radial-gradient(ellipse at 20% 0%, hsl(222 55% 45% / 0.07) 0%, transparent 50%), radial-gradient(ellipse at 80% 100%, hsl(14 90% 58% / 0.05) 0%, transparent 50%)"
      }} />
      <div className="absolute top-0 left-1/3 w-[700px] h-[500px] bg-primary/[0.04] rounded-full blur-[180px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[400px] bg-accent/[0.03] rounded-full blur-[140px] pointer-events-none" />
      
      {/* Animated accent stripe at top */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent/20 to-transparent" />
      
      {/* Grain texture */}
      <div className="absolute inset-0 opacity-[0.012]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E\")" }} />

      <div className="container mx-auto px-4 pt-12 pb-6 relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-12 gap-y-10 gap-x-6 lg:gap-x-8">

          {/* ── Brand column ── */}
          <div className="col-span-2 md:col-span-3 lg:col-span-4">
            <Link to="/" className="inline-flex items-center gap-2.5 mb-5 group">
              {branding.logo_url ? (
                <img
                  src={branding.logo_url}
                  alt={siteName}
                  className="h-10 w-auto object-contain brightness-0 invert transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <>
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-accent to-accent/80 flex items-center justify-center shadow-lg shadow-accent/20 transition-transform duration-300 group-hover:scale-105">
                    <Plane className="w-5 h-5 text-accent-foreground" />
                  </div>
                  <span className="text-xl font-display font-bold tracking-tight text-background">
                    {siteName}
                  </span>
                </>
              )}
            </Link>
            <p className="text-[13px] text-white/40 leading-relaxed max-w-[300px] mb-7">
              {description}
            </p>

            {showSocial && visibleSocials.length > 0 && (
              <div className="flex items-center gap-2">
                {visibleSocials.map(({ icon: Icon, url, label }) => (
                  <a
                    key={label}
                    href={url}
                    target={url !== "#" ? "_blank" : undefined}
                    rel="noopener noreferrer"
                    aria-label={label}
                    className={cn(
                      "w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300",
                      url === "#"
                        ? "bg-white/[0.04] text-white/20 cursor-default"
                        : "bg-white/[0.06] border border-white/[0.06] text-white/45 hover:bg-accent hover:text-white hover:scale-110 hover:shadow-lg hover:shadow-accent/20 hover:border-accent/30"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* ── Explore ── */}
          <div className="lg:col-span-2">
            <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/25 mb-5">
              Explore
            </h4>
            <ul className="space-y-3.5">
              {quickLinks.map((item: string) => (
                <li key={item}>
                  <Link
                    to={`/${item.toLowerCase().replace(/\s+/g, "-")}`}
                    className="group text-[13px] text-white/45 hover:text-accent transition-colors duration-200 inline-flex items-center gap-1 relative"
                  >
                    {item}
                    <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 absolute -right-4" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* ── Support ── */}
          <div className="lg:col-span-3">
            <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/25 mb-5">
              Support
            </h4>
            <ul className="space-y-3.5">
              {supportLinks.map((item: string) => {
                const route = SUPPORT_ROUTES[item];
                return (
                  <li key={item}>
                    {route ? (
                      <Link
                        to={route}
                        className="group text-[13px] text-white/45 hover:text-accent transition-colors duration-200 inline-flex items-center gap-1 relative"
                      >
                        {item}
                        <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 absolute -right-4" />
                      </Link>
                    ) : (
                      <span className="text-[13px] text-white/45 hover:text-accent transition-colors duration-200 cursor-pointer">
                        {item}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          {/* ── Contact ── */}
          {showContact && (
            <div className="col-span-2 md:col-span-1 lg:col-span-3">
              <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/25 mb-5">
                Get in Touch
              </h4>
              <ul className="space-y-4">
                <li>
                  <a href={`mailto:${email}`} className="flex items-start gap-3 group">
                    <div className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center shrink-0 group-hover:bg-accent/15 group-hover:border-accent/20 transition-all duration-300">
                      <Mail className="w-4 h-4 text-white/30 group-hover:text-accent transition-colors duration-300" />
                    </div>
                    <div>
                      <span className="text-[11px] text-white/25 font-medium block mb-0.5">Email</span>
                      <span className="text-[13px] text-white/55 group-hover:text-white transition-colors duration-200">
                        {email}
                      </span>
                    </div>
                  </a>
                </li>
                <li>
                  <a href={`tel:${phone.replace(/\s/g, "")}`} className="flex items-start gap-3 group">
                    <div className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center shrink-0 group-hover:bg-accent/15 group-hover:border-accent/20 transition-all duration-300">
                      <Phone className="w-4 h-4 text-white/30 group-hover:text-accent transition-colors duration-300" />
                    </div>
                    <div>
                      <span className="text-[11px] text-white/25 font-medium block mb-0.5">Phone</span>
                      <span className="text-[13px] text-white/55 group-hover:text-white transition-colors duration-200">
                        {phone}
                      </span>
                    </div>
                  </a>
                </li>
                {address && (
                  <li className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center shrink-0">
                      <MapPin className="w-4 h-4 text-white/30" />
                    </div>
                    <div>
                      <span className="text-[11px] text-white/25 font-medium block mb-0.5">Office</span>
                      <span className="text-[13px] text-white/40">{address}</span>
                    </div>
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>

        {/* ── Trust badges ── */}
        <div className="mt-12 pt-8 border-t border-white/[0.06]">
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 mb-8">
            {[
              { icon: Shield, label: "Secure payments", sub: "256-bit SSL" },
              { icon: Globe, label: "Global coverage", sub: "190+ countries" },
              { icon: Headphones, label: "24/7 support", sub: "Always here" },
              { icon: CreditCard, label: "Easy refunds", sub: "Hassle-free" },
              { icon: Award, label: "Best price", sub: "Guaranteed" },
            ].map(({ icon: Icon, label, sub }) => (
              <div key={label} className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
                  <Icon className="w-3.5 h-3.5 text-white/35" />
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-white/45 block leading-tight">{label}</span>
                  <span className="text-[10px] text-white/25 block leading-tight">{sub}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Payment method logos */}
          <div className="flex flex-wrap items-center justify-center gap-6">
            <span className="text-[10px] text-white/15 uppercase tracking-[0.15em] font-semibold">We accept</span>
            {["Visa", "Mastercard", "Amex", "bKash", "Nagad"].map((name) => (
              <span
                key={name}
                className="text-[11px] font-bold text-white/25 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.05]"
              >
                {name}
              </span>
            ))}
          </div>
        </div>

        {/* ── Bottom bar ── */}
        <div className="mt-8 pt-6 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[11px] text-white/25 font-medium">{copyrightText}</p>
          <div className="flex items-center gap-6">
            <Link to="/privacy-policy" className="text-[11px] text-white/25 hover:text-white/50 transition-colors duration-200 font-medium">
              Privacy
            </Link>
            <Link to="/terms-and-conditions" className="text-[11px] text-white/25 hover:text-white/50 transition-colors duration-200 font-medium">
              Terms
            </Link>
            <Link to="/refund-policy" className="text-[11px] text-white/25 hover:text-white/50 transition-colors duration-200 font-medium">
              Refunds
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
