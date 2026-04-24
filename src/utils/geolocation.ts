// Country data: name, ISO code, dial code, flag emoji
export interface CountryInfo {
  name: string;
  code: string;
  dialCode: string;
  flag: string;
}

export const COUNTRIES: CountryInfo[] = [
  { name: "Afghanistan", code: "AF", dialCode: "+93", flag: "🇦🇫" },
  { name: "Albania", code: "AL", dialCode: "+355", flag: "🇦🇱" },
  { name: "Algeria", code: "DZ", dialCode: "+213", flag: "🇩🇿" },
  { name: "Argentina", code: "AR", dialCode: "+54", flag: "🇦🇷" },
  { name: "Australia", code: "AU", dialCode: "+61", flag: "🇦🇺" },
  { name: "Austria", code: "AT", dialCode: "+43", flag: "🇦🇹" },
  { name: "Bahrain", code: "BH", dialCode: "+973", flag: "🇧🇭" },
  { name: "Bangladesh", code: "BD", dialCode: "+880", flag: "🇧🇩" },
  { name: "Belgium", code: "BE", dialCode: "+32", flag: "🇧🇪" },
  { name: "Bhutan", code: "BT", dialCode: "+975", flag: "🇧🇹" },
  { name: "Brazil", code: "BR", dialCode: "+55", flag: "🇧🇷" },
  { name: "Brunei", code: "BN", dialCode: "+673", flag: "🇧🇳" },
  { name: "Cambodia", code: "KH", dialCode: "+855", flag: "🇰🇭" },
  { name: "Canada", code: "CA", dialCode: "+1", flag: "🇨🇦" },
  { name: "China", code: "CN", dialCode: "+86", flag: "🇨🇳" },
  { name: "Colombia", code: "CO", dialCode: "+57", flag: "🇨🇴" },
  { name: "Denmark", code: "DK", dialCode: "+45", flag: "🇩🇰" },
  { name: "Egypt", code: "EG", dialCode: "+20", flag: "🇪🇬" },
  { name: "Ethiopia", code: "ET", dialCode: "+251", flag: "🇪🇹" },
  { name: "Finland", code: "FI", dialCode: "+358", flag: "🇫🇮" },
  { name: "France", code: "FR", dialCode: "+33", flag: "🇫🇷" },
  { name: "Germany", code: "DE", dialCode: "+49", flag: "🇩🇪" },
  { name: "Greece", code: "GR", dialCode: "+30", flag: "🇬🇷" },
  { name: "Hong Kong", code: "HK", dialCode: "+852", flag: "🇭🇰" },
  { name: "India", code: "IN", dialCode: "+91", flag: "🇮🇳" },
  { name: "Indonesia", code: "ID", dialCode: "+62", flag: "🇮🇩" },
  { name: "Iran", code: "IR", dialCode: "+98", flag: "🇮🇷" },
  { name: "Iraq", code: "IQ", dialCode: "+964", flag: "🇮🇶" },
  { name: "Ireland", code: "IE", dialCode: "+353", flag: "🇮🇪" },
  { name: "Israel", code: "IL", dialCode: "+972", flag: "🇮🇱" },
  { name: "Italy", code: "IT", dialCode: "+39", flag: "🇮🇹" },
  { name: "Japan", code: "JP", dialCode: "+81", flag: "🇯🇵" },
  { name: "Jordan", code: "JO", dialCode: "+962", flag: "🇯🇴" },
  { name: "Kenya", code: "KE", dialCode: "+254", flag: "🇰🇪" },
  { name: "Kuwait", code: "KW", dialCode: "+965", flag: "🇰🇼" },
  { name: "Laos", code: "LA", dialCode: "+856", flag: "🇱🇦" },
  { name: "Lebanon", code: "LB", dialCode: "+961", flag: "🇱🇧" },
  { name: "Malaysia", code: "MY", dialCode: "+60", flag: "🇲🇾" },
  { name: "Maldives", code: "MV", dialCode: "+960", flag: "🇲🇻" },
  { name: "Mexico", code: "MX", dialCode: "+52", flag: "🇲🇽" },
  { name: "Mongolia", code: "MN", dialCode: "+976", flag: "🇲🇳" },
  { name: "Morocco", code: "MA", dialCode: "+212", flag: "🇲🇦" },
  { name: "Myanmar", code: "MM", dialCode: "+95", flag: "🇲🇲" },
  { name: "Nepal", code: "NP", dialCode: "+977", flag: "🇳🇵" },
  { name: "Netherlands", code: "NL", dialCode: "+31", flag: "🇳🇱" },
  { name: "New Zealand", code: "NZ", dialCode: "+64", flag: "🇳🇿" },
  { name: "Nigeria", code: "NG", dialCode: "+234", flag: "🇳🇬" },
  { name: "Norway", code: "NO", dialCode: "+47", flag: "🇳🇴" },
  { name: "Oman", code: "OM", dialCode: "+968", flag: "🇴🇲" },
  { name: "Pakistan", code: "PK", dialCode: "+92", flag: "🇵🇰" },
  { name: "Palestine", code: "PS", dialCode: "+970", flag: "🇵🇸" },
  { name: "Philippines", code: "PH", dialCode: "+63", flag: "🇵🇭" },
  { name: "Poland", code: "PL", dialCode: "+48", flag: "🇵🇱" },
  { name: "Portugal", code: "PT", dialCode: "+351", flag: "🇵🇹" },
  { name: "Qatar", code: "QA", dialCode: "+974", flag: "🇶🇦" },
  { name: "Romania", code: "RO", dialCode: "+40", flag: "🇷🇴" },
  { name: "Russia", code: "RU", dialCode: "+7", flag: "🇷🇺" },
  { name: "Saudi Arabia", code: "SA", dialCode: "+966", flag: "🇸🇦" },
  { name: "Singapore", code: "SG", dialCode: "+65", flag: "🇸🇬" },
  { name: "South Africa", code: "ZA", dialCode: "+27", flag: "🇿🇦" },
  { name: "South Korea", code: "KR", dialCode: "+82", flag: "🇰🇷" },
  { name: "Spain", code: "ES", dialCode: "+34", flag: "🇪🇸" },
  { name: "Sri Lanka", code: "LK", dialCode: "+94", flag: "🇱🇰" },
  { name: "Sudan", code: "SD", dialCode: "+249", flag: "🇸🇩" },
  { name: "Sweden", code: "SE", dialCode: "+46", flag: "🇸🇪" },
  { name: "Switzerland", code: "CH", dialCode: "+41", flag: "🇨🇭" },
  { name: "Taiwan", code: "TW", dialCode: "+886", flag: "🇹🇼" },
  { name: "Thailand", code: "TH", dialCode: "+66", flag: "🇹🇭" },
  { name: "Turkey", code: "TR", dialCode: "+90", flag: "🇹🇷" },
  { name: "UAE", code: "AE", dialCode: "+971", flag: "🇦🇪" },
  { name: "UK", code: "GB", dialCode: "+44", flag: "🇬🇧" },
  { name: "USA", code: "US", dialCode: "+1", flag: "🇺🇸" },
  { name: "Ukraine", code: "UA", dialCode: "+380", flag: "🇺🇦" },
  { name: "Uzbekistan", code: "UZ", dialCode: "+998", flag: "🇺🇿" },
  { name: "Vietnam", code: "VN", dialCode: "+84", flag: "🇻🇳" },
  { name: "Yemen", code: "YE", dialCode: "+967", flag: "🇾🇪" },
];

// ── Timezone → country code mapping (offline fallback) ──
const TIMEZONE_TO_COUNTRY: Record<string, string> = {
  "Asia/Dhaka": "BD",
  "Asia/Kolkata": "IN", "Asia/Calcutta": "IN",
  "Asia/Dubai": "AE",
  "Asia/Riyadh": "SA",
  "Asia/Karachi": "PK",
  "Asia/Bangkok": "TH",
  "Asia/Singapore": "SG", "Asia/Kuala_Lumpur": "MY",
  "Asia/Jakarta": "ID",
  "Asia/Tokyo": "JP",
  "Asia/Seoul": "KR",
  "Asia/Shanghai": "CN", "Asia/Hong_Kong": "HK",
  "Asia/Taipei": "TW",
  "Asia/Manila": "PH",
  "Asia/Colombo": "LK",
  "Asia/Kathmandu": "NP",
  "Asia/Qatar": "QA",
  "Asia/Bahrain": "BH",
  "Asia/Kuwait": "KW",
  "Asia/Muscat": "OM",
  "Europe/London": "GB",
  "Europe/Paris": "FR",
  "Europe/Berlin": "DE",
  "Europe/Rome": "IT",
  "Europe/Madrid": "ES",
  "Europe/Amsterdam": "NL",
  "Europe/Istanbul": "TR",
  "Europe/Moscow": "RU",
  "America/New_York": "US", "America/Chicago": "US", "America/Los_Angeles": "US",
  "America/Toronto": "CA",
  "America/Sao_Paulo": "BR",
  "America/Mexico_City": "MX",
  "Australia/Sydney": "AU",
  "Pacific/Auckland": "NZ",
  "Africa/Cairo": "EG",
  "Africa/Lagos": "NG",
  "Africa/Nairobi": "KE",
  "Africa/Johannesburg": "ZA",
};

// No hardcoded default — derive from timezone/locale or use a neutral fallback
const CACHE_KEY = "tv_geo_country_v2";
const LEGACY_CACHE_KEYS = ["tv_geo_country"];
const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours — balances freshness for travelers vs API rate limits

// ── In-memory singleton ──
let cachedCountry: CountryInfo | null = null;
let inflightPromise: Promise<CountryInfo> | null = null;

/**
 * Detect user's country. Resolution order:
 * 1. In-memory cache (instant, survives SPA navigation)
 * 2. localStorage cache (survives reload, 24h TTL)
 * 3. Online IP detection — races all sources in parallel:
 *    a. Client-side IP geo APIs (api.country.is, ipapi.co, freeipapi.com)
 *    b. Edge function CF-IPCountry header (Cloudflare infrastructure)
 *    First valid 2-letter country code wins.
 * 4. Fallback: first entry in COUNTRIES list
 *
 * NO offline fallbacks (timezone/locale) — online accuracy only.
 * NEVER returns null — always resolves to a CountryInfo.
 * Multiple concurrent callers share the same in-flight promise.
 */
export async function detectCountry(): Promise<CountryInfo> {
  // 0. In-memory cache — instant
  if (cachedCountry) return cachedCountry;

  // Dedup concurrent calls
  if (inflightPromise) return inflightPromise;
  inflightPromise = _detect();
  try {
    return await inflightPromise;
  } finally {
    inflightPromise = null;
  }
}

/** Race all IP detection sources — first valid 2-letter code wins */
async function detectCountryOnline(): Promise<string | null> {
  const clientApis = [
    { url: "https://api.country.is", parse: (d: any) => d?.country },
    { url: "https://ipapi.co/json/", parse: (d: any) => d?.country_code },
    { url: "https://freeipapi.com/api/json", parse: (d: any) => d?.countryCode },
  ];

  // Build all race promises
  const racePromises: Promise<string | null>[] = [];

  // Client-side IP geo APIs
  for (const api of clientApis) {
    racePromises.push(
      (async () => {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 3000);
          const res = await fetch(api.url, { signal: controller.signal });
          clearTimeout(timeout);
          if (!res.ok) return null;
          const data = await res.json();
          const code = api.parse(data)?.toUpperCase();
          if (code && code.length === 2) {
            console.log(`[Geo] IP API hit: ${api.url} → ${code}`);
            return code;
          }
        } catch { /* timeout or network error */ }
        return null;
      })()
    );
  }

  // Edge function — reads CF-IPCountry / X-Vercel-IP-Country headers on the server
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (supabaseUrl) {
    racePromises.push(
      (async () => {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 3000);
          const res = await fetch(`${supabaseUrl}/functions/v1/detect-geo`, {
            signal: controller.signal,
            headers: { "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "" },
          });
          clearTimeout(timeout);
          if (!res.ok) return null;
          const data = await res.json();
          const code = data?.country_code?.toUpperCase();
          const source = data?.source;
          // Only trust CDN header detections, not IP APIs run on the server
          if (code && code.length === 2 && source === "cdn-header") {
            console.log(`[Geo] CDN header (CF-IPCountry) → ${code}`);
            return code;
          }
        } catch { /* timeout or network error */ }
        return null;
      })()
    );
  }

  // First valid result wins
  return new Promise<string | null>((resolve) => {
    let resolved = false;
    let pending = racePromises.length;
    if (pending === 0) { resolve(null); return; }
    racePromises.forEach(p => p.then(v => {
      if (v && !resolved) { resolved = true; resolve(v); }
      if (--pending === 0 && !resolved) { resolve(null); }
    }).catch(() => {
      if (--pending === 0 && !resolved) { resolve(null); }
    }));
  });
}

async function _detect(): Promise<CountryInfo> {
  // 1. clear legacy caches from older geo strategies
  try {
    LEGACY_CACHE_KEYS.forEach((key) => localStorage.removeItem(key));
  } catch { /* ignore storage issues */ }

  // 2. localStorage cache
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached) as { code: string; ts: number };
      if (Date.now() - parsed.ts < CACHE_TTL_MS) {
        const match = COUNTRIES.find(c => c.code === parsed.code);
        if (match) {
          cachedCountry = match;
          return match;
        }
      }
    }
  } catch { /* ignore corrupt cache */ }

  // 2. Online IP detection (all sources raced in parallel)
  try {
    const code = await detectCountryOnline();
    if (code) {
      const match = COUNTRIES.find(c => c.code === code);
      if (match) {
        _persist(match.code);
        cachedCountry = match;
        console.log("[Geo] Detected:", match.name, `(${match.code})`);
        return match;
      }
    }
  } catch {
    // All online sources failed
  }

  // 3. Final fallback (should rarely happen — means all APIs are down)
  const fallback = COUNTRIES[0];
  cachedCountry = fallback;
  console.warn("[Geo] All online sources failed, using fallback:", fallback.name);
  return fallback;
}

function _persist(code: string) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ code, ts: Date.now() }));
  } catch { /* quota exceeded etc. */ }
}

/** Get just the country code (convenience for sections that only need the code) */
export async function detectCountryCode(): Promise<string> {
  const country = await detectCountry();
  return country.code;
}

export function findCountryByName(name: string): CountryInfo | undefined {
  return COUNTRIES.find(c => c.name.toLowerCase() === name.toLowerCase());
}

export function findCountryByCode(code: string): CountryInfo | undefined {
  return COUNTRIES.find(c => c.code === code);
}
