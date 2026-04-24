import { useEffect } from "react";
import { useSiteBranding } from "@/hooks/useSiteBranding";

const HomeJsonLd = () => {
  const { branding } = useSiteBranding();
  const siteName = branding.site_name || "Travel Vela";
  const siteUrl = typeof window !== "undefined" ? window.location.origin : "";
  const desc = `${siteName} — Search 500+ airlines, 100K+ hotels, and curated tours. AI-powered trip planning with best price guarantee.`;

  useEffect(() => {
    document.title = `${siteName} — Book Flights, Hotels & Tours at Best Prices`;

    const setMeta = (prop: string, content: string) => {
      let el = document.querySelector<HTMLMetaElement>(`meta[property="${prop}"]`) ||
               document.querySelector<HTMLMetaElement>(`meta[name="${prop}"]`);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(prop.startsWith("og:") || prop.startsWith("twitter:") ? "property" : "name", prop);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };

    setMeta("description", desc);
    setMeta("og:type", "website");
    setMeta("og:title", `${siteName} — Book Flights, Hotels & Tours`);
    setMeta("og:description", desc);
    setMeta("og:url", siteUrl);
    setMeta("twitter:card", "summary_large_image");
    setMeta("twitter:title", `${siteName} — Flights, Hotels & Tours`);
    setMeta("twitter:description", desc);

    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = siteUrl || "/";
  }, [siteName, siteUrl, desc]);

  const schemas = [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: siteName,
      url: siteUrl,
      potentialAction: {
        "@type": "SearchAction",
        target: `${siteUrl}/flights?from={from}&to={to}`,
        "query-input": "required name=to",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: siteName,
      url: siteUrl,
      sameAs: [],
    },
  ];

  return (
    <>
      {schemas.map((s, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }} />
      ))}
    </>
  );
};

export default HomeJsonLd;
