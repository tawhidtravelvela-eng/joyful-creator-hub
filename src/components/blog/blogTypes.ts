export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  featured_image: string | null;
  tags: string[];
  author_name: string;
  published_at: string | null;
  created_at: string;
  category_id: string | null;
  word_count?: number;
  language?: string | null;
}

export const LANGUAGE_OPTIONS: { code: string; label: string; flag: string }[] = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "bn", label: "বাংলা", flag: "🇧🇩" },
  { code: "hi", label: "हिन्दी", flag: "🇮🇳" },
  { code: "ar", label: "العربية", flag: "🇸🇦" },
  { code: "ms", label: "Bahasa Melayu", flag: "🇲🇾" },
  { code: "th", label: "ไทย", flag: "🇹🇭" },
  { code: "ja", label: "日本語", flag: "🇯🇵" },
];

export interface BlogCategory {
  id: string;
  name: string;
  slug: string;
}

export interface CachedPrice {
  price: number;
  currency: string;
}

/** Map destination keywords to IATA codes for price lookups */
export const DEST_IATA_MAP: Record<string, string> = {
  thailand: "BKK", bangkok: "BKK",
  malaysia: "KUL", "kuala lumpur": "KUL",
  singapore: "SIN",
  dubai: "DXB",
  maldives: "MLE",
  turkey: "IST", istanbul: "IST",
  india: "DEL", kolkata: "CCU", delhi: "DEL",
  japan: "NRT", tokyo: "NRT",
  bali: "DPS", indonesia: "DPS",
  vietnam: "HAN", hanoi: "HAN",
  nepal: "KTM", kathmandu: "KTM",
  "sri lanka": "CMB", colombo: "CMB",
  paris: "CDG", london: "LHR", "new york": "JFK",
  "cox's bazar": "CXB", sylhet: "ZYL", chittagong: "CGP",
};

export const extractDestination = (post: BlogPost): string => {
  const title = post.title.toLowerCase();
  const rawTags = post.tags;
  const tagsArr: string[] = Array.isArray(rawTags)
    ? rawTags.map(String)
    : typeof rawTags === "string"
      ? (() => { try { const p = JSON.parse(rawTags); return Array.isArray(p) ? p.map(String) : []; } catch { return []; } })()
      : [];
  const all = title + " " + tagsArr.map(t => t.toLowerCase()).join(" ");
  const destinations = Object.keys(DEST_IATA_MAP);
  for (const dest of destinations) {
    if (all.includes(dest)) return dest.charAt(0).toUpperCase() + dest.slice(1);
  }
  return "";
};

export const formatCachedPrice = (price: number, currency: string): string => {
  const symbols: Record<string, string> = { BDT: "৳", INR: "₹", USD: "$", EUR: "€", GBP: "£" };
  const sym = symbols[currency] || currency + " ";
  return `${sym}${Math.round(price).toLocaleString()}`;
};

export const getIataCode = (dest: string): string | null => {
  return DEST_IATA_MAP[dest.toLowerCase()] || null;
};

export const estimateReadTime = (wordCount: number) => Math.max(1, Math.round(wordCount / 200));

export const fmtIso = (post: BlogPost) => post.published_at || post.created_at;
