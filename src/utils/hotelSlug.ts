/**
 * Generate SEO-friendly hotel URL slugs
 * Format: /hotels/{city-slug}/{hotel-name-slug}
 * No IDs or sensitive data exposed in URLs
 */

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    || "hotel";
}

/** Build an SEO-friendly hotel detail path — name only, no IDs */
export function buildHotelPath(hotel: { id?: string; name: string; city?: string }): string {
  const citySlug = slugify(hotel.city || "unknown");
  const nameSlug = slugify(hotel.name || "hotel");
  return `/hotels/${citySlug}/${nameSlug}`;
}

/** Extract the hotel name slug from the URL path (used for DB lookup) */
export function extractHotelNameSlug(slug: string): string {
  return slug.toLowerCase().trim();
}
