import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Unified Tour/Activity Search Engine v3
 * 
 * Provider-agnostic architecture with:
 * - Server-side filtering (tagIds, priceRange, durationRange, rating, sortOrder)
 * - DB caching with graceful fallback
 * - Destination & tag taxonomy endpoints
 * - Price verification for booking
 * - AI-powered suggestions
 * 
 * Actions: search, freetext, product, reviews, availability, destinations, tags,
 *          trending-destinations, verify-price, cached-search, similar, suggestions
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};


// ── Supabase Helper ──
function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

// ── Destination ID → Name Resolver ──
let destIdToNameCache: Record<string, string> | null = null;
let destIdToCountryCache: Record<string, string> | null = null;
let destCacheExpiry = 0;

async function getDestIdToNameMap(): Promise<Record<string, string>> {
  const now = Date.now();
  if (destIdToNameCache && now < destCacheExpiry) return destIdToNameCache;

  const map: Record<string, string> = {};
  const countryMap: Record<string, string> = {};
  try {
    const sb = getSupabaseAdmin();
    // Primary source: viator_destination_map (authoritative — includes full taxonomy)
    const { data: mapData } = await sb
      .from("viator_destination_map")
      .select("dest_id, city_name, country, dest_type");
    if (mapData) {
      for (const row of mapData) {
        if (row.dest_id && row.city_name) {
          map[String(row.dest_id)] = row.city_name;
          if (row.country) countryMap[String(row.dest_id)] = row.country;
        }
      }
    }
    // Fallback: also load from tour_sync_state for any IDs not in the map
    const { data: syncData } = await sb
      .from("tour_sync_state")
      .select("destination_id, destination_name")
      .not("destination_name", "eq", "");
    if (syncData) {
      for (const row of syncData) {
        const id = String(row.destination_id);
        if (id && row.destination_name && !map[id]) {
          map[id] = row.destination_name;
        }
      }
    }
  } catch (e) {
    console.warn("[dest-resolver] Failed to load destination maps:", e);
  }

  destIdToNameCache = map;
  destIdToCountryCache = countryMap;
  destCacheExpiry = now + 10 * 60_000;
  console.log(`[dest-resolver] Loaded ${Object.keys(map).length} destination ID→name mappings`);
  return map;
}

// ── Strip symbols from search text for clean word splitting ──
function cleanSearchText(text: string): string {
  return text
    .replace(/[()[\]{}<>+&|!@#$%^*=~`"';:,./\\]/g, " ")
    .replace(/[-–—]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

const SEARCH_CITY_WORDS = new Set([
  "kuala", "lumpur", "singapore", "bangkok", "tokyo", "london", "paris",
  "delhi", "mumbai", "dubai", "istanbul", "cairo", "rome", "berlin",
  "amsterdam", "jakarta", "manila", "hanoi", "seoul", "taipei", "osaka",
  "kyoto", "penang", "langkawi", "bali", "phuket", "chiang", "mai",
  "hong", "kong", "ho", "chi", "minh", "george", "town",
]);

const SEARCH_STOP_WORDS = new Set([
  "the", "and", "for", "with", "from", "tour", "tours", "ticket", "tickets",
  "admission", "entry", "city", "day", "trip", "trips", "at", "of", "in",
  "to", "on", "a", "an",
]);

const SEARCH_IDENTITY_WORDS = new Set([
  "zoo", "negara", "aquaria", "aquarium", "safari", "museum", "temple",
  "garden", "gardens", "park", "island", "bridge", "tower", "towers",
  "cave", "caves", "beach", "palace", "mosque", "cathedral", "waterfall",
  "lake", "petronas", "entopia", "skyworlds", "skyworld", "skycab",
  "skybridge", "skypark", "universal", "studios", "legoland", "klcc",
  "merlion", "putrajaya", "batu", "botanical", "butterfly", "panda",
  "highland", "highlands", "cable", "cablecar", "observatory", "aviary",
  "oceanarium", "twin",
]);

function normalizeSearchValue(text: string): string {
  return cleanSearchText((text || "").toLowerCase())
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getSearchTokens(text: string, minLength = 2): string[] {
  return normalizeSearchValue(text)
    .split(" ")
    .filter((word) => word.length >= minLength);
}

function getStrictIdentityContext(searchText: string, destinationCity?: string) {
  const queryTokens = getSearchTokens(searchText, 2).filter((word) => !SEARCH_STOP_WORDS.has(word));
  const destinationTokens = new Set(getSearchTokens(destinationCity || "", 2));
  const hasCityContext = destinationTokens.size > 0 || queryTokens.some((word) => SEARCH_CITY_WORDS.has(word));
  const nonCityTokens = queryTokens.filter((word) => !SEARCH_CITY_WORDS.has(word) && !destinationTokens.has(word));
  const identityTokens = [...new Set(nonCityTokens.filter((word) => SEARCH_IDENTITY_WORDS.has(word) || word.length >= 5))];
  const phrases: string[] = [];

  for (let i = 0; i < queryTokens.length - 1; i++) {
    for (let size = 3; size >= 2; size--) {
      const slice = queryTokens.slice(i, i + size);
      if (slice.length !== size) continue;
      if (slice.some((word) => SEARCH_CITY_WORDS.has(word) || destinationTokens.has(word))) continue;
      if (!slice.some((word) => SEARCH_IDENTITY_WORDS.has(word) || word.length >= 5)) continue;
      phrases.push(slice.join(" "));
    }
  }

  return {
    strict: hasCityContext && nonCityTokens.length >= 2 && (identityTokens.length >= 2 || phrases.length > 0),
    queryTokens,
    nonCityTokens,
    identityTokens,
    phrases: [...new Set(phrases)].sort((a, b) => b.length - a.length),
  };
}


// Track dest_ids we've already queued for auto-learning (prevent duplicate writes per invocation)
const _pendingDestLearns = new Set<string>();

function resolveProductDestination(
  raw: any,
  destMap: Record<string, string>,
  syncDestName = ""
): string {
  const dests = raw.destinations || [];
  const unmappedRefs: string[] = [];

  if (Array.isArray(dests) && dests.length > 0) {
    const primary = dests.find((d: any) => d.primary) || dests[0];
    const ref = String(primary?.ref || "");
    if (ref && destMap[ref]) return destMap[ref];
    if (ref && !destMap[ref]) unmappedRefs.push(ref);
    for (const d of dests) {
      const r = String(d?.ref || "");
      if (r && destMap[r]) return destMap[r];
      if (r && !destMap[r] && !unmappedRefs.includes(r)) unmappedRefs.push(r);
    }
  }

  // Resolve city from product's own data (location, logistics, title)
  const cityFromLocation = raw.location?.address?.city || raw.destination?.name || "";
  const cityFromLogistics = raw.logistics?.start?.[0]?.location?.address?.city || "";
  const resolvedCity = cityFromLocation || cityFromLogistics || "";

  // AUTO-LEARN: If we found unmapped dest refs AND we can resolve a city, persist the mapping
  if (unmappedRefs.length > 0 && resolvedCity) {
    for (const ref of unmappedRefs) {
      if (!_pendingDestLearns.has(ref)) {
        _pendingDestLearns.add(ref);
        // Fire-and-forget: persist to viator_destination_map + update in-memory cache
        const countryFromLocation = raw.location?.address?.country || "";
        try {
          const sb = getSupabaseAdmin();
          sb.from("viator_destination_map").upsert({
            dest_id: ref,
            city_name: resolvedCity,
            country: countryFromLocation,
            dest_type: "CITY",
            auto_learned: true,
          }, { onConflict: "dest_id" }).then(() => {
            console.log(`[dest-learn] ✅ Auto-learned: dest_id ${ref} → "${resolvedCity}" (${countryFromLocation})`);
          });
          // Update in-memory cache immediately so subsequent products in same batch resolve correctly
          destMap[ref] = resolvedCity;
        } catch (e) {
          console.warn(`[dest-learn] Failed to persist mapping for ${ref}:`, e);
        }
      }
    }
    return resolvedCity;
  }

  if (resolvedCity) return resolvedCity;

  if (syncDestName) {
    const titleLower = (raw.title || "").toLowerCase();
    const syncLower = syncDestName.toLowerCase();
    if (titleLower.includes(syncLower)) return syncDestName;
    // Check if title contains a known destination
    const titleWords = (raw.title || "").split(/[\s,()]+/).filter(Boolean);
    for (const word of titleWords) {
      if (word.length >= 3 && /^[A-Z]/.test(word)) {
        for (const [, name] of Object.entries(destMap)) {
          if (name.toLowerCase() === word.toLowerCase()) return name;
        }
      }
    }
    return syncDestName;
  }
  return "";
}

// ── Response Helpers ──
// Wire supplier-name mask. Replaces known supplier identifiers in `source` /
// `api_source` fields with opaque codes so network payloads do not leak
// provider identity. The frontend hydrates these back via
// src/lib/tourWireAdapter.ts.
const TOUR_SOURCE_TO_CODE: Record<string, string> = {
  viator: "ta",
  experience: "tx",
  db: "td",
  cache: "tk",
  local: "tl",
};
function maskTourSourceValue(v: any): any {
  if (typeof v !== "string") return v;
  return TOUR_SOURCE_TO_CODE[v] || v;
}
function maskTourWire(node: any): any {
  if (node === null || typeof node !== "object") return node;
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) node[i] = maskTourWire(node[i]);
    return node;
  }
  for (const k of Object.keys(node)) {
    if (k === "source" || k === "api_source") {
      node[k] = maskTourSourceValue(node[k]);
    } else if (typeof node[k] === "object") {
      node[k] = maskTourWire(node[k]);
    }
  }
  return node;
}

function json(data: any, status = 200) {
  const masked = maskTourWire(data);
  return new Response(JSON.stringify(masked), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}


// ── MD5-based vela_id (matches Postgres generate_vela_id) ──
function computeVelaId(pc: string): string {
  let h0=0x67452301,h1=0xEFCDAB89,h2=0x98BADCFE,h3=0x10325476;
  const bs:number[]=[]; for(let i=0;i<pc.length;i++) bs.push(pc.charCodeAt(i));
  bs.push(0x80); while(bs.length%64!==56) bs.push(0);
  const bl=pc.length*8; bs.push(bl&0xff,(bl>>8)&0xff,(bl>>16)&0xff,(bl>>24)&0xff,0,0,0,0);
  const w:number[]=[]; for(let i=0;i<bs.length;i+=4) w.push(bs[i]|(bs[i+1]<<8)|(bs[i+2]<<16)|(bs[i+3]<<24));
  const ad=(a:number,b:number)=>{const l=(a&0xffff)+(b&0xffff);return(((a>>16)+(b>>16)+(l>>16))<<16)|(l&0xffff);};
  const rl=(n:number,c:number)=>(n<<c)|(n>>>(32-c));
  const cm=(q:number,a:number,b:number,x:number,s:number,t:number)=>ad(rl(ad(ad(a,q),ad(x,t)),s),b);
  const ff=(a:number,b:number,c:number,d:number,x:number,s:number,t:number)=>cm((b&c)|(~b&d),a,b,x,s,t);
  const gg=(a:number,b:number,c:number,d:number,x:number,s:number,t:number)=>cm((b&d)|(c&~d),a,b,x,s,t);
  const hh=(a:number,b:number,c:number,d:number,x:number,s:number,t:number)=>cm(b^c^d,a,b,x,s,t);
  const ii=(a:number,b:number,c:number,d:number,x:number,s:number,t:number)=>cm(c^(b|~d),a,b,x,s,t);
  for(let i=0;i<w.length;i+=16){
    let a=h0,b=h1,c=h2,d=h3;
    a=ff(a,b,c,d,w[i],7,-680876936);d=ff(d,a,b,c,w[i+1],12,-389564586);c=ff(c,d,a,b,w[i+2],17,606105819);b=ff(b,c,d,a,w[i+3],22,-1044525330);
    a=ff(a,b,c,d,w[i+4],7,-176418897);d=ff(d,a,b,c,w[i+5],12,1200080426);c=ff(c,d,a,b,w[i+6],17,-1473231341);b=ff(b,c,d,a,w[i+7],22,-45705983);
    a=ff(a,b,c,d,w[i+8],7,1770035416);d=ff(d,a,b,c,w[i+9],12,-1958414417);c=ff(c,d,a,b,w[i+10],17,-42063);b=ff(b,c,d,a,w[i+11],22,-1990404162);
    a=ff(a,b,c,d,w[i+12],7,1804603682);d=ff(d,a,b,c,w[i+13],12,-40341101);c=ff(c,d,a,b,w[i+14],17,-1502002290);b=ff(b,c,d,a,w[i+15],22,1236535329);
    a=gg(a,b,c,d,w[i+1],5,-165796510);d=gg(d,a,b,c,w[i+6],9,-1069501632);c=gg(c,d,a,b,w[i+11],14,643717713);b=gg(b,c,d,a,w[i],20,-373897302);
    a=gg(a,b,c,d,w[i+5],5,-701558691);d=gg(d,a,b,c,w[i+10],9,38016083);c=gg(c,d,a,b,w[i+15],14,-660478335);b=gg(b,c,d,a,w[i+4],20,-405537848);
    a=gg(a,b,c,d,w[i+9],5,568446438);d=gg(d,a,b,c,w[i+14],9,-1019803690);c=gg(c,d,a,b,w[i+3],14,-187363961);b=gg(b,c,d,a,w[i+8],20,1163531501);
    a=gg(a,b,c,d,w[i+13],5,-1444681467);d=gg(d,a,b,c,w[i+2],9,-51403784);c=gg(c,d,a,b,w[i+7],14,1735328473);b=gg(b,c,d,a,w[i+12],20,-1926607734);
    a=hh(a,b,c,d,w[i+5],4,-378558);d=hh(d,a,b,c,w[i+8],11,-2022574463);c=hh(c,d,a,b,w[i+11],16,1839030562);b=hh(b,c,d,a,w[i+14],23,-35309556);
    a=hh(a,b,c,d,w[i+1],4,-1530992060);d=hh(d,a,b,c,w[i+4],11,1272893353);c=hh(c,d,a,b,w[i+7],16,-155497632);b=hh(b,c,d,a,w[i+10],23,-1094730640);
    a=hh(a,b,c,d,w[i+13],4,681279174);d=hh(d,a,b,c,w[i],11,-358537222);c=hh(c,d,a,b,w[i+3],16,-722521979);b=hh(b,c,d,a,w[i+6],23,76029189);
    a=hh(a,b,c,d,w[i+9],4,-640364487);d=hh(d,a,b,c,w[i+12],11,-421815835);c=hh(c,d,a,b,w[i+15],16,530742520);b=hh(b,c,d,a,w[i+2],23,-995338651);
    a=ii(a,b,c,d,w[i],6,-198630844);d=ii(d,a,b,c,w[i+7],10,1126891415);c=ii(c,d,a,b,w[i+14],15,-1416354905);b=ii(b,c,d,a,w[i+5],21,-57434055);
    a=ii(a,b,c,d,w[i+12],6,1700485571);d=ii(d,a,b,c,w[i+3],10,-1894986606);c=ii(c,d,a,b,w[i+10],15,-1051523);b=ii(b,c,d,a,w[i+1],21,-2054922799);
    a=ii(a,b,c,d,w[i+8],6,1873313359);d=ii(d,a,b,c,w[i+15],10,-30611744);c=ii(c,d,a,b,w[i+6],15,-1560198380);b=ii(b,c,d,a,w[i+13],21,1309151649);
    a=ii(a,b,c,d,w[i+4],6,-145523070);d=ii(d,a,b,c,w[i+11],10,-1120210379);c=ii(c,d,a,b,w[i+2],15,718787259);b=ii(b,c,d,a,w[i+9],21,-343485551);
    h0=ad(h0,a);h1=ad(h1,b);h2=ad(h2,c);h3=ad(h3,d);
  }
  const hx=(n:number)=>{let s='';for(let j=0;j<4;j++) s+=('0'+((n>>(j*8))&0xff).toString(16)).slice(-2);return s;};
  return(hx(h0)+hx(h1)+hx(h2)+hx(h3)).slice(0,7);
}

// ── Slug Generator (clean — appends vela_id for uniqueness) ──
function generateTourSlug(title: string, destination: string, productCode?: string): string {
  const base = `${title.trim()}-${destination.trim()}`
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  const truncated = base.slice(0, 112).replace(/-$/, '');
  if (productCode) {
    return `${truncated}-${computeVelaId(productCode)}`;
  }
  return truncated;
}

// ── Exchange Rates ──
type ExchangeRates = { rates: Record<string, number>; markup: number; };

// Mutable shared rates object — gets enriched at runtime when unknown currencies appear
let _sharedRates: Record<string, number> | null = null;

async function getExchangeRates(): Promise<ExchangeRates> {
  const defaultRates: ExchangeRates = {
    rates: { USD: 1, EUR: 0.86, GBP: 0.75, BDT: 122.3, CNY: 6.92, INR: 92.1, THB: 31.65, MYR: 3.94, SGD: 1.28, JPY: 157.7, SEK: 9.5, DKK: 6.45, NOK: 10.2, FJD: 2.15, KRW: 1477, AUD: 1.42, NZD: 1.7, HKD: 7.8, CAD: 1.37, CHF: 0.82, TWD: 30.5, ZAR: 17.5, BRL: 5.7, AED: 3.67, SAR: 3.75, QAR: 3.64, OMR: 0.385, KWD: 0.31, BHD: 0.377, PHP: 56.2, IDR: 15700, VND: 25300, CZK: 22.5, PLN: 3.95, HUF: 355, RON: 4.57, BGN: 1.79, TRY: 32.5, RUB: 92, EGP: 48.5, PKR: 280, LKR: 300, NPR: 133, MMK: 2100, KHR: 4100, LAK: 21000, MOP: 8.1, MVR: 15.4, PGK: 3.85, WST: 2.75, TOP: 2.36, VUV: 119, SBD: 8.5, XPF: 109.5, CLP: 950, COP: 4200, PEN: 3.72, ARS: 870, UYU: 39, BOB: 6.9, PYG: 7300, CRC: 510, GTQ: 7.8, HNL: 24.7, NIO: 36.7, DOP: 58.5, JMD: 156, TTD: 6.8, BBD: 2, BSD: 1, BZD: 2, GYD: 209, SRD: 36, XCD: 2.7, AWG: 1.79, ANG: 1.79, HTG: 132, KYD: 0.83, BMD: 1 },
    markup: 2,
  };
  try {
    const sb = getSupabaseAdmin();
    const { data } = await sb.from("api_settings").select("settings").eq("provider", "currency_rates").maybeSingle();
    if (data?.settings) {
      const s = data.settings as any;
      const rates = { ...defaultRates.rates, ...(s.live_rates || {}) };
      _sharedRates = rates;
      return { rates, markup: s.conversion_markup ?? 2 };
    }
  } catch (e) { console.warn("[unified-tour-search] exchange rates error:", e); }
  _sharedRates = defaultRates.rates;
  return defaultRates;
}

// In-flight fetch promises to prevent duplicate API calls for the same currency
const _pendingRateFetches = new Map<string, Promise<number | null>>();

/**
 * Fetch a single missing exchange rate from a free API and persist it.
 * Returns the rate relative to USD, or null on failure.
 */
async function fetchMissingRate(currency: string): Promise<number | null> {
  const upper = currency.toUpperCase();
  if (_pendingRateFetches.has(upper)) return _pendingRateFetches.get(upper)!;

  const promise = (async () => {
    try {
      // Try exchangerate.host (free, no key)
      const res = await fetch(`https://open.er-api.com/v6/latest/USD`, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const data = await res.json();
        const rate = data?.rates?.[upper];
        if (rate && rate > 0) {
          console.log(`[currency] ✅ Fetched live rate: 1 USD = ${rate} ${upper}`);
          // Persist to shared rates so subsequent calls don't re-fetch
          if (_sharedRates) _sharedRates[upper] = rate;
          // Also persist to DB for future invocations
          try {
            const sb = getSupabaseAdmin();
            const { data: existing } = await sb.from("api_settings").select("settings").eq("provider", "currency_rates").maybeSingle();
            if (existing?.settings) {
              const s = existing.settings as any;
              const updatedRates = { ...(s.live_rates || {}), [upper]: rate };
              await sb.from("api_settings").update({ settings: { ...s, live_rates: updatedRates } }).eq("provider", "currency_rates");
              console.log(`[currency] 💾 Persisted ${upper} rate to api_settings`);
            }
          } catch (persistErr) {
            console.warn(`[currency] Failed to persist ${upper} rate:`, persistErr);
          }
          return rate;
        }
      }
    } catch (e) {
      console.warn(`[currency] Failed to fetch rate for ${upper}:`, e);
    }
    return null;
  })();

  _pendingRateFetches.set(upper, promise);
  const result = await promise;
  _pendingRateFetches.delete(upper);
  return result;
}

async function convertPriceAsync(price: number, from: string, to: string, rates: Record<string, number>, markup: number): Promise<number> {
  if (from === to || price <= 0) return Math.round(price);
  let srcRate = rates[from];
  let dstRate = rates[to];

  // If source currency is missing, fetch it live
  if (!srcRate || srcRate <= 0) {
    console.warn(`[currency] ⚠️ Missing rate for "${from}" — fetching live...`);
    const fetched = await fetchMissingRate(from);
    srcRate = fetched ?? 1;
  }
  if (!dstRate || dstRate <= 0) {
    console.warn(`[currency] ⚠️ Missing rate for "${to}" — fetching live...`);
    const fetched = await fetchMissingRate(to);
    dstRate = fetched ?? 1;
  }

  return Math.round((price / srcRate) * dstRate * (1 + markup / 100));
}

function convertPrice(price: number, from: string, to: string, rates: Record<string, number>, markup: number): number {
  if (from === to || price <= 0) return Math.round(price);
  // Use _sharedRates as authoritative source (enriched with live fetches)
  const allRates = _sharedRates || rates;
  const srcRate = allRates[from] || allRates[from.toUpperCase()] || rates[from] || rates[from.toUpperCase()];
  const dstRate = allRates[to] || allRates[to.toUpperCase()] || rates[to] || rates[to.toUpperCase()];
  if (!srcRate || srcRate <= 0) {
    console.warn(`[currency] ❌ No rate for source "${from}" — returning unconverted price ${price}`);
    return Math.round(price);
  }
  if (!dstRate || dstRate <= 0) {
    console.warn(`[currency] ❌ No rate for target "${to}" — returning unconverted price ${price}`);
    return Math.round(price);
  }
  return Math.round((price / srcRate) * dstRate * (1 + markup / 100));
}

/** Extract max group size from ageBands array */
function extractMaxGroupSize(ageBands: any[]): number | null {
  if (!Array.isArray(ageBands) || ageBands.length === 0) return null;
  let max = 0;
  for (const band of ageBands) {
    const m = band.maxTravelersPerBooking ?? band.max_travelers_per_booking;
    if (typeof m === "number" && m > max) max = m;
  }
  return max > 0 ? max : null;
}

function resolveTagHighlights(tags: any[], tagMap: Record<number, string>): string[] {
  if (!tags?.length) return [];
  return tags
    .map((t: any) => {
      if (typeof t === "string" && t && isNaN(Number(t))) return t;
      const id = t?.tagId || (typeof t === "number" ? t : null);
      if (id && tagMap[id]) return tagMap[id];
      if (t?.tagName && typeof t.tagName === "string") return t.tagName;
      return "";
    })
    .filter((h: string) => h && isNaN(Number(h)) && true)
    .slice(0, 5);
}


// ── Category Definitions (tagIds) ──
const CATEGORY_TAG_MAP: Record<string, number[]> = {
  tickets: [21972, 11889, 12716], // Tickets & Passes, Attraction Tickets
  tours: [21510, 11873, 21503],   // Guided Tours, Tours, Walking Tours
  transfers: [11881, 21885],      // Transfers, Airport Transfers
  food: [12718, 21911, 21917],    // Food Tours, Wine, Culinary
  adventure: [21880, 11874, 21879], // Adventure, Outdoor, Extreme Sports
  cruises: [11876, 21866],        // Cruises, Boat Tours
  culture: [21511, 21512, 21513], // Art & Culture, Historical, Museums
  nightlife: [21874, 21875],      // Nightlife, Bars
};


// ═══════════════════════════════════════════════════════════
// ── BACKGROUND SYNC TRIGGERS ──
// ═══════════════════════════════════════════════════════════

/** Directly update tour_sync_state when user searches — no more fire-and-forget cross-function calls */
async function recordSearchHitInline(destinationId: string, destinationName: string, productCount: number) {
  try {
    const sb = getSupabaseAdmin();
    const now = new Date().toISOString();

    // Try matching by destination_id first, then fallback to destination_name
    let existing: any = null;
    let matchField = "destination_id";
    let matchValue = String(destinationId);

    const { data: byId } = await sb
      .from("tour_sync_state")
      .select("destination_id, search_hit_count, status, total_products_found")
      .eq("destination_id", String(destinationId))
      .maybeSingle();

    if (byId) {
      existing = byId;
    } else if (destinationName) {
      // Fallback: match by name (freetext API may return different IDs)
      const { data: byName } = await sb
        .from("tour_sync_state")
        .select("destination_id, search_hit_count, status, total_products_found")
        .ilike("destination_name", destinationName.trim())
        .maybeSingle();
      if (byName) {
        existing = byName;
        matchField = "destination_id";
        matchValue = byName.destination_id;
      }
    }

    if (existing) {
      const updates: any = {
        search_hit_count: (existing.search_hit_count || 0) + 1,
        last_search_hit_at: now,
        updated_at: now,
        priority: Math.max(existing.priority || 0, 100), // boost priority on user search
      };
      // If still pending and we got products from live search, mark as syncing
      if (existing.status === "pending" && productCount > 0) {
        updates.status = "syncing";
        updates.total_products_found = Math.max(existing.total_products_found || 0, productCount);
        updates.started_at = now;
      }
      await sb.from("tour_sync_state").update(updates).eq(matchField, matchValue);
    } else {
      // New destination — only create entry if destinationId is a valid numeric Viator ID
      // Text-based IDs (e.g. "Singapore tours experiences") cause BAD_REQUEST errors in sync
      const isNumericId = /^\d+$/.test(String(destinationId));
      if (isNumericId) {
        await sb.from("tour_sync_state").upsert({
          destination_id: String(destinationId),
          destination_name: destinationName || "",
          search_hit_count: 1,
          last_search_hit_at: now,
          status: productCount > 0 ? "syncing" : "pending",
          priority: 100,
          total_products_found: productCount,
          started_at: productCount > 0 ? now : null,
        }, { onConflict: "destination_id" });
      } else {
        console.log(`[sync] Skipping non-numeric destination_id "${destinationId}" — won't create sync entry`);
      }
    }
    console.log(`[sync] Recorded search hit for ${destinationName} (${destinationId}), products=${productCount}, matched=${existing ? "existing" : "new"}`);
  } catch (e) {
    console.warn("[sync] Error recording search hit:", e);
  }
}

/** Fire-and-forget: sync attractions for a city if not already in our DB */
async function triggerAttractionSync(cityName: string) {
  if (!cityName) return;
  try {
    const sb = getSupabaseAdmin();
    // Check if city already has attractions synced
    const { count } = await sb
      .from("attractions")
      .select("*", { count: "exact", head: true })
      .ilike("city", cityName);

    if ((count || 0) >= 5) return; // Already has enough attractions

    // Check if city is already queued for sync
    const { data: syncState } = await sb
      .from("attraction_sync_state")
      .select("status")
      .ilike("city", cityName)
      .maybeSingle();

    if (syncState?.status === "completed" || syncState?.status === "syncing") return;

    // Trigger OSM attractions sync for this city
    const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/osm-attractions-sync`;
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({ action: "sync-city", city: cityName }),
    }).catch(() => {});
    console.log(`[auto-sync] Triggered attraction sync for ${cityName}`);
  } catch (e) {
    console.warn("[auto-sync] Attraction sync trigger error:", e);
  }
}

// ═══════════════════════════════════════════════════════════
// ── CACHING LAYER ──
// ═══════════════════════════════════════════════════════════


async function cacheSearchResults(
  cacheKey: string, searchQuery: string, products: any[], currency: string, provider = "viator",
  destinationFallback?: string
) {
  try {
    const sb = getSupabaseAdmin();
    const productCodes = products.map(p => p.productCode).filter(Boolean);

    await sb.from("tour_search_cache").upsert({
      cache_key: cacheKey,
      search_query: searchQuery,
      result_count: products.length,
      product_codes: productCodes,
      results: products,
      currency, provider,
      expires_at: new Date(Date.now() + 6 * 3600_000).toISOString(),
    }, { onConflict: "cache_key" });

    // Only cache products that are NOT already detail-fetched (don't overwrite full data with search snippets)
    const { data: alreadyDetailed } = await sb
      .from("tour_product_cache")
      .select("product_code")
      .in("product_code", productCodes)
      .eq("provider", provider)
      .eq("detail_fetched", true);

    const detailedSet = new Set((alreadyDetailed || []).map(r => r.product_code));

    const productRows = products
      .filter(p => p.productCode && !detailedSet.has(p.productCode) && (p.price || 0) > 0 && p.destination) // Skip $0 products and products without a destination
      .map(p => ({
        product_code: p.productCode,
        provider,
        // IMPORTANT: Only use product's own destination — never blindly assign the search query
        // as destination. A search for "Singapore" can return Miami products from Viator's freetext API.
        destination: p.destination || "",
        title: p.name || "",
        short_description: p.shortDescription || "",
        price: p.price || 0,
        currency, pricing_type: p.pricingType || "PER_PERSON",
        rating: p.rating || 0, review_count: p.reviewCount || 0,
        duration: p.duration || "",
        image_url: p.image || "",
        category: p.category || "",
        highlights: p.highlights || [],
        age_bands: p.ageBands || [],
        product_data: p,
        images: p.images || [],
        tags: p.highlights || [],
        slug: generateTourSlug(p.name || "", p.destination || destinationFallback || searchQuery || "", p.productCode),
        detail_fetched: false, // Mark as NOT fully synced — background will fetch full details
        cached_at: new Date().toISOString(),
      }));

    if (productRows.length > 0) {
      for (let i = 0; i < productRows.length; i += 50) {
        await sb.from("tour_product_cache").upsert(
          productRows.slice(i, i + 50),
          { onConflict: "product_code,provider" }
        );
      }

      // Also inject unfetched product codes into the destination's sync queue
      // so the cron detail-fetcher picks them up even if from a different search
      const unfetchedCodes = productRows.map(p => p.product_code);
      const destName = destinationFallback || searchQuery || "";
      if (destName && unfetchedCodes.length > 0) {
        const { data: syncState } = await sb
          .from("tour_sync_state")
          .select("destination_id, product_codes_pending, product_codes_done")
          .ilike("destination_name", destName.trim())
          .maybeSingle();
        
        if (syncState) {
          const existingPending = new Set(syncState.product_codes_pending || []);
          const existingDone = new Set(syncState.product_codes_done || []);
          const newCodes = unfetchedCodes.filter(c => !existingPending.has(c) && !existingDone.has(c));
          if (newCodes.length > 0) {
            const updatedPending = [...(syncState.product_codes_pending || []), ...newCodes];
            await sb.from("tour_sync_state")
              .update({ product_codes_pending: updatedPending, updated_at: new Date().toISOString() })
              .eq("destination_id", syncState.destination_id);
            console.log(`[cache] Injected ${newCodes.length} unfetched codes into ${destName} sync queue`);
          }
        }
      }
    }
    console.log(`[cache] Stored ${productRows.length} new products, ${detailedSet.size} already detailed (dest=${destinationFallback || searchQuery}), key=${cacheKey}`);

    // Background sync handled by tour-inventory-sync cron
  } catch (e) {
    console.warn("[cache] Error caching search results:", e);
  }
}

async function getCachedSearch(cacheKey: string): Promise<any[] | null> {
  try {
    const sb = getSupabaseAdmin();
    const { data } = await sb
      .from("tour_search_cache")
      .select("results, currency")
      .eq("cache_key", cacheKey)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (data?.results) {
      console.log(`[cache] Hit for search key=${cacheKey}`);
      return data.results as any[];
    }
  } catch (e) { console.warn("[cache] getCachedSearch error:", e); }
  return null;
}

async function getCachedProduct(productCode: string, provider = "viator"): Promise<any | null> {
  try {
    const sb = getSupabaseAdmin();
    const { data } = await sb
      .from("tour_product_cache")
      .select("product_data, price, currency, cached_at, detail_fetched, pricing_type, age_bands")
      .eq("product_code", productCode)
      .eq("provider", provider)
      .maybeSingle();
    if (data) {
      console.log(`[cache] Product hit: ${productCode} (detail_fetched=${data.detail_fetched})`);
      return {
        ...data.product_data,
        _cachedPrice: data.price,
        _cachedCurrency: data.currency,
        _cachedAt: data.cached_at,
        _detailFetched: data.detail_fetched,
        _pricingType: data.pricing_type,
        _ageBands: data.age_bands,
      };
    }
  } catch (e) { console.warn("[cache] getCachedProduct error:", e); }
  return null;
}

async function cacheProductDetail(productCode: string, product: any, currency: string, provider = "viator") {
  try {
    const sb = getSupabaseAdmin();
    const images = (product.images || []).map((img: any) => {
      const variants = img.variants || [];
      const best = variants.reduce((a: any, b: any) => ((b.width || 0) > (a.width || 0) ? b : a), variants[0] || {});
      return best.url || "";
    }).filter(Boolean);

    // Extract price — prefer schedule pricing (always has correct currency), then main price, then ageBands
    let price = 0;
    let priceCurrency = currency; // default to the fetch currency passed in

    // 1. Try schedule pricing first (most reliable source with correct currency)
    if (product._schedulePricing?.optionPricing) {
      const opts = Object.values(product._schedulePricing.optionPricing) as Array<{ fromPrice: number; currency: string }>;
      let lowestOpt = { price: 0, currency: currency };
      for (const o of opts) {
        if (o.fromPrice > 0 && (lowestOpt.price === 0 || o.fromPrice < lowestOpt.price)) {
          lowestOpt = { price: o.fromPrice, currency: o.currency || currency };
        }
      }
      if (lowestOpt.price > 0) {
        price = lowestOpt.price;
        priceCurrency = lowestOpt.currency;
      }
    }

    // 2. Fallback to main pricing summary
    if (price === 0) {
      price = product.pricing?.summary?.fromPrice || product.pricing?.fromPrice || product.price || 0;
      priceCurrency = product.pricing?.currency || currency;
    }

    // 3. Last resort: ageBands
    if (price === 0 && product.pricingInfo?.ageBands?.length) {
      for (const band of product.pricingInfo.ageBands) {
        const bp = band.prices?.fromPrice ?? band.retailPrice ?? band.price ?? 0;
        if (bp > 0 && (price === 0 || bp < price)) price = bp;
      }
      priceCurrency = product.pricingInfo?.currency || currency;
    }

    await sb.from("tour_product_cache").upsert({
      product_code: productCode,
      provider,
      destination: resolveProductDestination(product, await getDestIdToNameMap()),
      title: product.title || "",
      short_description: product.shortDescription || product.description?.substring(0, 300) || "",
      price,
      currency: priceCurrency,
      pricing_type: product.pricing?.pricingType || product.pricingType || "PER_PERSON",
      rating: product.reviews?.combinedAverageRating || product.rating || 0,
      review_count: product.reviews?.totalReviews || product.reviewCount || 0,
      duration: product.duration?.fixedDurationInMinutes
        ? `${Math.floor(product.duration.fixedDurationInMinutes / 60)}h${product.duration.fixedDurationInMinutes % 60 > 0 ? ` ${product.duration.fixedDurationInMinutes % 60}m` : ""}`
        : product.duration || "",
      image_url: images[0] || product.images?.[0]?.variants?.[0]?.url || "",
      images,
      category: "",
      highlights: (product.inclusions || []).map((inc: any) => inc.otherDescription || inc.typeDescription || "").filter(Boolean).slice(0, 10),
      age_bands: product.pricingInfo?.ageBands || product.ageBands || [],
      product_data: product,
      tags: (product.tags || []).map((t: any) => t?.tagId?.toString() || t?.tagName || "").filter(Boolean),
      slug: generateTourSlug(product.title || "", product.destination?.name || product.location?.address?.city || "", productCode),
      detail_fetched: true,
      is_active: price > 0, // Only active if we have a real price
      last_verified_at: new Date().toISOString(),
      cached_at: new Date().toISOString(),
    }, { onConflict: "product_code,provider" });
    console.log(`[cache] Product cached: ${productCode} (price=${price} ${currency})`);
  } catch (e) { console.warn("[cache] cacheProductDetail error:", e); }
}

// ═══════════════════════════════════════════════════════════════════
// ── SMART SEARCH ENGINE v4 ──
// Single entry point for ALL search consumers (Tours page, AI planner, API)
//
// Strategy:
//   Phase 1 — Check learning cache (instant, zero DB scan)
//   Phase 2 — Fetch lightweight candidates from destination (NO product_data)
//   Phase 3 — Load product_data ONLY for top candidates, deep-score
//   Phase 4 — Learn: save results so next identical search is instant
// ═══════════════════════════════════════════════════════════════════

const SMART_SEARCH_CACHE_TTL_MS = 30 * 60_000; // 30 min

/**
 * Unified smart search — the ONLY search function everything calls.
 * Works identically for Tours page, AI trip planner, and tenant API.
 */
async function smartSearch(
  searchText: string,
  targetCurrency: string,
  options: {
    limit?: number;
    sortOrder?: string;
    minRating?: number;
    priceRange?: { min?: number; max?: number };
    destinationCity?: string; // NEW: restrict candidates to this city/metro area
  } = {}
): Promise<any[] | null> {
  const sb = getSupabaseAdmin();
  const { limit = 50, sortOrder, minRating, priceRange, destinationCity } = options;

  // Parse search terms: "little india, chinatown" → ["little india", "chinatown"]
  const rawTerms = searchText.split(/[,;|]+/).map(t => cleanSearchText(t).toLowerCase()).filter(t => t.length >= 2);
  if (rawTerms.length === 0) return null;
  const strictIdentity = getStrictIdentityContext(searchText, destinationCity);
  if (strictIdentity.strict) {
    console.log(`[smart-search] Strict identity query preserved: "${searchText}" (identity=${strictIdentity.nonCityTokens.join(" ")}, city=${destinationCity || "embedded"})`);
  }

  // ── No normalization — preserve exact AI-generated search titles ──
  // rawTerms are used as-is for both candidate fetching and scoring
  const searchTermsForCandidates = [...rawTerms];

  const cacheKey = `smart:${rawTerms.join("|")}:${targetCurrency}`;

  // ── PHASE 1: Learning cache lookup (instant) ──
  try {
    const { data: cached } = await sb
      .from("tour_search_cache")
      .select("product_codes, results, created_at")
      .eq("cache_key", cacheKey)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (cached?.results) {
      let products = cached.results as any[];

      if (strictIdentity.strict) {
        console.log(`[smart-search] STRICT IDENTITY BYPASS "${searchText}" → skipping learned cache (${products.length} products) for exact rescoring`);
      } else {
        // ── Post-cache relevance re-scoring ──
        // Re-compute _queryRelevance on cached results to apply tighter filtering
        // (handles cases where cache was built before option-aware scoring was added)
        if (destinationCity && products.length > 3) {
          const sNormC = searchText.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
          const sTokensC = sNormC.split(" ").filter((w: string) => w.length > 2);
          if (sTokensC.length >= 2) {
            for (const p of products) {
              const pTitle = (p.name || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ");
              const pTokensC = new Set(pTitle.split(/\s+/).filter((w: string) => w.length > 2));
              // Build supplementary text from matched option + highlights + shortDescription
              const suppParts = [
                p._matchedOption?.optionName || "",
                ...(Array.isArray(p.highlights) ? p.highlights.map(String) : []),
                p.shortDescription || "",
              ].join(" ").toLowerCase().replace(/[^a-z0-9\s]/g, " ");
              const suppTokensC = new Set(suppParts.split(/\s+/).filter((w: string) => w.length > 2));
              let hits = 0;
              for (const t of sTokensC) {
                if (pTokensC.has(t)) hits += 1;
                else if (suppTokensC.has(t)) hits += 0.85;
                else {
                  let found = false;
                  for (const pt of pTokensC) {
                    if (pt.length >= 4 && t.length >= 4 && (pt.includes(t) || t.includes(pt))) { hits += 0.6; found = true; break; }
                  }
                  if (!found) {
                    for (const st of suppTokensC) {
                      if (st.length >= 4 && t.length >= 4 && (st.includes(t) || t.includes(st))) { hits += 0.5; break; }
                    }
                  }
                }
              }
              p._queryRelevance = Math.max(0, Math.round(Math.min(1.0, hits / sTokensC.length) * 85 + 15));
            }
            // Dynamic gap cutoff on cached results
            const topRel = Math.max(...products.map((p: any) => p._queryRelevance || 0));
            if (topRel >= 70) {
              const floor = Math.max(55, topRel - 15);
              const tight = products.filter((p: any) => (p._queryRelevance || 0) >= floor);
              if (tight.length >= 1) {
                console.log(`[smart-search] Cache post-filter: top=${topRel}, floor=${floor}, ${products.length} → ${tight.length}`);
                products = tight;
              }
            }
          }
        }

        if (minRating && minRating > 0) products = products.filter(p => (p.rating || 0) >= minRating);
        if (priceRange?.min) products = products.filter(p => (p.price || 0) >= priceRange.min!);
        if (priceRange?.max) products = products.filter(p => (p.price || 0) <= priceRange.max!);
        if (sortOrder === "PRICE") products.sort((a, b) => a.price - b.price);
        else if (sortOrder === "TRAVELER_RATING") products.sort((a, b) => (b.rating || 0) - (a.rating || 0));

        console.log(`[smart-search] CACHE HIT "${searchText}" → ${products.length} products (instant)`);
        return products.slice(0, limit);
      }
    }
  } catch (e) { /* cache miss, continue */ }

  // ── PHASE 2: Fetch lightweight candidates (NO product_data — saves memory) ──
  const lightCols = "product_code, title, price, currency, rating, review_count, image_url, images, duration, category, short_description, destination, pricing_type, highlights, tags, places_covered, vela_id, slug";

  const candidateCodes = new Set<string>();
  const candidateMap = new Map<string, any>();

  const addCandidates = (rows: any[] | null) => {
    if (!rows) return;
    for (const r of rows) {
      if (r.product_code && !candidateCodes.has(r.product_code)) {
        candidateCodes.add(r.product_code);
        candidateMap.set(r.product_code, r);
      }
    }
  };

  // ── Destination filter: restrict candidates to a specific city/metro area ──
  // When destinationCity is provided (e.g., from match engine), build OR filters
  // for the city and its known metro sub-destinations.
  const METRO_ALIASES: Record<string, string[]> = {
    singapore: ["sentosa", "sentosa island", "jurong", "changi", "marina bay", "orchard"],
    "kuala lumpur": ["genting", "genting highlands", "putrajaya", "batu caves", "petaling jaya", "shah alam", "cyberjaya", "sepang"],
    langkawi: ["langkawi island", "kedah"],
    penang: ["penang island", "george town", "georgetown", "butterworth", "batu ferringhi"],
    bangkok: ["pattaya", "ayutthaya", "kanchanaburi"],
    bali: ["ubud", "seminyak", "kuta", "nusa dua", "sanur", "canggu", "uluwatu"],
    tokyo: ["yokohama", "kamakura", "hakone", "nikko"],
    london: ["windsor", "stonehenge", "bath", "oxford", "cambridge"],
    paris: ["versailles", "giverny", "disneyland paris"],
    dubai: ["abu dhabi", "sharjah", "ajman"],
    istanbul: ["cappadocia", "ephesus"],
    seoul: ["incheon", "suwon", "nami island"],
    "hong kong": ["macau", "lantau"],
    delhi: ["agra", "jaipur"],
    mumbai: ["pune", "lonavala"],
    hanoi: ["ha long", "halong", "ninh binh", "sapa"],
    "ho chi minh": ["cu chi", "mekong delta"],
    jakarta: ["bandung", "bogor"],
    phuket: ["phi phi", "james bond island", "krabi"],
    "chiang mai": ["chiang rai", "doi suthep"],
    cairo: ["giza", "luxor", "aswan"],
    rome: ["vatican", "pompeii", "florence"],
    barcelona: ["montserrat"],
    lisbon: ["sintra", "cascais"],
    athens: ["santorini", "mykonos"],
    penang: ["george town", "georgetown", "batu ferringhi", "batu ferringi"],
    "george town": ["penang"],
    langkawi: ["kuah", "cenang"],
    "kuala lumpur": ["kl", "klcc", "genting highlands", "putrajaya", "batu caves"],
  };

  let destFilterClause = "";
  if (destinationCity) {
    const cityLower = destinationCity.toLowerCase().trim();
    const destNames = [cityLower, ...(METRO_ALIASES[cityLower] || [])];
    // Also check if cityLower is a sub-destination → include parent metro
    for (const [metro, subs] of Object.entries(METRO_ALIASES)) {
      if (subs.includes(cityLower) && !destNames.includes(metro)) {
        destNames.push(metro);
        destNames.push(...subs.filter(s => !destNames.includes(s)));
      }
    }
    destFilterClause = destNames.map(d => `destination.ilike.%${d}%`).join(",");
    console.log(`[smart-search] 🎯 Destination filter: ${destinationCity} → ${destNames.length} variants`);
  }

  // Helper: apply destination filter to a query
  const applyDestFilter = (query: any) => {
    if (destFilterClause) {
      return query.or(destFilterClause);
    }
    return query;
  };

  if (strictIdentity.strict) {
    const primaryPhrase = strictIdentity.phrases[0];
    if (primaryPhrase) {
      const primaryPattern = `%${primaryPhrase.split(/\s+/).join("%")}%`;
      let titlePhraseQuery = sb.from("tour_product_cache").select(lightCols)
        .eq("is_active", true).gt("price", 0)
        .ilike("title", primaryPattern);
      titlePhraseQuery = applyDestFilter(titlePhraseQuery);
      const { data: titlePhraseHits } = await titlePhraseQuery.order("review_count", { ascending: false }).limit(120);
      addCandidates(titlePhraseHits);
    }

    if (strictIdentity.identityTokens.length > 0) {
      let titleIdentityQuery = sb.from("tour_product_cache").select(lightCols)
        .eq("is_active", true).gt("price", 0);
      for (const token of strictIdentity.identityTokens.slice(0, 3)) {
        titleIdentityQuery = titleIdentityQuery.ilike("title", `%${token}%`);
      }
      titleIdentityQuery = applyDestFilter(titleIdentityQuery);
      const { data: titleIdentityHits } = await titleIdentityQuery.order("review_count", { ascending: false }).limit(120);
      addCandidates(titleIdentityHits);

      // Pair fallback: if 3+ tokens returned 0, retry with just the top 2 identity tokens
      // Handles AI-generated titles with extra words (e.g., "Zoo Negara National Zoo Malaysia")
      // where the real product title doesn't contain all tokens
      if (candidateCodes.size === 0 && strictIdentity.identityTokens.length >= 3) {
        let pairQuery = sb.from("tour_product_cache").select(lightCols)
          .eq("is_active", true).gt("price", 0);
        for (const token of strictIdentity.identityTokens.slice(0, 2)) {
          pairQuery = pairQuery.ilike("title", `%${token}%`);
        }
        pairQuery = applyDestFilter(pairQuery);
        const { data: pairHits } = await pairQuery.order("review_count", { ascending: false }).limit(80);
        addCandidates(pairHits);
        if (pairHits?.length) {
          console.log(`[smart-search] Strict identity pair fallback "${strictIdentity.identityTokens.slice(0, 2).join(" + ")}" → ${pairHits.length} candidates`);
        }
      }
    }

    if (candidateCodes.size === 0 && primaryPhrase) {
      const primaryPattern = `%${primaryPhrase.split(/\s+/).join("%")}%`;
      let descPhraseQuery = sb.from("tour_product_cache").select(lightCols)
        .eq("is_active", true).gt("price", 0)
        .ilike("short_description", primaryPattern);
      descPhraseQuery = applyDestFilter(descPhraseQuery);
      const { data: descPhraseHits } = await descPhraseQuery.order("review_count", { ascending: false }).limit(80);
      addCandidates(descPhraseHits);
    }

    console.log(`[smart-search] Strict identity seed "${searchText}" → ${candidateCodes.size} candidates`);
  }

  // 2a) Full-term match across title + description + destination
  // Use exact raw terms only — no stripped sub-searches for identity-rich queries
  const orFilters: string[] = [];
  for (const term of searchTermsForCandidates) {
    const words = term.split(/\s+/).filter(w => w.length >= 2);
    if (words.length === 0) continue;
    const pattern = `%${words.join("%")}%`;
    orFilters.push(`title.ilike.${pattern}`);
    orFilters.push(`short_description.ilike.${pattern}`);
    orFilters.push(`destination.ilike.${pattern}`);
  }
  if (orFilters.length > 0) {
    const { data } = await sb.from("tour_product_cache").select(lightCols)
      .eq("is_active", true).gt("price", 0)
      .or(orFilters.join(","))
      .order("review_count", { ascending: false }).limit(500);
    addCandidates(data);
  }

  // 2b) DESTINATION BROADENING — country/city → sub-destinations
  // e.g., "Singapore" → also fetch "Sentosa Island", "Pulau Ubin"
  // e.g., "Malaysia" → fetch "Kuala Lumpur", "Langkawi", "Penang", etc.
  for (const term of rawTerms) {
    const destInfo = await isKnownDestination(term);
    if (destInfo.isCountry && destInfo.cities?.length) {
      // Country search: fetch products from ALL cities in that country
      const cityFilters = destInfo.cities.slice(0, 30).map(c => `destination.ilike.%${c}%`);
      const { data } = await sb.from("tour_product_cache").select(lightCols)
        .eq("is_active", true).gt("price", 0)
        .or(cityFilters.join(","))
        .order("review_count", { ascending: false }).limit(500);
      addCandidates(data);
      console.log(`[smart-search] Country broadening "${term}" → ${destInfo.cities.length} cities, added ${data?.length || 0} products`);
    } else if (destInfo.isDestination) {
      // City search: also check for sub-destinations in the same country
      const { data: siblingDests } = await sb.from("viator_destination_map")
        .select("city_name, country")
        .ilike("city_name", term.trim())
        .limit(1)
        .maybeSingle();

      if (siblingDests?.country) {
        const { data: subDests } = await sb.from("viator_destination_map")
          .select("city_name")
          .ilike("country", siblingDests.country)
          .eq("dest_type", "CITY")
          .limit(30);
        if (subDests && subDests.length > 1) {
          const subCities = [...new Set(subDests.map(d => d.city_name).filter(c => c.toLowerCase() !== term.trim().toLowerCase()))];
          if (subCities.length > 0) {
            const subFilters = subCities.map(c => `destination.ilike.%${c}%`);
            const { data } = await sb.from("tour_product_cache").select(lightCols)
              .eq("is_active", true).gt("price", 0)
              .or(subFilters.join(","))
              .order("review_count", { ascending: false }).limit(300);
            addCandidates(data);
            console.log(`[smart-search] Sub-destination broadening "${term}" → +${subCities.join(", ")} (${data?.length || 0} products)`);
          }
        }
      }
    }
  }

  // 2c) Landmark / places_covered broadening — searches inside places_covered array
  // e.g., "Singapore" → finds tours covering "Little India", "Chinatown", "Merlion Park"
  for (const term of rawTerms) {
    // Search products whose places_covered mentions the search term
    const { data: placeHits } = await sb.from("tour_product_cache").select(lightCols)
      .eq("is_active", true).gt("price", 0)
      .contains("places_covered", [term])
      .order("review_count", { ascending: false }).limit(200);
    addCandidates(placeHits);

    // Also search highlights array
    const { data: highlightHits } = await sb.from("tour_product_cache").select(lightCols)
      .eq("is_active", true).gt("price", 0)
      .contains("highlights", [term])
      .order("review_count", { ascending: false }).limit(100);
    addCandidates(highlightHits);
  }

  // 2d) Individual word broadening (for multi-word terms like "express pass singapore")
  if ((!strictIdentity.strict || candidateCodes.size === 0) && candidateCodes.size < 50) {
    for (const term of searchTermsForCandidates) {
      const words = term.split(/\s+/).filter(w => w.length >= 4);
      for (const word of words.slice(0, 3)) {
        const { data } = await sb.from("tour_product_cache").select(lightCols)
          .eq("is_active", true).gt("price", 0)
          .ilike("title", `%${word}%`)
          .order("review_count", { ascending: false }).limit(50);
        addCandidates(data);
      }
    }
  }

  // 2e) Identity-word fallback — if still 0 candidates, extract the most distinctive words
  // and search each individually. Handles long AI titles like
  // "Zoo Negara Kuala Lumpur Admission (Giant Panda Conservation Centre)"
  // where the full ilike pattern is too restrictive.
  if (candidateCodes.size === 0) {
    const IDENTITY_WORDS = new Set([
      "zoo", "negara", "aquaria", "aquarium", "safari", "museum", "temple",
      "gardens", "park", "island", "bridge", "tower", "caves", "beach",
      "palace", "mosque", "cathedral", "cathedral", "waterfall", "lake",
      "sentosa", "genting", "petronas", "langkawi", "penang", "entopia",
      "skyworlds", "skyworld", "skycab", "skybridge", "skypark", "universal",
      "legoland", "klcc", "merlion", "putrajaya", "batu", "botanical",
      "butterfly", "panda", "highland", "highlands", "cable",
    ]);
    // Extract identity words from raw terms (no stripping)
    const identityWords = rawTerms.flatMap(t => t.split(/\s+/)).filter(w => IDENTITY_WORDS.has(w) || w.length >= 6);
    const uniqueIdentityWords = [...new Set(identityWords)].slice(0, 4);

    if (uniqueIdentityWords.length >= 2) {
      // Search with pairs of identity words for precision
      const pairPattern = `%${uniqueIdentityWords.slice(0, 2).join("%")}%`;
      const { data: pairHits } = await sb.from("tour_product_cache").select(lightCols)
        .eq("is_active", true).gt("price", 0)
        .or(`title.ilike.${pairPattern},short_description.ilike.${pairPattern}`)
        .order("review_count", { ascending: false }).limit(100);
      addCandidates(pairHits);
      console.log(`[smart-search] 2e identity-pair fallback "${uniqueIdentityWords.slice(0, 2).join(" + ")}" → ${pairHits?.length || 0} candidates`);
    }

    // Also try each identity word individually
    if (candidateCodes.size < 20) {
      for (const word of uniqueIdentityWords.slice(0, 3)) {
        const { data } = await sb.from("tour_product_cache").select(lightCols)
          .eq("is_active", true).gt("price", 0)
          .ilike("title", `%${word}%`)
          .order("review_count", { ascending: false }).limit(30);
        addCandidates(data);
      }
    }
  }

  console.log(`[smart-search] Phase 2: ${candidateCodes.size} lightweight candidates for "${searchText}"${destinationCity ? ` (dest: ${destinationCity})` : ""}`);
  if (candidateCodes.size === 0) return null;

  // ── PHASE 3: Load product_data ONLY for candidates, deep-score ──
  // If destination filter is active, remove candidates from wrong destinations before scoring
  let candidateArray = [...candidateMap.values()];
  if (destinationCity) {
    const cityLower = destinationCity.toLowerCase().trim();
    const validDests = [cityLower, ...(METRO_ALIASES[cityLower] || [])];
    // Also check reverse: is cityLower a sub-destination?
    for (const [metro, subs] of Object.entries(METRO_ALIASES)) {
      if (subs.includes(cityLower)) {
        validDests.push(metro);
        validDests.push(...subs);
      }
    }
    const beforeCount = candidateArray.length;
    candidateArray = candidateArray.filter(p => {
      const dest = (p.destination || "").toLowerCase();
      if (!dest) return true; // no destination info — keep
      return validDests.some(v => dest.includes(v) || v.includes(dest));
    });
    if (candidateArray.length < beforeCount) {
      console.log(`[smart-search] Phase 3 dest filter: ${beforeCount} → ${candidateArray.length} candidates (removed ${beforeCount - candidateArray.length} cross-destination)`);
    }
    if (candidateArray.length === 0) return null;
  }

  const codesToEnrich = candidateArray.map(c => c.product_code);

  // Batch-load product_data (50 at a time to control memory)
  const enrichedData = new Map<string, any>();
  for (let i = 0; i < codesToEnrich.length; i += 50) {
    const batch = codesToEnrich.slice(i, i + 50);
    const { data: pdRows } = await sb.from("tour_product_cache")
      .select("product_code, product_data")
      .in("product_code", batch);
    if (pdRows) for (const row of pdRows) enrichedData.set(row.product_code, row.product_data || {});
  }

  const exchangeData = await getExchangeRates();

  const placesToSave: { productCode: string; places: string[] }[] = [];

  // ── Option-level keyword detection ──
  // Detect words in the search query that might refer to product options (e.g., "express pass")
  // rather than the product itself. We compare search words against common option keywords.
  const OPTION_STOP_WORDS = new Set(["tour", "tours", "ticket", "tickets", "trip", "trips", "city", "day", "full", "half", "private", "shared", "group"]);
  const allSearchWords = rawTerms.join(" ").split(/\s+/).filter(w => w.length >= 3 && !OPTION_STOP_WORDS.has(w));

  // Score each candidate across all available fields
  const scored = candidateArray.map(p => {
    const pd = enrichedData.get(p.product_code) || {};
    const title = (p.title || "").toLowerCase();
    const desc = (p.short_description || pd.description || "").toLowerCase();
    const dest = (p.destination || "").toLowerCase();
    const highlightsText = (Array.isArray(p.highlights) ? p.highlights : [])
      .map((h: any) => String(h).toLowerCase()).join(" ");
    const optionsText = (Array.isArray(pd.productOptions) ? pd.productOptions : [])
      .map((o: any) => `${o.title || ""} ${o.description || ""}`.toLowerCase()).join(" ");
    const inclusionsText = (Array.isArray(pd.inclusions) ? pd.inclusions : [])
      .map((inc: any) => `${inc.otherDescription || ""} ${inc.typeDescription || ""}`.toLowerCase()).join(" ");
    const pricingText = Object.values(pd._schedulePricing?.optionPricing || {})
      .map((v: any) => (v?.label || "").toLowerCase()).join(" ");

    const matchedTerms: string[] = [];
    const matchDetails: { term: string; fields: string[] }[] = [];

    const placesCoveredText = (Array.isArray(p.places_covered) ? p.places_covered : [])
      .map((pc: any) => String(pc).toLowerCase()).join(" ");

    // Score against original terms as-is (no stripping)
    const scoringTermSets = [...new Set([...rawTerms])];

    for (const term of scoringTermSets) {
      const fields: string[] = [];
      const allText = `${title} ${desc} ${highlightsText} ${placesCoveredText} ${optionsText} ${inclusionsText} ${pricingText} ${dest}`;

      // For short terms (1-3 words), use exact substring matching
      const termWords = term.split(/\s+/).filter(w => w.length >= 2);
      const isLongTerm = termWords.length > 3;

      if (!isLongTerm) {
        // Short term: exact substring match per field
        if (title.includes(term)) fields.push("title");
        if (desc.includes(term)) fields.push("description");
        if (dest.includes(term)) fields.push("destination");
        if (highlightsText.includes(term)) fields.push("highlights");
        if (placesCoveredText.includes(term)) fields.push("places_covered");
        if (optionsText.includes(term)) fields.push("options");
        if (inclusionsText.includes(term)) fields.push("inclusions");
        if (pricingText.includes(term)) fields.push("pricing");

        // Fuzzy fallback: all words must appear somewhere
        if (fields.length === 0) {
          const words = termWords.filter(w => w.length >= 3);
          if (words.length > 0 && words.every(w => allText.includes(w))) fields.push("fuzzy");
        }
      } else {
        // Long term (4+ words): use word-overlap scoring
        const meaningfulWords = termWords.filter(w => w.length >= 3);
        if (meaningfulWords.length === 0) continue;

        const matchedWords = meaningfulWords.filter(w => allText.includes(w));
        const overlapRatio = matchedWords.length / meaningfulWords.length;

        // Require higher overlap when destination is constrained (more specific search)
        const minOverlap = destinationCity ? 0.55 : 0.40;
        if (overlapRatio >= minOverlap) {
          // Determine which fields contributed
          if (matchedWords.some(w => title.includes(w))) fields.push("title");
          if (matchedWords.some(w => desc.includes(w))) fields.push("description");
          if (matchedWords.some(w => dest.includes(w))) fields.push("destination");
          if (matchedWords.some(w => highlightsText.includes(w))) fields.push("highlights");
          fields.push("word_overlap");
        }
      }

      if (fields.length > 0 && !matchedTerms.includes(term)) {
        matchedTerms.push(term);
        matchDetails.push({ term, fields });
      }
    }

    const matchCount = matchedTerms.length;
    const qualityScore = (p.rating || 0) * 10 + Math.log10(Math.max(1, p.review_count || 0) + 1);

    // Boost products whose title contains core identity words from the query
    // e.g., "zoo negara" in search → product titled "Zoo Negara..." gets a big boost
    let titleRelevanceBoost = 0;
    for (const term of scoringTermSets) {
      const termWords = term.split(/\s+/).filter(w => w.length >= 3);
      if (termWords.length <= 3) {
        // Short term: check full substring in title
        if (title.includes(term)) titleRelevanceBoost += 500;
      } else {
        // Long term: first check for multi-word phrase matches in title
        // "zoo negara kuala lumpur" → check if "zoo negara" appears as consecutive words in title
        // This prevents "Taman Negara" from outranking "Zoo Negara" for query "Zoo Negara"
        const IDENTITY_BOOST_WORDS = new Set([
          "zoo", "negara", "aquaria", "aquarium", "safari", "museum", "temple",
          "gardens", "park", "island", "bridge", "tower", "caves", "beach",
          "palace", "mosque", "waterfall", "panda", "butterfly", "entopia",
          "universal", "legoland", "petronas", "genting", "skyworlds", "sentosa",
          "cable", "skybridge", "skypark", "botanical", "highland", "putrajaya",
          "batu", "merlion", "klcc", "langkawi", "penang",
        ]);
        // Build consecutive 2-word and 3-word phrases from the search term
        // and give massive boost if any appear in the title
        let phraseBoost = 0;
        for (let pi = 0; pi < termWords.length - 1; pi++) {
          const bigram = `${termWords[pi]} ${termWords[pi + 1]}`;
          if (title.includes(bigram) && termWords.slice(pi, pi + 2).some(w => IDENTITY_BOOST_WORDS.has(w))) {
            phraseBoost += 400; // consecutive identity phrase match
          }
          if (pi < termWords.length - 2) {
            const trigram = `${termWords[pi]} ${termWords[pi + 1]} ${termWords[pi + 2]}`;
            if (title.includes(trigram)) phraseBoost += 500;
          }
        }
        titleRelevanceBoost += phraseBoost;

        const identityHits = termWords.filter(w => IDENTITY_BOOST_WORDS.has(w) && title.includes(w));
        titleRelevanceBoost += identityHits.length * 150;
      }
    }

    // sortScore used for internal candidate ranking (not exposed)

    // ── Query relevance (0-100) — option-aware scoring ──
    // Compute how well the product title + options match the search query
    let _queryRelevance = 0;
    {
      const pNorm = title; // already lowercased
      const sNorm = searchText.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
      if (pNorm === sNorm) { _queryRelevance = 100; }
      else if (pNorm.includes(sNorm) || sNorm.includes(pNorm)) { _queryRelevance = 90; }
      else {
        const sTokens = sNorm.split(" ").filter((w: string) => w.length > 2);
        if (sTokens.length === 0) { _queryRelevance = 30; }
        else {
          // Build searchable text from title + option names + inclusions + schedule pricing + highlights
          const optionNamesText = (Array.isArray(pd.productOptions) ? pd.productOptions : [])
            .map((o: any) => `${o.title || ""} ${o.description || ""}`.toLowerCase()).join(" ");
          const inclusionsText = (Array.isArray(pd.inclusions) ? pd.inclusions : [])
            .map((inc: any) => `${inc.otherDescription || ""} ${inc.typeDescription || ""}`.toLowerCase()).join(" ");
          const schedulePricingLabels = Object.values(pd._schedulePricing?.optionPricing || {})
            .map((v: any) => (v?.label || "").toLowerCase()).join(" ");
          const highlightsJoined = (Array.isArray(p.highlights) ? p.highlights : [])
            .map((h: any) => String(h).toLowerCase()).join(" ");
          // Combine all supplementary text for secondary matching
          const suppText = `${optionNamesText} ${inclusionsText} ${schedulePricingLabels} ${highlightsJoined}`;
          const suppTokens = new Set(suppText.replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w: string) => w.length > 2));

          const pTokens = new Set(pNorm.replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w: string) => w.length > 2));
          let qrHits = 0;
          for (const t of sTokens) {
            if (pTokens.has(t)) { qrHits += 1; }
            else if (suppTokens.has(t)) { qrHits += 0.85; } // option/inclusion/pricing match
            else {
              // Substring match in title tokens
              let found = false;
              for (const pt of pTokens) {
                if ((pt.length >= 4 && t.length >= 4) && (pt.includes(t) || t.includes(pt))) { qrHits += 0.6; found = true; break; }
              }
              // Substring match in supplementary tokens
              if (!found) {
                for (const st of suppTokens) {
                  if ((st.length >= 4 && t.length >= 4) && (st.includes(t) || t.includes(st))) { qrHits += 0.5; break; }
                }
              }
            }
          }
          _queryRelevance = Math.max(0, Math.round(Math.min(1.0, qrHits / sTokens.length) * 85 + 15));

          // ── Phrase coherence bonus ──
          // Only reward bigrams containing identity words (not generic city names)
          const CITY_WORDS_SM = new Set(["kuala", "lumpur", "singapore", "bangkok", "tokyo", "london", "paris",
            "delhi", "mumbai", "dubai", "istanbul", "cairo", "rome", "berlin", "amsterdam",
            "jakarta", "manila", "hanoi", "seoul", "taipei", "osaka", "kyoto", "penang",
            "langkawi", "bali", "phuket", "chiang"]);
          if (sTokens.length >= 2) {
            let phraseBonus = 0;
            for (let pi = 0; pi < sTokens.length - 1; pi++) {
              const w1 = sTokens[pi], w2 = sTokens[pi + 1];
              if (CITY_WORDS_SM.has(w1) && CITY_WORDS_SM.has(w2)) continue;
              const bigram = `${w1} ${w2}`;
              if (pNorm.includes(bigram)) phraseBonus += 15;
            }
            _queryRelevance = Math.min(100, _queryRelevance + phraseBonus);
          }

          // ── High-intent differentiator penalty ──
          // Words like "express", "vip", "private", "skip" are strong differentiators.
          // Landmark/geography words (hill, temple, cave, etc.) are identity-critical —
          // "Penang Hill Guided Tour" vs "Penang Streetfood Guided Tour" differ ONLY on "hill".
          // If the query contains one and the product has ZERO match for it, apply a hard penalty.
          const HIGH_INTENT_WORDS = new Set(["express", "vip", "private", "skip", "premium", "fast", "guided", "luxury"]);
          const LANDMARK_IDENTITY_WORDS = new Set([
            "hill", "temple", "cave", "caves", "beach", "island", "bridge", "waterfall",
            "museum", "garden", "gardens", "park", "zoo", "aquarium", "tower", "palace",
            "fort", "monastery", "mosque", "church", "cathedral", "market", "street",
            "mountain", "volcano", "lake", "river", "falls", "canyon", "forest",
            "safari", "snorkeling", "diving", "kayaking", "rafting", "trekking",
            "butterfly", "funicular", "cable", "skybridge", "skywalk",
            "food", "streetfood", "cooking", "culinary",
          ]);
          // Collect differentiator tokens: explicit high-intent + landmark identity words from query
          const differentiatorTokens = sTokens.filter((w: string) =>
            HIGH_INTENT_WORDS.has(w) || (LANDMARK_IDENTITY_WORDS.has(w) && !CITY_WORDS_SM.has(w))
          );
          if (differentiatorTokens.length > 0) {
            // Deep content scan: check ALL structured fields to determine if the landmark/concept is truly covered
            const optionTexts = (Array.isArray(pd.productOptions) ? pd.productOptions : [])
              .map((o: any) => `${o.title || ""} ${o.description || ""}`).join(" ").toLowerCase();
            const inclusionTexts = (Array.isArray(pd.inclusions) ? pd.inclusions : [])
              .map((i: any) => `${i.otherDescription || ""} ${i.typeDescription || ""}`).join(" ").toLowerCase();
            const schedLabels = Object.values(pd._schedulePricing?.optionPricing || {})
              .map((v: any) => `${v.label || ""} ${v.title || ""}`).join(" ").toLowerCase();
            const hText = (Array.isArray(p.highlights) ? p.highlights : []).join(" ").toLowerCase();
            const pcText = (Array.isArray(p.places_covered) ? p.places_covered : []).join(" ").toLowerCase();
            // Itinerary items: POI names + descriptions — the richest signal for what a tour actually covers
            const itineraryItems = pd.itinerary?.itineraryItems || pd.itineraryItems || [];
            const itineraryText = (Array.isArray(itineraryItems) ? itineraryItems : [])
              .map((item: any) => {
                const poiName = item?.pointOfInterestLocation?.location?.name || "";
                const itemTitle = item?.title || item?.name || "";
                const itemDesc = item?.description || "";
                return `${poiName} ${itemTitle} ${itemDesc}`;
              }).join(" ").toLowerCase();
            // Product description
            const descText = (p.short_description || pd.description || "").toLowerCase();
            const allProductText = `${pNorm} ${[...suppTokens].join(" ")} ${optionTexts} ${inclusionTexts} ${schedLabels} ${hText} ${pcText} ${itineraryText} ${descText}`;
            const missingDifferentiators = differentiatorTokens.filter((w: string) => !allProductText.includes(w));
            if (missingDifferentiators.length > 0) {
              // Landmark words get a softer penalty (25) since itinerary items may still cover them
              // High-intent words keep the hard penalty (40)
              const penalty = missingDifferentiators.reduce((sum: number, w: string) => {
                return sum + (HIGH_INTENT_WORDS.has(w) ? 40 : 25);
              }, 0);
              _queryRelevance = Math.max(0, _queryRelevance - penalty);
            }
          }
        }
      }
    }

    // ── Admission product boost ──
    // When query looks like an attraction ticket (not a guided tour), boost products
    // that are admission/entry tickets over multi-stop guided tours
    const ADMISSION_KEYWORDS = /\b(admission|ticket|entry|pass|gate)\b/i;
    const GUIDED_TOUR_KEYWORDS = /\b(guided\s+tour|walking\s+tour|food\s+tour|day\s+trip|multi.?stop|hop.on)\b/i;
    const queryIsTicket = ADMISSION_KEYWORDS.test(searchText) || 
      (!GUIDED_TOUR_KEYWORDS.test(searchText) && strictIdentity.strict);
    const productIsTicket = ADMISSION_KEYWORDS.test(p.title || "") || 
      /\b(admission|ticket|entry|pass)\b/i.test((pd.productOptions || []).map((o: any) => o.title || "").join(" "));
    const productIsGuidedTour = GUIDED_TOUR_KEYWORDS.test(p.title || "");
    
    if (queryIsTicket && productIsTicket && !productIsGuidedTour) {
      _queryRelevance = Math.min(100, _queryRelevance + 12); // admission boost
    } else if (queryIsTicket && productIsGuidedTour && !productIsTicket) {
      _queryRelevance = Math.max(0, _queryRelevance - 8); // guided tour penalty for ticket queries
    }

    let price = p.price || 0;
    const pCurrency = p.currency || "USD";

    // ── Option-level price matching ──
    // If the search contains option-specific keywords, find the best matching product option
    // and use its price instead of the base price. Also return metadata for frontend badge.
    let matchedOptionInfo: { optionName: string; optionCode: string; optionPrice: number; optionCurrency: string } | null = null;

    const schedulePricing = pd._schedulePricing?.optionPricing || {};
    const productOptions = Array.isArray(pd.productOptions) ? pd.productOptions : [];

    if (productOptions.length > 0 && allSearchWords.length > 0) {
      // Build a combined text for each option and score against search words
      let bestOptionScore = 0;
      let bestOption: { code: string; name: string; price: number; currency: string } | null = null;

      for (const opt of productOptions) {
        const optText = `${opt.title || ""} ${opt.description || ""}`.toLowerCase();
        const optCode = opt.productOptionCode || "";
        // Count how many search words appear in this option's text
        const optMatchWords = allSearchWords.filter(w => optText.includes(w));
        // Only consider if at least 1 non-product-name word matches the option
        // (i.e., the word is NOT already in the product title — it's option-specific)
        const optSpecificWords = optMatchWords.filter(w => !title.includes(w));
        if (optSpecificWords.length === 0) continue;

        const optScore = optSpecificWords.length * 10 + optMatchWords.length;
        if (optScore > bestOptionScore) {
          // Get this option's price from schedule pricing
          const schedPrice = schedulePricing[optCode];
          const optPrice = schedPrice?.fromPrice || opt.fromPrice || 0;
          const optCurrency = schedPrice?.currency || pCurrency;
          if (optPrice > 0) {
            bestOptionScore = optScore;
            bestOption = {
              code: optCode,
              name: (opt.title || opt.description || "").trim(),
              price: optPrice,
              currency: optCurrency,
            };
          }
        }
      }

      if (bestOption) {
        // Override price with the matched option's price
        price = bestOption.price;
        // Use the option's currency for conversion
        if (bestOption.currency !== targetCurrency && price > 0) {
          price = convertPrice(price, bestOption.currency, targetCurrency, exchangeData.rates, exchangeData.markup);
        }
        // Store converted price in matchedOptionInfo so downstream consumers get the right value
        matchedOptionInfo = {
          optionName: bestOption.name,
          optionCode: bestOption.code,
          optionPrice: price, // Already converted to targetCurrency
          optionCurrency: targetCurrency,
        };
      }
    }

    // Convert base price if no option override was applied
    if (!matchedOptionInfo && pCurrency !== targetCurrency && price > 0) {
      price = convertPrice(price, pCurrency, targetCurrency, exchangeData.rates, exchangeData.markup);
    }

    // Use cached places_covered from DB if available; otherwise extract and queue save
    const cachedPlaces = Array.isArray(p.places_covered) && p.places_covered.length > 0 ? p.places_covered as string[] : null;
    let placesCovered: string[] = cachedPlaces || [];
    if (!cachedPlaces) {
      // Extract places covered from itinerary items' descriptions
      const itineraryItems = pd.itinerary?.itineraryItems || pd._itinerary?.itineraryItems || [];
      const PLACE_PATTERN = /\b([A-Z][a-zA-Z''-]+(?:\s+(?:of|the|de|del|al|el)\s+)?(?:[A-Z][a-zA-Z''-]+\s*){0,4}(?:Caves?|Highlands?|Temple|Park|Gardens?|Museum|Tower|Bridge|Bay|Island|Beach|Palace|Mosque|Church|Market|Square|Street|Quarter|District|Fort|Gate|Pagoda|Hill|Mountain|Falls|Lake|River|Pier|Harbour|Harbor|Centre|Center|Walk|Zoo|Aquarium|Stadium|Monument|Memorial|Shrine|Waterfall|Point|Strait|Reef|Resort|Casino|World|Studio|Village|Jungle))\b/g;
      if (Array.isArray(itineraryItems)) {
        for (const item of itineraryItems) {
          const itemDesc = (item.description || "").trim();
          if (!itemDesc || itemDesc.length < 10 || /^passing by$/i.test(itemDesc)) continue;
          const matches = itemDesc.matchAll(PLACE_PATTERN);
          for (const m of matches) {
            const place = m[1].trim();
            if (place.length >= 5 && place.length <= 45 && !placesCovered.some(pc => pc.toLowerCase() === place.toLowerCase())) {
              placesCovered.push(place);
            }
          }
        }
      }
      if (placesCovered.length < 3) {
        const scanText = `${p.title || ""} ${p.short_description || ""}`;
        const titleMatches = scanText.matchAll(PLACE_PATTERN);
        for (const m of titleMatches) {
          const place = m[1].trim();
          if (place.length >= 5 && place.length <= 45 && !placesCovered.some(pc => pc.toLowerCase() === place.toLowerCase())) {
            placesCovered.push(place);
          }
        }
      }
      // Persist extracted places back to DB (fire-and-forget)
      if (placesCovered.length > 0 && p.product_code) {
        placesToSave.push({ productCode: p.product_code, places: placesCovered.slice(0, 8) });
      }
    }

    // ── Composite conversion score (product quality, 0-100 NORMALIZED) ──
    // Factors: title match field bonus, inclusions richness, highlights depth,
    //          review quality, option availability, schedule pricing, images, places covered
    const placesArr = Array.isArray(p.places_covered) ? p.places_covered : [];
    const highlightsArr = Array.isArray(p.highlights) ? p.highlights : [];
    const inclusionsArr = Array.isArray(pd.inclusions) ? pd.inclusions : [];
    const optionsArr = Array.isArray(pd.productOptions) ? pd.productOptions : [];
    const schedulePricingEntries = Object.keys(pd._schedulePricing?.optionPricing || {});
    const hasSchedulePricing = schedulePricingEntries.length > 0;
    const hasImage = !!(p.image_url || (p.images && p.images[0]));
    const imagesCount = Array.isArray(p.images) ? p.images.length : 0;

    // Title match field bonus (0-10)
    const titleMatchBonus = matchDetails.some(md => md.fields.includes("title")) ? 10
      : matchDetails.some(md => md.fields.includes("highlights") || md.fields.includes("inclusions")) ? 5
      : 0;

    // Inclusions richness (0-10)
    const inclusionsScore = Math.min(inclusionsArr.length * 2.5, 10);

    // Highlights depth (0-8)
    const highlightsScore = Math.min(highlightsArr.length * 1.2, 8);

    // Review quality (0-30) — rating AND volume both matter
    const rating = p.rating || 0;
    const reviewCount = p.review_count || 0;
    const ratingScore = Math.min(rating * 4, 20);
    const reviewVolumeScore = Math.min(Math.log10(Math.max(1, reviewCount)) * 5, 10);
    const reviewQualityScore = ratingScore + reviewVolumeScore;

    // Option & pricing depth (0-15) — schedule pricing is a STRONG bookability signal
    const optionScore = (optionsArr.length > 0 ? 3 : 0)
      + (hasSchedulePricing ? 6 : 0) // boosted from 4→6: real scheduled pricing = actually bookable
      + Math.min(optionsArr.length, 3)
      + Math.min(schedulePricingEntries.length, 3); // more priced options = more flexible

    // Content richness (0-17)
    const placesScore = Math.min(placesArr.length * 3, 9);
    const imageScore = Math.min(imagesCount, 3) + (hasImage ? 2 : 0);
    const descScore = (p.short_description || "").length > 100 ? 2 : (p.short_description || "").length > 50 ? 1 : 0;
    const cancellationBonus = (pd.flags?.includes?.("FREE_CANCELLATION") || p.cancellation_policy === "FREE_CANCELLATION") ? 3 : 0;

    // Raw quality sum (max theoretical ~95)
    const rawQuality = titleMatchBonus + inclusionsScore + highlightsScore +
      reviewQualityScore + optionScore + placesScore + imageScore + descScore +
      cancellationBonus + (pd ? 5 : 0);

    // Normalize to 0-100 (max raw is ~95, so scale × 1.05)
    const _conversionScore = Math.min(100, Math.round(rawQuality * 1.05));

    // ── Composite search score (0-100): 3-signal blend ──
    // Signal 1: Relevance — how well the product matches the search query
    // Signal 2: Quality — product richness, reviews, bookability
    // Signal 3: Price-Value — rating-to-price ratio (rewards affordable quality)
    const priceVal = price > 0 ? ((rating || 0) * Math.log10(Math.max(2, reviewCount))) / Math.sqrt(price) : 0;
    // Normalize price-value to 0-100 range (typical range 0-5, scale ×20)
    const _priceValueNorm = Math.min(100, Math.round(priceVal * 20));

    // Adaptive weighting: high relevance → trust relevance more; low → lean on quality+value
    let relWeight: number, qualWeight: number, valWeight: number;
    if ((_queryRelevance || 0) >= 90) {
      relWeight = 0.55; qualWeight = 0.25; valWeight = 0.20;
    } else if ((_queryRelevance || 0) >= 70) {
      relWeight = 0.45; qualWeight = 0.30; valWeight = 0.25;
    } else {
      relWeight = 0.35; qualWeight = 0.35; valWeight = 0.30;
    }
    const _searchScore = Math.round(
      (_queryRelevance || 0) * relWeight +
      _conversionScore * qualWeight +
      _priceValueNorm * valWeight
    );

    return {
      id: `viator-${p.product_code}`, productCode: p.product_code,
      velaId: p.vela_id || null, slug: p.slug || null,
      name: p.title, destination: p.destination || "",
      duration: p.duration || "", price, currency: targetCurrency,
      category: p.category || "Tour", rating: p.rating || 0,
      reviewCount: p.review_count || 0,
      image: p.image_url || (p.images && p.images[0]) || null,
      images: p.images || [], highlights: p.highlights || [],
      shortDescription: p.short_description || "",
      pricingType: p.pricing_type || "PER_PERSON",
      maxGroupSize: (p.pricing_type || "PER_PERSON") === "PER_GROUP" ? extractMaxGroupSize(p.age_bands) : null,
      placesCovered: placesCovered.slice(0, 8),
      source: "viator", _fromCache: true,
      _matchMeta: matchCount > 0 ? { matchedTerms, matchCount, totalTerms: rawTerms.length, matchDetails } : undefined,
      _matchedOption: matchedOptionInfo || undefined,
      _queryRelevance,
      _conversionScore,
      _priceValueScore: _priceValueNorm,
      _searchScore,
    };
  });

  // Persist extracted places_covered back to DB (fire-and-forget batch)
  if (placesToSave.length > 0) {
    Promise.resolve().then(async () => {
      try {
        for (const { productCode, places } of placesToSave) {
          await sb.from("tour_product_cache")
            .update({ places_covered: places })
            .eq("product_code", productCode);
        }
      } catch (e) { console.warn("[places-save] error:", e); }
    });
  }

  // Filter & sort — require minimum relevance when destination is constrained
  const minRelevanceCutoff = strictIdentity.strict ? 60 : destinationCity ? 45 : 0;
  let matched = scored.filter(p => p._matchMeta && (p._queryRelevance || 0) >= minRelevanceCutoff);
  if (matched.length === 0 && minRelevanceCutoff > 0) {
    // Fallback: if strict cutoff removed everything, use a softer threshold
    matched = scored.filter(p => p._matchMeta && (p._queryRelevance || 0) >= (strictIdentity.strict ? 45 : 30));
  }

  if (strictIdentity.strict && matched.length > 1 && strictIdentity.phrases.length > 0) {
    const titlePhraseMatches = matched.filter((p) => {
      const titleNorm = normalizeSearchValue(p.name || "");
      return strictIdentity.phrases.some((phrase) => titleNorm.includes(phrase));
    });
    if (titlePhraseMatches.length > 0) {
      console.log(`[smart-search] Strict title phrase filter "${searchText}" → ${matched.length} → ${titlePhraseMatches.length}`);
      matched = titlePhraseMatches;
    } else {
      const supportingPhraseMatches = matched.filter((p) => {
        const supportText = normalizeSearchValue([
          p.name || "",
          p.shortDescription || "",
          Array.isArray(p.highlights) ? p.highlights.join(" ") : "",
          p._matchedOption?.optionName || "",
        ].join(" "));
        return strictIdentity.phrases.some((phrase) => supportText.includes(phrase));
      });
      if (supportingPhraseMatches.length > 0) {
        console.log(`[smart-search] Strict support phrase filter "${searchText}" → ${matched.length} → ${supportingPhraseMatches.length}`);
        matched = supportingPhraseMatches;
      }
    }
  }

  // ── Dynamic gap-based cutoff ──
  // If top results score significantly higher than the tail, purge low-relevance stragglers
  // This ensures "Universal Studios Singapore Express Pass" only shows products with express pass options
  if (matched.length > 3) {
    const topRelevance = Math.max(...matched.slice(0, 3).map(p => p._queryRelevance || 0));
    if (topRelevance >= 70) {
      // Dynamic floor: strict identity queries keep a much tighter band
      const dynamicFloor = strictIdentity.strict
        ? Math.max(70, topRelevance - 10)
        : Math.max(55, topRelevance - 15);
      const tightFiltered = matched.filter(p => (p._queryRelevance || 0) >= dynamicFloor);
      if (tightFiltered.length >= 1) {
        console.log(`[smart-search] Dynamic gap cutoff: top=${topRelevance}, floor=${dynamicFloor}, ${matched.length} → ${tightFiltered.length}`);
        matched = tightFiltered;
      }
    }
  }

  if (sortOrder === "PRICE") {
    matched.sort((a, b) => (b._matchMeta!.matchCount - a._matchMeta!.matchCount) || (a.price - b.price));
  } else if (sortOrder === "TRAVELER_RATING") {
    matched.sort((a, b) => (b._matchMeta!.matchCount - a._matchMeta!.matchCount) || (b.rating - a.rating));
  } else {
    // Default "recommended" sort: 3-signal composite (relevance + quality + price-value)
    // Within same score band (±3), tiebreak: higher relevance → higher quality → lower price
    matched.sort((a, b) => {
      const scoreDiff = (b._searchScore || 0) - (a._searchScore || 0);
      if (Math.abs(scoreDiff) > 3) return scoreDiff;
      const relDiff = (b._queryRelevance || 0) - (a._queryRelevance || 0);
      if (Math.abs(relDiff) > 5) return relDiff;
      const qualDiff = (b._conversionScore || 0) - (a._conversionScore || 0);
      if (Math.abs(qualDiff) > 5) return qualDiff;
      return ((a.price || 0) - (b.price || 0));
    });
  }

  if (minRating && minRating > 0) matched = matched.filter(p => p.rating >= minRating);
  if (priceRange?.min) matched = matched.filter(p => p.price >= priceRange.min!);
  if (priceRange?.max) matched = matched.filter(p => p.price <= priceRange.max!);

  const results = matched.slice(0, limit);

  // ── POWER OF N: Smart pick labeling (up to 5 distinct labels) ──
  if (results.length >= 2) {
    const RELEVANCE_FLOOR = 60;
    const eligible = results.filter(p => (p._queryRelevance || 0) >= RELEVANCE_FLOOR && p.price > 0);
    const assignedCodes = new Set<string>();

    // 🏆 Best Match — highest composite _searchScore (relevance + quality + value)
    if (eligible.length > 0) {
      eligible[0]._pickType = "best_match";
      assignedCodes.add(eligible[0].productCode);
    }

    // 💰 Cheapest — lowest price (only if >5% cheaper than best match)
    const cheapest = eligible
      .filter(p => !assignedCodes.has(p.productCode))
      .sort((a, b) => a.price - b.price)[0];
    if (cheapest && cheapest.price < (eligible[0]?.price || Infinity) * 0.95) {
      cheapest._pickType = "cheapest";
      assignedCodes.add(cheapest.productCode);
    }

    // ⭐ Top Rated — highest rating with social proof (≥15 reviews, ≥4.0 rating)
    const topRated = eligible
      .filter(p => !assignedCodes.has(p.productCode) && (p.reviewCount || 0) >= 15)
      .sort((a, b) => {
        const rDiff = (b.rating || 0) - (a.rating || 0);
        if (Math.abs(rDiff) > 0.1) return rDiff;
        return (b.reviewCount || 0) - (a.reviewCount || 0);
      })[0];
    if (topRated && (topRated.rating || 0) >= 4.0) {
      topRated._pickType = "top_rated";
      assignedCodes.add(topRated.productCode);
    }

    // 💎 Best Value — best composite of (rating × log(reviews) × conversionScore) / price
    // This rewards products that are affordable, well-reviewed, AND content-rich
    const bestValue = eligible
      .filter(p => !assignedCodes.has(p.productCode) && (p.reviewCount || 0) >= 5 && p.price > 0)
      .map(p => ({
        ...p,
        _valueScore: (
          (p.rating || 0) *
          Math.log10(Math.max(2, p.reviewCount || 1)) *
          Math.max(30, p._conversionScore || 0)
        ) / (p.price || 1),
      }))
      .sort((a, b) => b._valueScore - a._valueScore)[0];
    if (bestValue) {
      bestValue._pickType = "best_value";
      assignedCodes.add(bestValue.productCode);
    }

    // 🎫 Best Option Match — when a specific variant was requested and matched
    const bestOption = eligible
      .filter(p => !assignedCodes.has(p.productCode) && p._matchedOption?.optionName)
      .sort((a, b) => (b._searchScore || 0) - (a._searchScore || 0))[0];
    if (bestOption) {
      bestOption._pickType = "best_option_match";
      assignedCodes.add(bestOption.productCode);
    }

    // Apply picks back to results
    const pickMap = new Map<string, string>();
    for (const p of eligible) {
      if (p._pickType) pickMap.set(p.productCode, p._pickType);
    }
    for (const r of results) {
      const pick = pickMap.get(r.productCode);
      if (pick) r._pickType = pick;
    }

    const pickSummary = results.filter(r => r._pickType).map(r => `${r._pickType}="${r.name.slice(0, 35)}"`).join(", ");
    if (pickSummary) console.log(`[smart-search] 🏆 Picks: ${pickSummary}`);
  }

  console.log(`[smart-search] "${searchText}" → ${rawTerms.length} terms, ${results.length}/${candidateCodes.size} matched`);
  if (results.length > 0) {
    const topMatches = results.slice(0, 3).map(m =>
      `${m.name.slice(0, 40)} score=${m._searchScore} rel=${m._queryRelevance}% qual=${m._conversionScore}${m._pickType ? ` [${m._pickType}]` : ""}`
    );
    console.log(`[smart-search] Top: ${topMatches.join(" | ")}`);
  }

  // ── PHASE 4: Learn — cache results for instant replay ──
  if (results.length > 0 && !strictIdentity.strict) {
    try {
      const cacheResults = results.map(({ _sortScore, _queryRelevance, _conversionScore, _searchScore, ...rest }) => rest);
      sb.from("tour_search_cache").upsert({
        cache_key: cacheKey,
        search_query: searchText.toLowerCase(),
        product_codes: results.map(r => r.productCode),
        result_count: results.length,
        results: cacheResults,
        currency: targetCurrency,
        provider: "smart-search",
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + SMART_SEARCH_CACHE_TTL_MS).toISOString(),
      }, { onConflict: "cache_key" }).then(() => {
        console.log(`[smart-search] Learned "${searchText}" → ${results.length} products cached`);
      });
    } catch (e) { /* learning is best-effort */ }
  } else if (results.length > 0) {
    console.log(`[smart-search] Strict identity query "${searchText}" not cached to avoid replaying broad matches`);
  }

  return results.length > 0 ? results : null;
}

// Legacy wrappers — everything routes through smartSearch
async function getFallbackSearchFromCache(searchText: string, targetCurrency: string, _deepMode = false): Promise<any[] | null> {
  return smartSearch(searchText, targetCurrency, { limit: 50 });
}

async function deepSearchFromProductCache(
  searchText: string,
  targetCurrency: string,
  options: { limit?: number; sortOrder?: string; minRating?: number; priceRange?: { min?: number; max?: number }; destinationCity?: string } = {}
): Promise<any[] | null> {
  return smartSearch(searchText, targetCurrency, options);
}


async function isDestinationFullyCached(destinationName: string, destinationId?: string): Promise<boolean> {
  try {
    const sb = getSupabaseAdmin();
    let query = sb.from("tour_sync_state").select("status").eq("status", "completed");
    
    if (destinationId) {
      query = query.eq("destination_id", String(destinationId));
    } else if (destinationName) {
      query = query.ilike("destination_name", destinationName.trim());
    } else {
      return false;
    }
    
    const { data } = await query.maybeSingle();
    return !!data;
  } catch (e) {
    console.warn("[cache] isDestinationFullyCached error:", e);
    return false;
  }
}

// ── Resolve attraction/landmark name to city ──
async function resolveAttractionToCity(searchText: string): Promise<{ city: string; country: string } | null> {
  try {
    const sb = getSupabaseAdmin();
    const term = searchText.trim();
    
    // 1. Try exact-ish match on attraction name
    const { data } = await sb
      .from("attractions")
      .select("city, country")
      .or(`name.ilike.%${term}%,name_en.ilike.%${term}%`)
      .limit(1)
      .maybeSingle();
    
    if (data?.city) {
      console.log(`[resolve] Attraction "${term}" → city: ${data.city}, country: ${data.country}`);
      return { city: data.city, country: data.country || "" };
    }
    
    // 2. Check tour_sync_state for destination name match (authoritative list)
    const { data: syncMatch } = await sb
      .from("tour_sync_state")
      .select("destination_name")
      .ilike("destination_name", `%${term}%`)
      .maybeSingle();
    
    if (syncMatch) {
      console.log(`[resolve] Sync state match "${term}" → destination: ${syncMatch.destination_name}`);
      return { city: syncMatch.destination_name, country: "" };
    }
  } catch (e) {
    console.warn("[resolve] resolveAttractionToCity error:", e);
  }
  return null;
}

// ── Check if a search term matches a known destination or country ──
// Uses a learning cache: first check destination_classification_cache, then detect and persist
async function isKnownDestination(term: string): Promise<{ isDestination: boolean; isCountry: boolean; cities?: string[] }> {
  const sb = getSupabaseAdmin();
  const t = term.trim();
  const key = t.toLowerCase();

  try {
    // 1. Check learning cache first — O(1) lookup
    const { data: cached } = await sb
      .from("destination_classification_cache")
      .select("classification, resolved_cities, country")
      .eq("term", key)
      .maybeSingle();

    if (cached) {
      // Bump hit count (fire-and-forget)
      sb.from("destination_classification_cache")
        .update({ hit_count: (cached as any).hit_count ? (cached as any).hit_count + 1 : 2, updated_at: new Date().toISOString() })
        .eq("term", key)
        .then(() => {});

      if (cached.classification === "country") {
        console.log(`[dest-detect] CACHE HIT: "${t}" → country (${cached.resolved_cities?.length || 0} cities)`);
        return { isDestination: true, isCountry: true, cities: cached.resolved_cities || [] };
      }
      if (cached.classification === "city" || cached.classification === "attraction") {
        console.log(`[dest-detect] CACHE HIT: "${t}" → ${cached.classification}`);
        return { isDestination: true, isCountry: false };
      }
      // classification === "freetext"
      console.log(`[dest-detect] CACHE HIT: "${t}" → freetext`);
      return { isDestination: false, isCountry: false };
    }

    // 2. No cache hit — detect from source tables
    // Check if it's a country name → return cities in that country
    const { data: countryHits } = await sb
      .from("viator_destination_map")
      .select("city_name, dest_type")
      .ilike("country", t)
      .eq("dest_type", "CITY")
      .limit(50);

    if (countryHits && countryHits.length > 0) {
      const cities = [...new Set(countryHits.map(r => r.city_name))];
      console.log(`[dest-detect] "${t}" is a COUNTRY with ${cities.length} cities → LEARNING`);
      // Persist to cache
      sb.from("destination_classification_cache").upsert({
        term: key, classification: "country", resolved_cities: cities,
        country: t, updated_at: new Date().toISOString(),
      }, { onConflict: "term" }).then(() => {});
      return { isDestination: true, isCountry: true, cities };
    }

    // Check if it's a city/destination name
    const { data: cityHit } = await sb
      .from("viator_destination_map")
      .select("city_name, country, dest_id")
      .ilike("city_name", t)
      .limit(1)
      .maybeSingle();

    if (cityHit) {
      console.log(`[dest-detect] "${t}" is a known CITY destination → LEARNING`);
      sb.from("destination_classification_cache").upsert({
        term: key, classification: "city", resolved_cities: [cityHit.city_name],
        country: cityHit.country || null, dest_id: cityHit.dest_id ? String(cityHit.dest_id) : null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "term" }).then(() => {});
      return { isDestination: true, isCountry: false };
    }

    // Check tour_sync_state
    const { data: syncHit } = await sb
      .from("tour_sync_state")
      .select("destination_name, destination_id")
      .ilike("destination_name", t)
      .limit(1)
      .maybeSingle();

    if (syncHit) {
      console.log(`[dest-detect] "${t}" matched tour_sync_state → LEARNING as city`);
      sb.from("destination_classification_cache").upsert({
        term: key, classification: "city", resolved_cities: [syncHit.destination_name],
        dest_id: syncHit.destination_id || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "term" }).then(() => {});
      return { isDestination: true, isCountry: false };
    }

    // Check attractions table
    const { data: attractionHit } = await sb
      .from("attractions")
      .select("city, country")
      .or(`name.ilike.%${t}%,name_en.ilike.%${t}%`)
      .limit(1)
      .maybeSingle();

    if (attractionHit?.city) {
      console.log(`[dest-detect] "${t}" is an ATTRACTION in ${attractionHit.city} → LEARNING`);
      sb.from("destination_classification_cache").upsert({
        term: key, classification: "attraction", resolved_cities: [attractionHit.city],
        country: attractionHit.country || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "term" }).then(() => {});
      return { isDestination: true, isCountry: false };
    }

    // Nothing matched — learn as freetext so we skip detection next time
    console.log(`[dest-detect] "${t}" is FREETEXT → LEARNING`);
    sb.from("destination_classification_cache").upsert({
      term: key, classification: "freetext",
      updated_at: new Date().toISOString(),
    }, { onConflict: "term" }).then(() => {});

  } catch (e) {
    console.warn("[dest-detect] error:", e);
  }
  return { isDestination: false, isCountry: false };
}

// ── Serve search results entirely from tour_product_cache ──
async function serveFromProductCache(
  searchText: string,
  targetCurrency: string,
  options: {
    tags?: number[];
    priceRange?: { min?: number; max?: number };
    durationRange?: { min?: number; max?: number };
    minRating?: number;
    sortOrder?: string;
    limit?: number;
    start?: number;
    flags?: string[];
    detailOnly?: boolean; // Only return fully-synced products
    destinationCity?: string; // Restrict to this city/metro area
  } = {}
): Promise<any[] | null> {
  try {
    const sb = getSupabaseAdmin();
    const term = searchText.toLowerCase().trim();
    const { limit = 2000, start = 0, sortOrder, minRating, priceRange, detailOnly = false, destinationCity } = options;
    const words = cleanSearchText(term).split(/\s+/).filter(w => w.length >= 3);

    // ── FAST PATH: Detect destination-level search (city/country) ──
    // For these, skip expensive deep scoring — just return ALL products from that destination
    const destInfo = await isKnownDestination(searchText);
    const isDestinationSearch = destInfo.isDestination || destInfo.isCountry;

    // ── ATTRACTION-WITHIN-DESTINATION detection ──
    // If search text looks like "Universal Studios Singapore" (3+ words with a city name),
    // it's an attraction search, NOT a destination search. Route to deep scoring instead.
    const isAttractionWithinDestination = isDestinationSearch && words.length >= 3 && (() => {
      // Get the resolved city/destination name from dest info
      const resolvedCities = destInfo.cities || [];
      const destWords = new Set<string>();
      for (const city of resolvedCities) {
        for (const w of city.toLowerCase().split(/\s+/)) {
          if (w.length >= 3) destWords.add(w);
        }
      }
      // Also check if the search term itself contains a known city name as a substring
      const KNOWN_CITY_NAMES = ["singapore", "kuala lumpur", "langkawi", "penang", "bangkok", "bali",
        "tokyo", "london", "paris", "dubai", "istanbul", "seoul", "taipei", "hong kong",
        "mumbai", "delhi", "dhaka", "colombo", "kathmandu", "jakarta", "hanoi"];
      for (const cn of KNOWN_CITY_NAMES) {
        if (term.includes(cn)) {
          for (const w of cn.split(/\s+/)) destWords.add(w);
        }
      }
      if (destWords.size === 0) return false;
      // Count how many search words are NOT part of the destination name
      const nonDestWords = words.filter(w => !destWords.has(w));
      // If 2+ non-destination words remain, it's an attraction search
      return nonDestWords.length >= 2;
    })();

    if (isAttractionWithinDestination) {
      console.log(`[cache] ATTRACTION-IN-DEST detected: "${searchText}" — routing to deep search instead of destination-level`);
      // Fall through to deep search path below (skip destination fast-path)
    } else if (isDestinationSearch) {
      console.log(`[cache] DESTINATION-DIRECT: "${searchText}" (${destInfo.isCountry ? "country" : "city"}) — fetching all products`);

      const selectCols = "product_code, vela_id, slug, title, price, currency, rating, review_count, image_url, images, duration, category, short_description, destination, pricing_type, highlights, tags, places_covered, age_bands, detail_fetched";

      let data: any[] = [];
      let totalAvailable = 0;

      if (destInfo.isCountry && destInfo.cities?.length) {
        // Country search: fetch from ALL cities in that country
        const cityFilters = destInfo.cities.slice(0, 30).map(c => `destination.ilike.%${c}%`);
        // Count query (fast, head-only)
        let countQ = sb.from("tour_product_cache").select("*", { count: "exact", head: true })
          .eq("is_active", true).gt("price", 0)
          .or(cityFilters.join(","));
        if (detailOnly) countQ = countQ.eq("detail_fetched", true);
        if (minRating && minRating > 0) countQ = countQ.gte("rating", minRating);
        if (priceRange?.min) countQ = countQ.gte("price", priceRange.min);
        if (priceRange?.max) countQ = countQ.lte("price", priceRange.max);
        const { count: cnt } = await countQ;
        totalAvailable = cnt || 0;

        // Paginate to bypass Supabase 1000-row default limit
        const buildQuery = () => {
          let q = sb.from("tour_product_cache").select(selectCols)
            .eq("is_active", true).gt("price", 0)
            .or(cityFilters.join(","));
          if (detailOnly) q = q.eq("detail_fetched", true);
          if (minRating && minRating > 0) q = q.gte("rating", minRating);
          if (priceRange?.min) q = q.gte("price", priceRange.min);
          if (priceRange?.max) q = q.lte("price", priceRange.max);
          if (sortOrder === "PRICE") q = q.order("price", { ascending: true });
          else if (sortOrder === "TRAVELER_RATING") q = q.order("rating", { ascending: false });
          else q = q.order("review_count", { ascending: false });
          return q;
        };
        const pageSize = 1000;
        for (let offset = start; offset < start + limit; offset += pageSize) {
          const end = Math.min(offset + pageSize - 1, start + limit - 1);
          const { data: page } = await buildQuery().range(offset, end);
          if (!page || page.length === 0) break;
          data.push(...page);
          if (page.length < pageSize) break;
        }
        console.log(`[cache] Country "${searchText}" → ${destInfo.cities.length} cities → ${data.length}/${totalAvailable} products`);
      } else {
        // City search: count first
        let countQ = sb.from("tour_product_cache").select("*", { count: "exact", head: true })
          .eq("is_active", true).gt("price", 0)
          .ilike("destination", `%${term}%`);
        if (detailOnly) countQ = countQ.eq("detail_fetched", true);
        if (minRating && minRating > 0) countQ = countQ.gte("rating", minRating);
        if (priceRange?.min) countQ = countQ.gte("price", priceRange.min);
        if (priceRange?.max) countQ = countQ.lte("price", priceRange.max);
        const { count: cnt } = await countQ;
        totalAvailable = cnt || 0;

        // City search: paginate to bypass 1000-row limit
        const buildCityQuery = () => {
          let q = sb.from("tour_product_cache").select(selectCols)
            .eq("is_active", true).gt("price", 0)
            .ilike("destination", `%${term}%`);
          if (detailOnly) q = q.eq("detail_fetched", true);
          if (minRating && minRating > 0) q = q.gte("rating", minRating);
          if (priceRange?.min) q = q.gte("price", priceRange.min);
          if (priceRange?.max) q = q.lte("price", priceRange.max);
          if (sortOrder === "PRICE") q = q.order("price", { ascending: true });
          else if (sortOrder === "TRAVELER_RATING") q = q.order("rating", { ascending: false });
          else q = q.order("review_count", { ascending: false });
          return q;
        };
        const cityPageSize = 1000;
        for (let offset = start; offset < start + limit; offset += cityPageSize) {
          const end = Math.min(offset + cityPageSize - 1, start + limit - 1);
          const { data: page } = await buildCityQuery().range(offset, end);
          if (!page || page.length === 0) break;
          data.push(...page);
          if (page.length < cityPageSize) break;
        }

        // Also check sub-destinations (e.g., Singapore → Sentosa Island)
        if (data.length < limit) {
          const { data: siblingDests } = await sb.from("viator_destination_map")
            .select("city_name, country")
            .ilike("city_name", term.trim())
            .limit(1)
            .maybeSingle();
          if (siblingDests?.country) {
            const { data: subDests } = await sb.from("viator_destination_map")
              .select("city_name")
              .ilike("country", siblingDests.country)
              .eq("dest_type", "CITY")
              .limit(30);
            if (subDests && subDests.length > 1) {
              const existingCodes = new Set(data.map(p => p.product_code));
              const subCities = [...new Set(subDests.map(d => d.city_name).filter(c => c.toLowerCase() !== term))];
              if (subCities.length > 0) {
                const subFilters = subCities.map(c => `destination.ilike.%${c}%`);
                let subQuery = sb.from("tour_product_cache").select(selectCols)
                  .eq("is_active", true).gt("price", 0)
                  .or(subFilters.join(","))
                  .order("review_count", { ascending: false })
                  .limit(limit - data.length);
                if (detailOnly) subQuery = subQuery.eq("detail_fetched", true);
                const { data: subData } = await subQuery;
                if (subData) {
                  for (const p of subData) {
                    if (!existingCodes.has(p.product_code)) {
                      existingCodes.add(p.product_code);
                      data.push(p);
                      totalAvailable++;
                    }
                  }
                }
                console.log(`[cache] Sub-destination broadening for "${searchText}" → +${subCities.join(", ")} → ${data.length} total`);
              }
            }
          }
        }

        console.log(`[cache] City "${searchText}" → ${data.length}/${totalAvailable} products`);
      }

      if (data.length === 0) return null;

      // Convert to output shape + compute conversion score for smart sorting
      const exchangeData = await getExchangeRates();
      const products = data.map(p => {
        let price = p.price || 0;
        const pCurrency = p.currency || "USD";
        if (pCurrency !== targetCurrency && price > 0) {
          price = convertPrice(price, pCurrency, targetCurrency, exchangeData.rates, exchangeData.markup);
        }
        // Composite conversion score (0-100): prioritizes bookable, rich, popular products
        const hasPlaces = Array.isArray(p.places_covered) && p.places_covered.length > 0;
        const hasHighlights = Array.isArray(p.highlights) && p.highlights.length > 0;
        const hasDetail = p.detail_fetched === true;
        const hasImage = !!(p.image_url || (p.images && p.images.length > 0));
        const rating = p.rating || 0;
        const reviews = p.review_count || 0;

        const conversionScore = (
          (hasDetail ? 15 : 0) +
          (hasPlaces ? 20 : 0) +
          (hasHighlights ? 10 : 0) +
          (hasImage ? 5 : 0) +
          Math.min(rating * 5, 25) +    // max 25 for 5.0 rating
          Math.min(reviews / 40, 25)     // max 25 at 1000+ reviews
        );

        return {
          id: `viator-${p.product_code}`, productCode: p.product_code,
          velaId: p.vela_id || null, slug: p.slug || null,
          name: p.title, destination: p.destination || searchText,
          duration: p.duration || "", price, currency: targetCurrency,
          category: p.category || "Tour", rating,
          reviewCount: reviews,
          image: p.image_url || (p.images && p.images[0]) || null,
          images: p.images || [], highlights: p.highlights || [],
          shortDescription: p.short_description || "",
           pricingType: p.pricing_type || "PER_PERSON",
           maxGroupSize: (p.pricing_type || "PER_PERSON") === "PER_GROUP" ? extractMaxGroupSize(p.age_bands) : null,
          placesCovered: Array.isArray(p.places_covered) ? p.places_covered : [],
          tagIds: Array.isArray(p.tags) ? p.tags.map((t: any) => typeof t === 'number' ? t : parseInt(t)).filter((t: number) => !isNaN(t)) : [],
          source: "viator", _fromCache: true,
          _conversionScore: conversionScore,
        };
      });

      // Smart sort: by conversion score (rich+popular first), unless user explicitly chose price/rating
      if (!sortOrder || sortOrder === "DEFAULT") {
        products.sort((a: any, b: any) => b._conversionScore - a._conversionScore);
      }

      // Tag filtering
      if (options.tags?.length) {
        const tagSet = new Set(options.tags.map(t => String(t)));
        const filtered = products.filter(p => p.tagIds.some((t: number) => tagSet.has(String(t))));
        if (filtered.length > 0) { (filtered as any)._totalAvailable = totalAvailable; return filtered; }
      }

      console.log(`[cache] DESTINATION-DIRECT served ${products.length}/${totalAvailable} products for "${searchText}"`);
      (products as any)._totalAvailable = totalAvailable;

      // Fire-and-forget: trigger DB-level backfill for products missing highlights/places_covered
      sb.rpc("backfill_tour_highlights", { batch_size: 500 }).then(({ data: bf }) => {
        if (bf?.fixed > 0) console.log(`[cache] Auto-backfilled ${bf.fixed} products highlights (${bf.remaining} remaining)`);
      }).catch(() => {});

      return products;
    }

    // ── SMART PATH: Attraction/landmark/specific searches — use deep scoring ──
    const deepResults = await deepSearchFromProductCache(searchText, targetCurrency, { limit, sortOrder, minRating, priceRange, destinationCity });
    if (deepResults && deepResults.length > 0) {
      console.log(`[cache] Smart search served ${deepResults.length} products for "${searchText}"`);
      return deepResults;
    }

    const selectCols = "product_code, vela_id, slug, title, price, currency, rating, review_count, image_url, images, duration, category, short_description, destination, pricing_type, highlights, tags, places_covered, age_bands, detail_fetched";

    // Determine if this looks like a specific attraction search (3+ words) or a general search
    const isSpecificSearch = words.length >= 3;

    const applyFilters = (q: any) => {
      if (detailOnly) q = q.eq("detail_fetched", true);
      if (minRating && minRating > 0) q = q.gte("rating", minRating);
      if (priceRange?.min) q = q.gte("price", priceRange.min);
      if (priceRange?.max) q = q.lte("price", priceRange.max);
      if (sortOrder === "PRICE") q = q.order("price", { ascending: true });
      else if (sortOrder === "TRAVELER_RATING") q = q.order("rating", { ascending: false });
      else q = q.order("review_count", { ascending: false });
      q = q.range(start, start + limit - 1);
      return q;
    };

    let data: any[] | null = null;

    if (isSpecificSearch) {
      const commonWords = new Set(["the", "and", "for", "with", "from", "tour", "trip", "day", "city"]);
      const specificWords = words.filter(w => !commonWords.has(w));
      let query = sb.from("tour_product_cache").select(selectCols).eq("is_active", true).gt("price", 0);
      for (const word of specificWords.slice(0, 3)) {
        query = query.ilike("title", `%${word}%`);
      }
      const result = await applyFilters(query);
      data = result.data;
    } else {
      // Short non-destination query — OR search across destination + title
      const orFilters: string[] = [];
      for (const word of words) {
        orFilters.push(`destination.ilike.%${word}%`);
        orFilters.push(`title.ilike.%${word}%`);
      }
      if (orFilters.length > 0) {
        let query = sb.from("tour_product_cache").select(selectCols).eq("is_active", true).gt("price", 0)
          .or(orFilters.join(","));
        const result = await applyFilters(query);
        data = result.data;
      }
    }

    if (!data || data.length === 0) return null;

    // Convert to output shape
    const exchangeData = await getExchangeRates();
    const products = data.map(p => {
      let price = p.price || 0;
      const pCurrency = p.currency || "USD";
      if (pCurrency !== targetCurrency && price > 0) {
        price = convertPrice(price, pCurrency, targetCurrency, exchangeData.rates, exchangeData.markup);
      }
      return {
        id: `viator-${p.product_code}`, productCode: p.product_code,
        velaId: p.vela_id || null, slug: p.slug || null,
        name: p.title, destination: p.destination || searchText,
        duration: p.duration || "", price, currency: targetCurrency,
        category: p.category || "Tour", rating: p.rating || 0,
        reviewCount: p.review_count || 0,
        image: p.image_url || (p.images && p.images[0]) || null,
        images: p.images || [], highlights: p.highlights || [],
        shortDescription: p.short_description || "",
        pricingType: p.pricing_type || "PER_PERSON",
        maxGroupSize: (p.pricing_type || "PER_PERSON") === "PER_GROUP" ? extractMaxGroupSize(p.age_bands) : null,
        placesCovered: Array.isArray(p.places_covered) ? p.places_covered : [],
        tagIds: Array.isArray(p.tags) ? p.tags.map((t: any) => typeof t === 'number' ? t : parseInt(t)).filter((t: number) => !isNaN(t)) : [],
        source: "viator", _fromCache: true,
      };
    });

    if (options.tags?.length) {
      const tagSet = new Set(options.tags.map(t => String(t)));
      const filtered = products.filter(p => p.tagIds.some((t: number) => tagSet.has(String(t))));
      if (filtered.length > 0) return filtered;
    }

    console.log(`[cache] Served ${products.length} products from DB for "${searchText}" (detailOnly=${detailOnly})`);
    return products;
  } catch (e) {
    console.warn("[cache] serveFromProductCache error:", e);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════
// ── TOUR PROVIDER HANDLERS (CACHE-ONLY) ──
// ═══════════════════════════════════════════════════════════

async function tourSearch(body: any, targetCurrency: string) {
  const {
    destinationId, tags, startDate, endDate, sortOrder = "DEFAULT",
    limit = 30, searchText, start = 1,
    // ── Phase 1: Server-side native filters ──
    priceRange, durationRange, rating: minRating, flags,
    cacheOnly: _cacheOnlyParam = true, // Cache-only mode
  } = body;
  const cacheOnly = true; // Always cache-only

  const MIN_CACHE_THRESHOLD = cacheOnly ? 0 : 5; // In cache-only mode, return whatever we have
  const cacheKey = `vs:${destinationId || ""}:${searchText || ""}:${tags?.join(",") || ""}:${startDate || ""}:USD:${limit}:${start}:${JSON.stringify(priceRange || "")}:${JSON.stringify(durationRange || "")}:${minRating || ""}:${sortOrder}`;
  
  // ── Serve from DB cache ──
  let destName = searchText || (destinationId ? `Destination ${destinationId}` : "");
  if (!body.skipCache || cacheOnly) {
    // Resolve attraction/landmark to city for better cache matching
    let resolvedCity = destName;
    if (searchText) {
      const attractionMatch = await resolveAttractionToCity(searchText);
      if (attractionMatch?.city) {
        resolvedCity = attractionMatch.city;
        console.log(`[tourSearch] Attraction "${searchText}" → city "${resolvedCity}"`);
      }
    }

    // Always try DB product cache first — regardless of sync status
    const dbResults = await serveFromProductCache(resolvedCity, targetCurrency, {
      tags, priceRange, durationRange, minRating, sortOrder, limit, start: start - 1, flags,
      detailOnly: cacheOnly, // In cache-only mode, only return fully-synced products
    });
    if (dbResults && dbResults.length >= MIN_CACHE_THRESHOLD) {
      console.log(`[tourSearch] Serving ${dbResults.length} products from DB for "${resolvedCity}"`);
      // Record search hit for analytics
      {
        recordSearchHitInline(destinationId || resolvedCity, resolvedCity, dbResults.length).catch(() => {});
      }
      return json({
        success: true, tours: dbResults, totalCount: (dbResults as any)._totalAvailable || dbResults.length,
        currency: targetCurrency, cached: true, source: "db",
      });
    }

    // Check short-lived search cache
    const cached = await getCachedSearch(cacheKey);
    if (cached) {
      if ("USD" !== targetCurrency) {
        const ex = await getExchangeRates();
        for (const p of cached) {
          if (p.currency !== targetCurrency) {
            p.price = convertPrice(p.price, p.currency, targetCurrency, ex.rates, ex.markup);
            p.currency = targetCurrency;
          }
        }
      }
      return json({ success: true, tours: cached, totalCount: cached.length, currency: targetCurrency, cached: true });
    }
  }

  // No results in cache
  if (cacheOnly) {
    console.log(`[tourSearch] No cache results found`);
    return json({
      success: true, tours: [], totalCount: 0,
      currency: targetCurrency, cached: true, source: "db",
    });
  }

}

async function tourFreetext(body: any, targetCurrency: string) {
  const { searchText, limit = 50, start = 1, progressive = false, cacheOnly: _cacheOnlyParam2 = true } = body;
  const cacheOnly = true; // Always cache-only
  if (!searchText) return json({ success: false, error: "searchText is required" }, 400);


  const MIN_CACHE_THRESHOLD = cacheOnly ? 0 : 5;
  const cacheKey = `vf:${searchText.toLowerCase().trim()}:USD:${start}:${limit}`;

  // ── Extract destination city from search text for filtering ──
  // Detect known city names embedded in the search query (e.g., "Universal Studios Singapore" → "Singapore")
  const FREETEXT_CITY_DETECT: Record<string, string> = {
    singapore: "Singapore", "kuala lumpur": "Kuala Lumpur", langkawi: "Langkawi",
    penang: "Penang", bangkok: "Bangkok", bali: "Bali", tokyo: "Tokyo",
    london: "London", paris: "Paris", dubai: "Dubai", istanbul: "Istanbul",
    seoul: "Seoul", taipei: "Taipei", "hong kong": "Hong Kong", mumbai: "Mumbai",
    delhi: "Delhi", dhaka: "Dhaka", colombo: "Colombo", jakarta: "Jakarta",
    hanoi: "Hanoi", phuket: "Phuket", "chiang mai": "Chiang Mai", rome: "Rome",
    barcelona: "Barcelona", lisbon: "Lisbon", athens: "Athens", cairo: "Cairo",
    "ho chi minh": "Ho Chi Minh", kathmandu: "Kathmandu",
    // Sub-destinations that should map to their metro parent
    sentosa: "Singapore", "sentosa island": "Singapore",
    genting: "Kuala Lumpur", "genting highlands": "Kuala Lumpur",
    putrajaya: "Kuala Lumpur", "batu caves": "Kuala Lumpur",
    "george town": "Penang", "batu ferringhi": "Penang", "batu ferringi": "Penang",
  };
  let detectedDestCity: string | undefined;
  const searchLowerTrimmed = searchText.toLowerCase().trim();
  // Check longer names first to match "kuala lumpur" before "lumpur"
  const sortedCityKeys = Object.keys(FREETEXT_CITY_DETECT).sort((a, b) => b.length - a.length);
  for (const cityKey of sortedCityKeys) {
    if (searchLowerTrimmed.includes(cityKey)) {
      // Only treat as destination filter if there are OTHER words beyond the city name
      // (i.e., it's an attraction search, not just "Singapore")
      const remainingText = searchLowerTrimmed.replace(cityKey, "").trim();
      const remainingWords = cleanSearchText(remainingText).split(/\s+/).filter(w => w.length >= 3);
      if (remainingWords.length >= 1) {
        detectedDestCity = FREETEXT_CITY_DETECT[cityKey];
        console.log(`[tourFreetext] Detected destination "${detectedDestCity}" in search "${searchText}" (attraction words: ${remainingWords.join(", ")})`);
        break;
      }
    }
  }
  const strictIdentityQuery = getStrictIdentityContext(searchText, detectedDestCity);
  if (strictIdentityQuery.strict) {
    console.log(`[tourFreetext] Strict identity query "${searchText}" will use exact attraction search only`);
  }

  // ── Serve from DB cache ──
  if (start === 1 && (!body.skipCache || cacheOnly)) {
    // Resolve city name (attraction → city mapping)
    let resolvedCity = searchText;
    const attractionMatch = await resolveAttractionToCity(searchText);
    if (attractionMatch?.city) {
      resolvedCity = attractionMatch.city;
      console.log(`[tourFreetext] Attraction "${searchText}" → city "${resolvedCity}"`);
      // If we didn't detect a dest city from known names, use the resolved city
      if (!detectedDestCity) detectedDestCity = attractionMatch.city;
    }

    // Always try DB product cache first
    // If user searched a specific attraction, try matching by original term first
    if (resolvedCity !== searchText) {
      const specificResults = await serveFromProductCache(searchText, targetCurrency, { limit, detailOnly: cacheOnly, destinationCity: detectedDestCity });
      if (specificResults && specificResults.length >= MIN_CACHE_THRESHOLD) {
        console.log(`[tourFreetext] Serving ${specificResults.length} specific products from DB for "${searchText}" (destFilter: ${detectedDestCity || "none"})`);
        recordSearchHitInline(resolvedCity, resolvedCity, specificResults.length).catch(() => {});
        const exactTotal = (specificResults as any)._totalAvailable || specificResults.length;
        return json({
          success: true, products: specificResults,
          destinations: [], attractions: [],
          totalProducts: exactTotal, hasMore: false, nextStart: specificResults.length + 1,
          currency: targetCurrency, cached: true, source: "db",
          resolvedCity,
        });
      }
      if (strictIdentityQuery.strict) {
        console.log(`[tourFreetext] Strict identity query "${searchText}" returned no exact products; skipping city fallback`);
        return json({
          success: true, products: [],
          destinations: [], attractions: [],
          totalProducts: 0, hasMore: false, nextStart: 1,
          currency: targetCurrency, cached: true, source: "db",
          resolvedCity,
        });
      }
    }

    // Fall back to full city results
    const dbResults = await serveFromProductCache(resolvedCity, targetCurrency, { limit, detailOnly: cacheOnly, destinationCity: detectedDestCity });
    if (dbResults && dbResults.length >= MIN_CACHE_THRESHOLD) {
      console.log(`[tourFreetext] Serving ${dbResults.length} products from DB for "${resolvedCity}"`);
      // If user searched an attraction name, filter/boost products matching that name
      let finalResults = dbResults;
      if (resolvedCity !== searchText) {
        const termLower = searchText.toLowerCase();
        const words = cleanSearchText(termLower).split(/\s+/).filter(w => w.length >= 3);
        const matching = dbResults.filter(p => {
          const name = p.name?.toLowerCase() || "";
          const matchCount = words.filter(w => name.includes(w)).length;
          return matchCount >= 2 || name.includes(termLower);
        });
        if (matching.length >= 3) {
          finalResults = matching;
        } else {
          const nonMatching = dbResults.filter(p => {
            const name = p.name?.toLowerCase() || "";
            const matchCount = words.filter(w => name.includes(w)).length;
            return matchCount < 2 && !name.includes(termLower);
          });
          finalResults = [...matching, ...nonMatching];
        }
      }
      const exactTotal = (dbResults as any)._totalAvailable || finalResults.length;
      recordSearchHitInline(resolvedCity, resolvedCity, finalResults.length).catch(() => {});
      return json({
        success: true, products: finalResults,
        destinations: [], attractions: [],
        totalProducts: exactTotal, hasMore: false, nextStart: finalResults.length + 1,
        currency: targetCurrency, cached: true, source: "db",
        resolvedCity: resolvedCity !== searchText ? resolvedCity : undefined,
      });
    }
  }

  // No results in cache
  if (cacheOnly) {
    console.log(`[tourFreetext] No cache results found for "${searchText}"`);
    return json({
      success: true, products: [], destinations: [], attractions: [],
      totalProducts: 0, hasMore: false, nextStart: 1,
      currency: targetCurrency, cached: true, source: "db",
    });
  }
}

// ── Multi-freetext: batch parallel freetext queries in a single HTTP call ──
// Accepts { queries: [{ searchText, city }], targetCurrency, limit }
// Returns { results: { [key]: { products, resolvedCity } } }
async function tourMultiFreetext(body: any, targetCurrency: string) {
  const { queries, limit = 15 } = body;
  if (!Array.isArray(queries) || queries.length === 0) {
    return json({ success: false, error: "queries array is required" }, 400);
  }
  if (queries.length > 50) {
    return json({ success: false, error: "Max 50 queries per batch" }, 400);
  }

  const t0 = performance.now();
  console.log(`[multi-freetext] Processing ${queries.length} queries in parallel`);

  // Run all freetext searches in parallel internally (no HTTP overhead)
  const results: Record<string, any> = {};
  await Promise.all(queries.map(async (q: any, idx: number) => {
    const searchText = q.searchText || q.title || "";
    const city = q.city || "";
    const key = q.key || `${city}::${searchText}`;
    if (!searchText || searchText.length < 3) {
      results[key] = { products: [], resolvedCity: null };
      return;
    }
    try {
      // Call tourFreetext internally — it returns a Response, parse it
      const fakeBody = { searchText, limit, targetCurrency, skipCache: false };
      const response = await tourFreetext(fakeBody, targetCurrency);
      const data = await response.json();
      results[key] = {
        products: data.products || [],
        resolvedCity: data.resolvedCity || null,
        totalProducts: data.totalProducts || 0,
      };
    } catch (e: any) {
      console.warn(`[multi-freetext] Error for "${searchText}": ${e.message}`);
      results[key] = { products: [], resolvedCity: null };
    }
  }));

  const elapsed = Math.round(performance.now() - t0);
  const totalProducts = Object.values(results).reduce((sum: number, r: any) => sum + (r.products?.length || 0), 0);
  console.log(`[multi-freetext] ✅ Done in ${elapsed}ms — ${Object.keys(results).length} queries, ${totalProducts} total products`);

  return json({
    success: true,
    results,
    timing_ms: elapsed,
    queryCount: queries.length,
    currency: targetCurrency,
  });
}

async function tourProduct(body: any, targetCurrency: string) {
  let { productCode } = body;
  if (!productCode) return json({ success: false, error: "productCode is required" }, 400);

  // Guard: if productCode looks like a slug, resolve it first
  const isSlug = /^[a-z0-9-]+$/.test(productCode) && productCode.includes("-") && !/^\d+P\d+/i.test(productCode);
  if (isSlug) {
    console.log(`[tourProduct] Detected slug instead of productCode: ${productCode}, resolving...`);
    const sb = getSupabaseAdmin();
    const { data: cached } = await sb.from("tour_product_cache").select("product_code").eq("slug", productCode).maybeSingle();
    if (cached?.product_code) {
      productCode = cached.product_code;
      console.log(`[tourProduct] Resolved slug to: ${productCode}`);
    } else {
      // Try fuzzy match on slug keywords
      const words = productCode.split("-").filter((w: string) => w.length > 3);
      if (words.length >= 2) {
        const pattern = `%${words.slice(0, 4).join("%")}%`;
        const { data: fuzzy } = await sb.from("tour_product_cache").select("product_code, slug").ilike("slug", pattern).limit(1);
        if (fuzzy?.[0]?.product_code) {
          productCode = fuzzy[0].product_code;
          console.log(`[tourProduct] Fuzzy-resolved slug to: ${productCode}`);
        } else {
          return json({ success: false, error: "Could not resolve tour slug to a valid product code" }, 404);
        }
      } else {
        return json({ success: false, error: "Invalid product code format" }, 400);
      }
    }
  }


  // ── Serve from DB cache ──
  const cachedProduct = await getCachedProduct(productCode);
  
  if (cachedProduct && (cachedProduct._detailFetched || cachedProduct._cachedPrice > 0)) {
    console.log(`[tourProduct] Serving from cache: ${productCode} (detail_fetched=${cachedProduct._detailFetched})`);
    const raw = cachedProduct;
    const exchangeData = await getExchangeRates();
    const cachedCurrency = raw._cachedCurrency || "USD";

    // Build product from cached raw data with currency conversion
    let finalPrice = 0;
    if (raw._cachedPrice > 0) {
      finalPrice = cachedCurrency === targetCurrency
        ? raw._cachedPrice
        : convertPrice(raw._cachedPrice, cachedCurrency, targetCurrency, exchangeData.rates, exchangeData.markup);
    } else {
      const rawPrice = raw.pricing?.summary?.fromPrice || raw.pricing?.fromPrice || 0;
      const rawCurrency = raw.pricing?.currency || cachedCurrency;
      finalPrice = rawCurrency === targetCurrency ? rawPrice : convertPrice(rawPrice, rawCurrency, targetCurrency, exchangeData.rates, exchangeData.markup);
    }

    let duration = "";
    const dur = raw.duration || raw.itinerary?.duration || {};
    if (dur.fixedDurationInMinutes) {
      const totalMin = dur.fixedDurationInMinutes;
      const h = Math.floor(totalMin / 60);
      const m = totalMin % 60;
      duration = h > 0 ? (m > 0 ? `${h} hours ${m} min` : `${h} hours`) : `${m} min`;
    } else if (dur.variableDurationFromMinutes) {
      const fromMin = dur.variableDurationFromMinutes;
      const toMin = dur.variableDurationToMinutes || fromMin;
      if (fromMin < 60 && toMin < 60) duration = `${fromMin}–${toMin} min`;
      else if (fromMin < 60) duration = `${fromMin} min – ${Math.floor(toMin / 60)} hours`;
      else {
        const fromH = Math.floor(fromMin / 60);
        const toH = Math.ceil(toMin / 60);
        duration = fromH === toH ? `${fromH} hours` : `${fromH}–${toH} hours`;
      }
    }

    const rawPricingType = (raw._pricingType || raw.pricingInfo?.type || raw.pricing?.type || raw.pricing?.pricingType || "").toUpperCase();
    const isGroupFromUnit = (raw.title || "").toLowerCase().includes("private");
    const pricingType = rawPricingType === "PER_GROUP" || rawPricingType === "UNIT" ? "PER_GROUP"
      : isGroupFromUnit && rawPricingType !== "PER_PERSON" ? "PER_GROUP" : "PER_PERSON";

    const reviews = raw.reviews || {};
    const rating = reviews.combinedAverageRating || 0;
    const reviewCount = reviews.totalReviews || 0;
    const tagMap: Record<number, string> = {}; // Tags resolved from cached product_data
    const tags = resolveTagHighlights(raw.tags || [], tagMap);
    const highlights = raw.highlights || [];
    const inclusions = (raw.inclusions || []).map((item: any) =>
      typeof item === "string" ? item : item.otherDescription || item.typeDescription || "Included"
    );
    const exclusions = (raw.exclusions || []).map((item: any) =>
      typeof item === "string" ? item : item.otherDescription || item.typeDescription || "Not included"
    );
    const cancellation = raw.cancellationPolicy?.description || "";
    const destination = resolveProductDestination(raw, await getDestIdToNameMap());

    // Use cached schedule pricing if available, otherwise fetch on-demand
    let cachedSchedulePricing = raw._schedulePricing || {};
    let cachedOptionPricing: Record<string, { fromPrice: number; currency: string }> = cachedSchedulePricing.optionPricing || {};

    // If product has multiple options but no option pricing cached, fetch schedule on-demand
    const rawOptions = raw.productOptions || [];

    const productOptions = (rawOptions).map((o: any) => {
      const code = o.productOptionCode || "";
      const optPriceData = cachedOptionPricing[code];
      let optPrice: number | null = null;
      if (optPriceData) {
        optPrice = optPriceData.currency !== targetCurrency
          ? convertPrice(optPriceData.fromPrice, optPriceData.currency, targetCurrency, exchangeData.rates, exchangeData.markup)
          : optPriceData.fromPrice;
      }
      return {
        productOptionCode: code,
        title: o.title || o.description || "",
        description: o.description || o.title || "",
        languageGuides: o.languageGuides || [],
        fromPrice: optPrice, currency: targetCurrency,
      };
    });

    const rawAgeBands = raw.pricingInfo?.ageBands || raw._ageBands || [];
    const ageBands = rawAgeBands.map((band: any) => {
      const bandPrice = band.prices?.fromPrice ?? band.retailPrice ?? band.price ?? null;
      const bandCurrency = band.prices?.currency || raw.pricingInfo?.currency || cachedCurrency;
      let convertedPrice: number | null = null;
      if (bandPrice !== null && bandPrice !== undefined) {
        convertedPrice = bandCurrency !== targetCurrency
          ? convertPrice(bandPrice, bandCurrency, targetCurrency, exchangeData.rates, exchangeData.markup)
          : bandPrice;
      }
      return {
        bandId: band.bandId || band.ageBand || "",
        startAge: band.startAge ?? 0, endAge: band.endAge ?? null,
        minTravelersPerBooking: band.minTravelersPerBooking ?? 0,
        maxTravelersPerBooking: band.maxTravelersPerBooking ?? null,
        price: convertedPrice, currency: targetCurrency,
      };
    });

    const images = (raw.images || []).map((img: any) => {
      const variants = img.variants || [];
      return { variants: variants.map((v: any) => ({ url: v.url, width: v.width, height: v.height })) };
    });

    const product = {
      productCode: raw.productCode,
      title: raw.title || "Untitled Tour",
      description: raw.description || "",
      shortDescription: raw.shortDescription || "",
      destination, duration,
      price: finalPrice, currency: targetCurrency, pricingType,
      maxGroupSize: pricingType === "PER_GROUP" ? extractMaxGroupSize(rawAgeBands) : null,
      rating, reviewCount,
      images, tags, highlights, inclusions, exclusions,
      cancellationPolicy: cancellation,
      itinerary: raw.itinerary || {},
      productOptions, ageBands,
      bookingQuestions: raw.bookingQuestions || [],
      logistics: raw.logistics || {},
      bookingUrl: raw.productUrl || "",
      flags: raw.flags || [],
      maxTravelersPerBooking: raw.maxTravelersPerBooking || null,
      ticketInfo: raw.ticketInfo || null,
      _fromCache: true,
      _partialCache: !cachedProduct._detailFetched,
    };

    // Note: partial cache products will be enriched by tour-inventory-sync cron

    return json({ success: true, product, currency: targetCurrency });
  }

}

async function tourReviews(body: any) {
  const { productCode, count = 10, page = 1 } = body;
  if (!productCode) return json({ success: false, error: "productCode is required" }, 400);

  // ── Serve from DB cache ──
  if (page === 1) {
    try {
      const cached = await getCachedProduct(productCode);
      if (cached?.reviews?.reviews?.length > 0) {
        const rawReviews = cached.reviews.reviews || [];
        const reviews = rawReviews.slice(0, count).map((r: any) => ({
          userName: r.userName || "Traveler", rating: r.rating || 0,
          text: r.text || r.reviewText || "", title: r.title || "",
          publishedDate: r.publishedDate || r.submissionDate || "",
          provider: r.provider || "", avatarUrl: r.avatarUrl || null, travelerType: r.travelerType || "",
        }));
        console.log(`[reviews] Serving ${reviews.length} cached reviews for ${productCode}`);
        return json({
          success: true, reviews,
          totalReviews: cached.reviews.totalReviews || cached.reviews.totalCount || reviews.length,
          averageRating: cached.reviews.combinedAverageRating || 0,
          _fromCache: true,
        });
      }
    } catch (e) { console.warn("[reviews] Cache read error:", e); }
  }
}


async function tourDestinations() {
  try {
    const sb = getSupabaseAdmin();
    const { data: mapData } = await sb
      .from("viator_destination_map")
      .select("dest_id, city_name")
      .limit(500);
    if (mapData && mapData.length > 0) {
      const destinations = mapData.map((r: any) => ({
        ref: r.dest_id, destinationName: r.city_name, type: "CITY",
      }));
      return json({ success: true, destinations, source: "db" });
    }
  } catch (e) { console.warn("[tour-dests] DB error:", e); }
  return json({ success: false, error: "Destinations temporarily unavailable" }, 503);
}

// ═══════════════════════════════════════════════════════════
// ── TRENDING DESTINATIONS (Phase 2) ──
// ═══════════════════════════════════════════════════════════

async function trendingDestinations(body: any) {
  const { country = "", limit = 12 } = body;

  // First try: get from cached product data (most popular destinations)
  try {
    const sb = getSupabaseAdmin();
    const { data: cached } = await sb
      .from("tour_product_cache")
      .select("destination")
      .not("destination", "eq", "")
      .limit(500);

    if (cached && cached.length > 0) {
      // Count destinations
      const counts: Record<string, number> = {};
      for (const r of cached) {
        const d = r.destination;
        if (d) counts[d] = (counts[d] || 0) + 1;
      }
      const sorted = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit);

      if (sorted.length >= 4) {
        const trending = sorted.map(([name, count]) => ({
          name, activityCount: count,
        }));
        return json({ success: true, destinations: trending, source: "cache" });
      }
    }
  } catch (e) { console.warn("[trending] Cache error:", e); }

}

// ═══════════════════════════════════════════════════════════
// ── TAGS / CATEGORIES (Phase 3) ──
// ═══════════════════════════════════════════════════════════

async function tourTags() {
  const tagMap: Record<number, string> = {}; // Tags resolved from cached product_data
  
  // Return organized categories
  const categories = Object.entries(CATEGORY_TAG_MAP).map(([key, tagIds]) => ({
    key,
    tagIds,
    labels: tagIds.map(id => tagMap[id] || `Tag ${id}`).filter(l => !l.startsWith("Tag ")),
  }));

  return json({
    success: true,
    categories,
    tagMap: Object.fromEntries(Object.entries(tagMap).slice(0, 200)), // Subset for client
    totalTags: Object.keys(tagMap).length,
  });
}


// ═══════════════════════════════════════════════════════════
// ── SIMILAR EXPERIENCES (Phase 5) ──
// ═══════════════════════════════════════════════════════════

async function similarExperiences(body: any, targetCurrency: string) {
  const { productCode, destination, tagIds = [], limit = 6 } = body;

  // ── CACHE-FIRST: Try serving from DB cache by destination ──
  if (destination) {
    try {
      const sb = getSupabaseAdmin();
      let query = sb
        .from("tour_product_cache")
        .select("product_code, title, price, currency, rating, review_count, image_url, images, duration, category, short_description, destination, pricing_type, highlights")
        .ilike("destination", `%${destination}%`)
        .eq("is_active", true)
        .gt("price", 0)
        .neq("product_code", productCode || "")
        .order("rating", { ascending: false })
        .limit(limit + 3);

      const { data } = await query;
      if (data && data.length >= 3) {
        const exchangeData = await getExchangeRates();
        const products = data.slice(0, limit).map(p => {
          let price = p.price || 0;
          const pCurrency = p.currency || "USD";
          if (pCurrency !== targetCurrency && price > 0) {
            price = convertPrice(price, pCurrency, targetCurrency, exchangeData.rates, exchangeData.markup);
          }
          return {
            id: `viator-${p.product_code}`,
            productCode: p.product_code,
            name: p.title,
            destination: p.destination || destination,
            duration: p.duration || "",
            price, currency: targetCurrency,
            category: p.category || "Tour",
            rating: p.rating || 0,
            reviewCount: p.review_count || 0,
            image: p.image_url || (p.images && p.images[0]) || null,
            images: p.images || [],
            highlights: p.highlights || [],
            shortDescription: p.short_description || "",
            pricingType: p.pricing_type || "PER_PERSON",
            maxGroupSize: (p.pricing_type || "PER_PERSON") === "PER_GROUP" ? extractMaxGroupSize(p.age_bands) : null,
            source: "viator", _fromCache: true,
          };
        });
        console.log(`[similar] Served ${products.length} similar from DB for "${destination}"`);
        return json({ success: true, products });
      }
    } catch (e) { console.warn("[similar] DB cache error:", e); }
  }

}

// ═══════════════════════════════════════════════════════════
// ── AI SUGGESTIONS (Phase 5) ──
// ═══════════════════════════════════════════════════════════

async function aiSuggestions(body: any) {
  const { destination = "", month, budget, travelers = 2 } = body;
  
  // Season-aware suggestions based on month
  const monthNum = month ? new Date(`${month}-01`).getMonth() + 1 : new Date().getMonth() + 1;
  
  const SEASON_RECS: Record<string, { best: number[]; avoid: number[]; tip: string }> = {
    Bangkok: { best: [11, 12, 1, 2], avoid: [6, 7, 8, 9], tip: "Nov–Feb is cool and dry — perfect for temples and street food" },
    Bali: { best: [4, 5, 6, 7, 8, 9], avoid: [12, 1, 2], tip: "Apr–Sep is dry season — ideal for beaches and outdoor adventures" },
    Paris: { best: [4, 5, 6, 9, 10], avoid: [7, 8], tip: "Spring (Apr-Jun) and early fall (Sep-Oct) offer pleasant weather and fewer crowds" },
    Tokyo: { best: [3, 4, 10, 11], avoid: [6, 7, 8], tip: "Cherry blossom season (Mar-Apr) and fall foliage (Oct-Nov) are magical" },
    Dubai: { best: [11, 12, 1, 2, 3], avoid: [6, 7, 8], tip: "Nov–Mar offers pleasant temperatures for outdoor activities and desert safaris" },
    Istanbul: { best: [4, 5, 9, 10], avoid: [7, 8], tip: "Spring and fall provide perfect weather for walking tours and Bosphorus cruises" },
    Rome: { best: [4, 5, 9, 10], avoid: [7, 8], tip: "Shoulder seasons avoid peak crowds at the Colosseum and Vatican" },
    London: { best: [5, 6, 7, 8, 9], avoid: [11, 12, 1, 2], tip: "Summer brings long days perfect for parks, markets, and outdoor theater" },
    Singapore: { best: [2, 3, 4, 5, 6, 7, 8], avoid: [11, 12], tip: "Year-round warm, but Feb–Aug has less rainfall for Gardens by the Bay" },
    Maldives: { best: [12, 1, 2, 3, 4], avoid: [6, 7, 8], tip: "Dec–Apr is dry season — crystal clear waters for snorkeling" },
  };

  const cityKey = Object.keys(SEASON_RECS).find(k => destination.toLowerCase().includes(k.toLowerCase()));
  const seasonData = cityKey ? SEASON_RECS[cityKey] : null;
  
  let seasonTip = "";
  let isBestSeason = false;
  let isAvoidSeason = false;
  
  if (seasonData) {
    isBestSeason = seasonData.best.includes(monthNum);
    isAvoidSeason = seasonData.avoid.includes(monthNum);
    seasonTip = seasonData.tip;
  }

  // Budget suggestions
  const budgetTips: string[] = [];
  if (budget) {
    const perPerson = budget / travelers;
    if (perPerson < 50) budgetTips.push("Look for free walking tours and street food experiences");
    else if (perPerson < 150) budgetTips.push("Consider combo tickets for major attractions to save 20-30%");
    else budgetTips.push("Premium experiences like private tours and VIP access are worth exploring");
  }

  return json({
    success: true,
    suggestions: {
      seasonTip,
      isBestSeason,
      isAvoidSeason,
      budgetTips,
      recommendedCategories: isBestSeason
        ? ["outdoor", "adventure", "water-sports"]
        : isAvoidSeason
          ? ["museums", "indoor", "food-tours", "cooking-classes"]
          : ["culture", "sightseeing", "food"],
    },
  });
}

// ═══════════════════════════════════════════════════════════
// ── PRICE VERIFICATION (for booking) ──
// ═══════════════════════════════════════════════════════════


// (resolver moved to top of file)

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Provider API keys are used only by tour-inventory-sync cron, not by search
    const body = await req.json();
    const { action } = body;

    // Actions that don't require API key (cache/DB only)
    if (action === "cached-search") {
      const searchText = body.searchText || "";
      const targetCurrency = body.targetCurrency || "USD";
      const deepMode = body.deepSearch === true || /[,;|]/.test(searchText);
      const fallback = await getFallbackSearchFromCache(searchText, targetCurrency, deepMode);
      return json({ success: true, products: fallback || [], totalProducts: fallback?.length || 0, cached: true, deepSearch: deepMode });
    }

    // ai-enrichment action removed — match engine now calls freetext directly

    if (action === "resolve-slug") {
      const slug = body.slug || "";
      const velaId = body.velaId || "";
      if (!slug && !velaId) return json({ success: false, error: "Missing slug or velaId" }, 400);
      const sb = getSupabaseAdmin();

      // 0) Exact match by vela_id (fastest, deterministic)
      if (velaId) {
        const { data: byVela } = await sb
          .from("tour_product_cache")
          .select("product_code, slug, destination, vela_id")
          .eq("vela_id", velaId)
          .maybeSingle();
        if (byVela) return json({ success: true, productCode: byVela.product_code, slug: byVela.slug, destination: byVela.destination, velaId: byVela.vela_id });
      }

      // 1) Exact slug match in cache
      const { data } = await sb
        .from("tour_product_cache")
        .select("product_code, slug, destination, vela_id")
        .eq("slug", slug)
        .maybeSingle();
      if (data) return json({ success: true, productCode: data.product_code, slug: data.slug, destination: data.destination, velaId: data.vela_id });

      // 2) Legacy slug support — old slugs end with product code like "...-63071p1"
      const codeMatch = slug.match(/(\d{3,10}p\d+)$/i);
      if (codeMatch) {
        const extractedCode = codeMatch[1].toUpperCase();
        // Strip the product code suffix to get the clean slug
        const cleanSlug = slug.replace(/-?\d{3,10}p\d+$/i, '').replace(/-$/, '');

        // Check if product exists in cache by product_code
        const { data: byCode } = await sb
          .from("tour_product_cache")
          .select("product_code, slug, destination")
          .eq("product_code", extractedCode)
          .maybeSingle();
        
        if (byCode) {
          // Update the slug to the clean version if it's still the old format
          if (!byCode.slug || byCode.slug.match(/\d{3,10}p\d+$/i)) {
            const newSlug = cleanSlug || generateTourSlug(byCode.destination || '', byCode.destination || '');
            await sb.from("tour_product_cache")
              .update({ slug: newSlug })
              .eq("product_code", extractedCode);
            return json({ success: true, productCode: byCode.product_code, slug: newSlug, destination: byCode.destination });
          }
          return json({ success: true, productCode: byCode.product_code, slug: byCode.slug, destination: byCode.destination });
        }

        // Last resort — return the extracted code for client-side fetch
        return json({ success: true, productCode: extractedCode, slug: cleanSlug || slug, destination: null, _extracted: true });
      }

      // 3) Fuzzy match — extract key terms from slug and search
      const slugWords = slug.split("-").filter((w: string) => w.length > 2 && !["the","and","with","for","from","tour","experience","optional","one","way","transfer","day","full","half","trip","package"].includes(w));
      const keyTerms = slugWords.slice(0, 4).join("%");
      if (keyTerms.length > 5) {
        const { data: fuzzy } = await sb
          .from("tour_product_cache")
          .select("product_code, slug, destination, title")
          .or(`slug.ilike.%${keyTerms}%,title.ilike.%${slugWords.slice(0, 3).join("% %")}%`)
          .limit(3);
        if (fuzzy?.length) {
          // Pick best match
          const best = fuzzy[0];
          return json({ success: true, productCode: best.product_code, slug: best.slug, destination: best.destination, _fuzzyMatch: true });
        }
      }

      // 4) Last-resort tail match
      const { data: tailFuzzy } = await sb
        .from("tour_product_cache")
        .select("product_code, slug, destination")
        .ilike("slug", `%${slug.slice(-30)}%`)
        .limit(1)
        .maybeSingle();
      if (tailFuzzy) return json({ success: true, productCode: tailFuzzy.product_code, slug: tailFuzzy.slug, destination: tailFuzzy.destination });

      return json({ success: false, error: "Tour not found" }, 404);
    }

    if (action === "suggestions") {
      return await aiSuggestions(body);
    }

    // All actions are cache-only — no API key required for normal operation

    const targetCurrency = body.targetCurrency || body.currency || "USD";

    console.log(`[unified-tour-search] action=${action} target=${targetCurrency}`);

    switch (action) {
      case "search":
        return await tourSearch(body, targetCurrency);
      case "freetext":
        return await tourFreetext(body, targetCurrency);
      case "multi-freetext":
        return await tourMultiFreetext(body, targetCurrency);
      case "product":
        return await tourProduct(body, targetCurrency);
      case "reviews":
        return await tourReviews(body);

      case "destinations":
        return await tourDestinations();
      case "trending-destinations":
        return await trendingDestinations(body);
      case "tags":
        return await tourTags();
      case "similar":
        return await similarExperiences(body, targetCurrency);
      case "verify-price":
        return json({ success: true, verified: false, priceChanged: false, currentTotal: body.expectedTotal || 0, message: "Price verification uses cached data only" });
      case "notify-request-to-book": {
        const { bookingId, productCode: pc, reason, travelDate: td, totalPrice: tp } = body;
        console.log(`[ADMIN-NOTIFY] Request to Book received: booking=${bookingId} product=${pc} date=${td} total=${tp} reason=${reason}`);
        // Store notification in DB for admin dashboard
        try {
          const sb = getSupabaseAdmin();
          await sb.from("bookings").update({
            confirmation_data: {
              request_reason: reason,
              needs_admin_action: true,
              notified_at: new Date().toISOString(),
            },
          }).eq("booking_id", bookingId);
        } catch (e) { console.warn("[notify] DB update error:", e); }
        return json({ success: true, notified: true });
      }

      default:
        return json({ success: false, error: `Unknown action: ${action}` }, 400);
    }
  } catch (err: any) {
    console.error("[unified-tour-search] Error:", err);
    return json({ success: false, error: err.message }, 500);
  }
});
