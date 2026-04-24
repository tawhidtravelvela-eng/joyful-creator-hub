import { useEffect } from "react";
import { useSiteBranding } from "@/hooks/useSiteBranding";

interface Props {
  /** Per-page title from tenant_page_composition.page_title (optional). */
  pageTitle?: string | null;
  /** Per-page meta description from tenant_page_composition.meta_description. */
  pageDescription?: string | null;
  /** Page slug — used to build canonical + smarter title fallbacks. */
  pageSlug?: string;
}

/**
 * Syncs the document <title>, meta description, OpenGraph/Twitter tags, and
 * favicon to the active tenant's brand + per-page SEO so tenant sites never
 * leak the platform default ("Travel Vela - Book Flights at Best Prices").
 *
 * Resolution order (highest priority first):
 *   1. Per-page composition title / meta_description
 *   2. Brand seo_title / seo_description
 *   3. site_name + tagline composed fallback
 */
export default function TenantSeoHead({
  pageTitle,
  pageDescription,
  pageSlug = "home",
}: Props) {
  const { branding } = useSiteBranding();
  const siteName = branding.site_name || "Travel";
  const tagline = branding.tagline || "";

  // Compose a clean title: per-page > brand SEO title > "{Site} — {Tagline}"
  const composedTitle =
    pageTitle?.trim() ||
    branding.seo_title?.trim() ||
    (tagline ? `${siteName} — ${tagline}` : siteName);

  const composedDescription =
    pageDescription?.trim() ||
    branding.seo_description?.trim() ||
    (tagline
      ? `${siteName} — ${tagline}`
      : `Plan, search and book travel with ${siteName}.`);

  useEffect(() => {
    const url = typeof window !== "undefined" ? window.location.origin : "";
    document.title = composedTitle;

    const setMeta = (key: string, content: string) => {
      const isProperty = key.startsWith("og:") || key.startsWith("twitter:");
      const selector = isProperty
        ? `meta[property="${key}"]`
        : `meta[name="${key}"]`;
      let el = document.querySelector<HTMLMetaElement>(selector);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(isProperty ? "property" : "name", key);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };

    setMeta("description", composedDescription);
    setMeta("og:type", "website");
    setMeta("og:site_name", siteName);
    setMeta("og:title", composedTitle);
    setMeta("og:description", composedDescription);
    if (url) setMeta("og:url", url + (pageSlug === "home" ? "/" : `/p/${pageSlug}`));
    setMeta("twitter:card", "summary_large_image");
    setMeta("twitter:title", composedTitle);
    setMeta("twitter:description", composedDescription);
    if (branding.logo_url) {
      setMeta("og:image", branding.logo_url);
      setMeta("twitter:image", branding.logo_url);
    }

    // Canonical
    let canonical = document.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]',
    );
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = url || "/";
  }, [
    composedTitle,
    composedDescription,
    siteName,
    branding.logo_url,
    pageSlug,
  ]);

  return null;
}