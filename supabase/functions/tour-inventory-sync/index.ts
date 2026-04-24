import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Extract price AND its native currency from a Viator product.
 * Priority: 1) Schedule pricing (has correct currency), 2) Main pricing, 3) AgeBands
 * Returns { price, currency } where currency is the actual currency of the price.
 */
function extractPriceWithCurrency(raw: any, fallbackCurrency = "USD"): { price: number; currency: string } {
  let price = 0;
  let currency = fallbackCurrency;

  // 1. Schedule pricing (most reliable — has per-option currency)
  if (raw._schedulePricing?.optionPricing) {
    const opts = Object.values(raw._schedulePricing.optionPricing) as Array<{ fromPrice: number; currency: string }>;
    let lowestOpt = { price: 0, currency: fallbackCurrency };
    for (const o of opts) {
      if (o.fromPrice > 0 && (lowestOpt.price === 0 || o.fromPrice < lowestOpt.price)) {
        lowestOpt = { price: o.fromPrice, currency: o.currency || fallbackCurrency };
      }
    }
    if (lowestOpt.price > 0) {
      price = lowestOpt.price;
      currency = lowestOpt.currency;
    }
  }

  // 2. Main pricing summary
  if (price === 0) {
    const pricing = raw.pricing || {};
    price = pricing.summary?.fromPrice || pricing.fromPrice || 0;
    if (price > 0) {
      currency = pricing.currency || pricing.summary?.currencyCode || fallbackCurrency;
    }
  }

  // 3. AgeBands fallback
  if (price === 0 && raw.pricingInfo?.ageBands?.length) {
    for (const band of raw.pricingInfo.ageBands) {
      const bp = band.prices?.fromPrice ?? band.retailPrice ?? band.price ?? 0;
      if (bp > 0 && (price === 0 || bp < price)) price = bp;
    }
    if (price > 0) {
      currency = raw.pricingInfo?.currency || fallbackCurrency;
    }
  }

  return { price, currency };
}

/**
 * Tour Inventory Background Sync v2
 * 
 * Strategies:
 * 1. modified-since  — Daily delta sync via Viator /products/modified-since
 * 2. destination-refresh — Rolling refresh of top-searched cities
 * 3. sync-batch — Original full crawl for initial population
 * 

/**
 * Extract rich highlights from product inclusions (not just tag names).
 * Falls back to tag names if no inclusions are available.
 */
function extractRichHighlights(raw: any): string[] {
  const BLOCKED = /viator|tripadvisor|getyourguide|klook|tiqets|musement|civitatis|headout/i;
  // 1. Inclusions — most useful for display
  const inclHighlights = (raw.inclusions || [])
    .map((inc: any) => inc.otherDescription || inc.typeDescription || "")
    .filter((h: string) => h && h.length > 3 && h.length < 100 && !BLOCKED.test(h))
    .slice(0, 8);
  if (inclHighlights.length >= 2) return inclHighlights;

  // 2. Tag names as fallback
  const tagHighlights = (raw.tags || [])
    .map((t: any) => t?.allNamesByLocale?.en || t?.tagName || "")
    .filter((h: string) => h && h.length > 2 && !BLOCKED.test(h))
    .slice(0, 5);
  return inclHighlights.length > 0 ? inclHighlights : tagHighlights;
}

/**
 * Extract places_covered from itinerary items, logistics, and product metadata.
 */
function extractPlacesCoveredFromProduct(raw: any): string[] {
  const BLOCKED = /viator|tripadvisor|getyourguide|tour start|tour end|hotel pickup|hotel drop|pickup point/i;
  const places = new Set<string>();

  // 1. Itinerary item descriptions (often have POI names)
  const items = raw.itinerary?.itineraryItems || [];
  for (const item of items) {
    // POI location name
    const poiName = item.pointOfInterestLocation?.location?.name;
    if (poiName && poiName.length > 2 && poiName.length < 60 && !BLOCKED.test(poiName)) {
      places.add(poiName);
    }
    // Also try the item title
    const itemTitle = item.title || item.name;
    if (itemTitle && itemTitle.length > 2 && itemTitle.length < 60 && !BLOCKED.test(itemTitle)) {
      places.add(itemTitle);
    }
  }

  // 2. Attraction references from product flags
  if (raw.attractionsList) {
    for (const attr of raw.attractionsList) {
      const name = attr.attractionName || attr.name;
      if (name && name.length > 2 && name.length < 60 && !BLOCKED.test(name)) {
        places.add(name);
      }
    }
  }

  return [...places].slice(0, 10);
}


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const VIATOR_BASE = "https://api.viator.com/partner";
const BATCH_DETAIL_LIMIT = 35;           // ~35 products fits within 120s (smart schedule skip saves calls)
const DELAY_BETWEEN_DETAILS_MS = 500;    // 500ms + jitter (0.4-0.6s) — fast but still serial
const DELAY_BETWEEN_SEARCH_MS = 500;
const SEARCH_PAGE_SIZE = 50;
const PRODUCT_CACHE_TTL_DAYS = 30;
const MODIFIED_SINCE_PAGE_SIZE = 500;
const MODIFIED_SINCE_MAX_PAGES = 20; // Safety: max 10k products per run

// Refresh tier thresholds (based on search_hit_count in last 30 days)
const TIER_THRESHOLDS = {
  daily: 50,    // 50+ searches/month → refresh daily
  weekly: 10,   // 10-49 searches/month → refresh weekly  
  monthly: 0,   // <10 searches/month → refresh monthly
};

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function viatorHeaders(apiKey: string) {
  return {
    "exp-api-key": apiKey,
    "Accept-Language": "en-US",
    Accept: "application/json;version=2.0",
    "Content-Type": "application/json",
  };
}

function sleep(ms: number) {
  const jitter = ms * (0.8 + Math.random() * 0.4);
  return new Promise(r => setTimeout(r, jitter));
}

// ── Destination ID → Name Resolver ──
// Builds a lookup map from viator_destination_map (full taxonomy) + tour_sync_state
// so we can resolve product.destinations[].ref to a human-readable city/region name.
let destIdToNameCache: Record<string, string> | null = null;
let destIdToCountryCache: Record<string, string> | null = null;
let destCacheExpiry = 0;

async function getDestIdToNameMap(): Promise<Record<string, string>> {
  const now = Date.now();
  if (destIdToNameCache && now < destCacheExpiry) return destIdToNameCache;

  const map: Record<string, string> = {};
  const countryMap: Record<string, string> = {};

  // Seed from hardcoded SYNC_DESTINATIONS
  for (const d of SYNC_DESTINATIONS) map[d.id] = d.name;

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

/**
 * Resolve a product's destination name from its destinations array.
 * Falls back to raw.destination?.name, then raw.location?.address?.city.
 */
function resolveProductDestination(
  raw: any,
  destMap: Record<string, string>,
  syncDestName = ""
): string {
  // 1. Try product's destinations array (most reliable — uses Viator taxonomy IDs)
  const dests = raw.destinations || [];
  const unmappedRefs: string[] = [];

  if (Array.isArray(dests) && dests.length > 0) {
    // Prefer primary destination
    const primary = dests.find((d: any) => d.primary) || dests[0];
    const ref = String(primary?.ref || "");
    if (ref && destMap[ref]) {
      return destMap[ref];
    }
    if (ref && !destMap[ref]) unmappedRefs.push(ref);
    // If primary ref not in map, check all refs
    for (const d of dests) {
      const r = String(d?.ref || "");
      if (r && destMap[r]) return destMap[r];
      if (r && !destMap[r] && !unmappedRefs.includes(r)) unmappedRefs.push(r);
    }
  }

  // 2. Resolve city from product's own data
  const cityFromLocation = raw.location?.address?.city || raw.destination?.name || "";
  const cityFromLogistics = raw.logistics?.start?.[0]?.location?.address?.city || "";
  const resolvedCity = cityFromLocation || cityFromLogistics || "";

  // AUTO-LEARN: If we found unmapped dest refs AND resolved a city, persist the mapping
  if (unmappedRefs.length > 0 && resolvedCity) {
    const countryFromLocation = raw.location?.address?.country || "";
    for (const ref of unmappedRefs) {
      if (!destMap[ref]) {
        // Update in-memory cache immediately
        destMap[ref] = resolvedCity;
        // Fire-and-forget persist
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
        } catch (e) {
          console.warn(`[dest-learn] Failed for ${ref}:`, e);
        }
      }
    }
    return resolvedCity;
  }

  if (resolvedCity) return resolvedCity;

  // 5. Use sync destination name ONLY if it's plausible
  if (syncDestName) {
    const titleLower = (raw.title || "").toLowerCase();
    const descLower = (raw.shortDescription || raw.description || "").toLowerCase();
    const syncLower = syncDestName.toLowerCase();
    if (titleLower.includes(syncLower) || descLower.includes(syncLower)) {
      return syncDestName;
    }
    const titleWords = (raw.title || "").split(/[\s,()]+/).filter(Boolean);
    for (const word of titleWords) {
      if (word.length >= 3 && /^[A-Z]/.test(word)) {
        const wordLower = word.toLowerCase();
        for (const [, name] of Object.entries(destMap)) {
          if (name.toLowerCase() === wordLower) return name;
        }
      }
    }
    return syncDestName;
  }

  return "";
}

/**
 * Auto-learn new destination IDs from product data.
 * IMPORTANT: Only save the PRIMARY destination ref to avoid cross-contamination.
 * Products have multiple destination refs (city, region, country, sub-area) —
 * blindly saving ALL of them maps unrelated IDs (e.g., "New York" region ID)
 * to the wrong city name (e.g., "Phuket"), corrupting the destination map.
 */
async function autoLearnDestIds(raw: any, resolvedCity: string) {
  if (!resolvedCity) return;
  const sb = getSupabaseAdmin();
  const dests = raw.destinations || [];
  if (!dests.length) return;

  // ONLY use the primary destination ref — never secondary/parent refs
  const primary = dests.find((d: any) => d.primary);
  if (!primary) return; // No primary destination → don't guess

  const ref = String(primary.ref || "");
  if (!ref || !ref.match(/^\d+$/)) return;

  // Check if already in map
  const map = destIdToNameCache || {};
  if (map[ref]) return;

  // Also check if this city_name already has a different dest_id in the map
  // If so, DON'T override — the existing mapping is authoritative
  const existingEntry = Object.entries(map).find(([, name]) => name.toLowerCase() === resolvedCity.toLowerCase());
  if (existingEntry) {
    // City already mapped to a different ID — just add to cache, don't persist
    if (destIdToNameCache) destIdToNameCache[ref] = resolvedCity;
    return;
  }

  try {
    await sb.from("viator_destination_map").upsert({
      dest_id: ref,
      city_name: resolvedCity,
    }, { onConflict: "dest_id", ignoreDuplicates: true });
    if (destIdToNameCache) destIdToNameCache[ref] = resolvedCity;
    console.log(`[auto-learn] New PRIMARY dest mapping: ${ref} → ${resolvedCity}`);
  } catch (e) {
    // Ignore - best effort
  }
}


const SYNC_DESTINATIONS = [
  // === ASIA — Tier 1 (IDs from Viator taxonomy) ===
  { id: "343", name: "Bangkok" },
  { id: "349", name: "Phuket" },
  { id: "98", name: "Bali" },
  { id: "60449", name: "Singapore" },
  { id: "334", name: "Tokyo" },
  { id: "335", name: "Kuala Lumpur" },
  { id: "828", name: "Dubai" },
  { id: "5267", name: "Chiang Mai" },
  { id: "352", name: "Ho Chi Minh City" },
  { id: "351", name: "Hanoi" },
  { id: "973", name: "Seoul" },
  { id: "4672", name: "Maldives" },
  // === ASIA — Tier 2 ===
  { id: "804", name: "Delhi" },
  { id: "4627", name: "Jaipur" },
  { id: "4924", name: "Kolkata" },
  { id: "953", name: "Mumbai" },
  { id: "348", name: "Krabi" },
  { id: "344", name: "Pattaya" },
  { id: "338", name: "Langkawi" },
  { id: "333", name: "Osaka" },
  { id: "332", name: "Kyoto" },
  { id: "50208", name: "Sentosa Island" },
  { id: "5262", name: "Taipei" },
  { id: "5480", name: "Siem Reap" },
  { id: "50286", name: "Jeju Island" },
  { id: "585", name: "Istanbul" },
  // === ASIA — Tier 3 ===
  { id: "5425", name: "Phnom Penh" },
  { id: "321", name: "Beijing" },
  { id: "325", name: "Shanghai" },
  { id: "5106", name: "Udaipur" },
  { id: "22015", name: "Varanasi" },
  { id: "339", name: "Penang" },
  { id: "5558", name: "Hokkaido" },
  { id: "4680", name: "Da Nang" },
  // === MIDDLE EAST ===
  { id: "4474", name: "Abu Dhabi" },
  { id: "4453", name: "Doha" },
  { id: "4389", name: "Muscat" },
  { id: "24520", name: "Petra" },
  // === EUROPE — Tier 1 ===
  { id: "479", name: "Paris" },
  { id: "737", name: "London" },
  { id: "511", name: "Rome" },
  { id: "562", name: "Barcelona" },
  { id: "525", name: "Amsterdam" },
  { id: "496", name: "Athens" },
  { id: "538", name: "Lisbon" },
  { id: "462", name: "Prague" },
  { id: "905", name: "Reykjavik" },
  { id: "503", name: "Dublin" },
  // === EUROPE — Tier 2 ===
  { id: "522", name: "Venice" },
  { id: "519", name: "Florence" },
  { id: "478", name: "Nice" },
  { id: "577", name: "Zurich" },
  { id: "454", name: "Vienna" },
  { id: "499", name: "Budapest" },
  { id: "739", name: "Edinburgh" },
  { id: "959", name: "Santorini" },
  // === AMERICAS ===
  { id: "687", name: "New York City" },
  { id: "631", name: "Cancún" },
  { id: "5408", name: "Marrakech" },
  { id: "684", name: "Las Vegas" },
  { id: "645", name: "Los Angeles" },
  { id: "5501", name: "Playa del Carmen" },
  { id: "662", name: "Miami" },
  // === OCEANIA ===
  { id: "357", name: "Sydney" },
  { id: "384", name: "Melbourne" },
];

// ══════════════════════════════════════════════════════
// ── MODIFIED-SINCE: Delta sync of changed products ──
// ══════════════════════════════════════════════════════

async function modifiedSinceSync(apiKey: string) {
  const sb = getSupabaseAdmin();
  
  // Get the last modified-since timestamp from any destination
  const { data: lastSync } = await sb
    .from("tour_sync_state")
    .select("last_modified_since_at")
    .not("last_modified_since_at", "is", null)
    .order("last_modified_since_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Build the URL — if no previous sync, fetch last 48 hours
  const modifiedSince = lastSync?.last_modified_since_at 
    || new Date(Date.now() - 48 * 3600_000).toISOString();
  
  let url = `${VIATOR_BASE}/products/modified-since?count=${MODIFIED_SINCE_PAGE_SIZE}&modified-since=${encodeURIComponent(modifiedSince)}`;
  
  let totalUpdated = 0;
  let totalDeactivated = 0;
  let pagesProcessed = 0;
  const now = new Date().toISOString();
  const destMap = await getDestIdToNameMap();

  console.log(`[modified-since] Starting delta sync from ${modifiedSince}`);

  while (url && pagesProcessed < MODIFIED_SINCE_MAX_PAGES) {
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: viatorHeaders(apiKey),
      });

      if (!res.ok) {
        if (res.status === 429) {
          console.warn("[modified-since] Rate limited, stopping");
          break;
        }
        const errText = await res.text();
        console.error(`[modified-since] Error ${res.status}:`, errText.slice(0, 200));
        break;
      }

      const data = await res.json();
      const products = data.products || [];
      pagesProcessed++;

      console.log(`[modified-since] Page ${pagesProcessed}: ${products.length} products`);

      // Process each modified product
      for (const raw of products) {
        const productCode = raw.productCode;
        if (!productCode) continue;

        // Check if product is deactivated/deleted
        if (raw.status === "INACTIVE" || raw.bookingConfirmationSettings?.bookingStatus === "CLOSED") {
          await sb.from("tour_product_cache")
            .update({ is_active: false, updated_at: now })
            .eq("product_code", productCode)
            .eq("provider", "viator");
          totalDeactivated++;
          continue;
        }

        // Extract price with correct native currency
        const extracted = extractPriceWithCurrency(raw, "USD");
        const price = extracted.price;
        const priceCurrency = extracted.currency;

        const reviews = raw.reviews || {};
        const images = (raw.images || []).map((img: any) => {
          const variants = img.variants || [];
          const best = variants.reduce((a: any, b: any) => ((b.width || 0) > (a.width || 0) ? b : a), variants[0] || {});
          return best.url || "";
        }).filter(Boolean);

        let duration = "";
        const dur = raw.duration || {};
        if (dur.fixedDurationInMinutes) {
          const h = Math.floor(dur.fixedDurationInMinutes / 60);
          const m = dur.fixedDurationInMinutes % 60;
          duration = h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ""}` : `${m}m`;
        } else if (dur.variableDurationFromMinutes) {
          const fromH = Math.floor(dur.variableDurationFromMinutes / 60);
          const toH = Math.ceil((dur.variableDurationToMinutes || dur.variableDurationFromMinutes) / 60);
          duration = fromH === toH ? `${fromH}h` : `${fromH}-${toH}h`;
        }

        const rawPricingType = (raw.pricingInfo?.type || (raw.pricing || {}).type || "").toUpperCase();
        const pricingType = rawPricingType === "PER_GROUP" || rawPricingType === "UNIT" ? "PER_GROUP" : "PER_PERSON";
        const destination = resolveProductDestination(raw, destMap);
        await autoLearnDestIds(raw, destination);
        const highlights = extractRichHighlights(raw);
        const placesCovered = extractPlacesCoveredFromProduct(raw);

        await sb.from("tour_product_cache").upsert({
          product_code: productCode,
          provider: "viator",
          destination,
          title: raw.title || "",
          short_description: raw.shortDescription || "",
          price,
          currency: priceCurrency,
          pricing_type: pricingType,
          rating: reviews.combinedAverageRating || 0,
          review_count: reviews.totalReviews || 0,
          duration,
          image_url: images[0] || "",
          category: "",
          highlights,
          places_covered: placesCovered.length > 0 ? placesCovered : undefined,
          age_bands: raw.pricingInfo?.ageBands || [],
          product_data: raw,
          images,
          tags: highlights,
          sync_source: "modified-since",
          detail_fetched: true,
          is_active: price > 0, // Only active if we have a real price
          last_verified_at: now,
          cached_at: now,
          modified_since_cursor: data.nextCursor || "",
        }, { onConflict: "product_code,provider" });

        totalUpdated++;
      }

      // Follow cursor pagination
      if (data.nextCursor) {
        url = `${VIATOR_BASE}/products/modified-since?count=${MODIFIED_SINCE_PAGE_SIZE}&cursor=${encodeURIComponent(data.nextCursor)}`;
        await sleep(1000);
      } else {
        url = "";
      }
    } catch (e: any) {
      console.error("[modified-since] Exception:", e);
      break;
    }
  }

  // Update last_modified_since_at on all destinations
  await sb.from("tour_sync_state")
    .update({ last_modified_since_at: now })
    .not("destination_id", "is", null);

  console.log(`[modified-since] Done: ${totalUpdated} updated, ${totalDeactivated} deactivated, ${pagesProcessed} pages`);

  return json({
    success: true,
    action: "modified-since",
    totalUpdated,
    totalDeactivated,
    pagesProcessed,
    modifiedSince,
  });
}

// ══════════════════════════════════════════════════════
// ── DESTINATION REFRESH: Rolling re-sync of popular cities ──
// ══════════════════════════════════════════════════════

async function destinationRefresh(apiKey: string) {
  const sb = getSupabaseAdmin();
  const now = new Date();

  // 1. Recalculate refresh tiers based on search_hit_count
  const { data: allDests } = await sb
    .from("tour_sync_state")
    .select("destination_id, search_hit_count, refresh_tier, last_modified_since_at, completed_at")
    .order("search_hit_count", { ascending: false });

  if (!allDests?.length) return json({ success: true, message: "No destinations to refresh" });

  // Update tiers
  for (const dest of allDests) {
    const hits = dest.search_hit_count || 0;
    let newTier = "monthly";
    if (hits >= TIER_THRESHOLDS.daily) newTier = "daily";
    else if (hits >= TIER_THRESHOLDS.weekly) newTier = "weekly";

    if (newTier !== dest.refresh_tier) {
      await sb.from("tour_sync_state")
        .update({ refresh_tier: newTier })
        .eq("destination_id", dest.destination_id);
    }
  }

  // 2. Find destinations that need refresh based on tier
  const staleThresholds: Record<string, number> = {
    daily: 24 * 3600_000,      // 1 day
    weekly: 7 * 24 * 3600_000, // 7 days
    monthly: 30 * 24 * 3600_000, // 30 days
  };

  const needsRefresh: string[] = [];

  for (const dest of allDests) {
    const tier = dest.refresh_tier || "monthly";
    const lastRefresh = dest.completed_at || dest.last_modified_since_at;
    if (!lastRefresh) {
      needsRefresh.push(dest.destination_id);
      continue;
    }

    const age = now.getTime() - new Date(lastRefresh).getTime();
    if (age > (staleThresholds[tier] || staleThresholds.monthly)) {
      needsRefresh.push(dest.destination_id);
    }
  }

  if (needsRefresh.length === 0) {
    return json({ success: true, message: "All destinations are fresh", refreshed: 0 });
  }

  // 3. Reset top 5 stale destinations to pending for re-sync
  const toRefresh = needsRefresh.slice(0, 5);
  console.log(`[dest-refresh] Queueing ${toRefresh.length} destinations for refresh: ${toRefresh.join(", ")}`);

  for (const destId of toRefresh) {
    await sb.from("tour_sync_state").update({
      status: "pending",
      priority: 50, // Medium priority (below user-search=100, above initial=1-68)
      search_cursor: 1,
      search_complete: false,
      product_codes_pending: [],
      updated_at: now.toISOString(),
    }).eq("destination_id", destId);
  }

  return json({
    success: true,
    action: "destination-refresh",
    totalStale: needsRefresh.length,
    queued: toRefresh.length,
    queuedIds: toRefresh,
  });
}

// ══════════════════════════════════════════════════════
// ── RECORD SEARCH HIT: Track destination popularity ──
// ══════════════════════════════════════════════════════

async function recordSearchHit(body: any) {
  const { destinationId, destinationName } = body;
  if (!destinationId) return json({ success: false, error: "destinationId required" }, 400);

  const sb = getSupabaseAdmin();
  const now = new Date().toISOString();

  // Upsert: increment search_hit_count, update last_search_hit_at
  const { data: existing } = await sb
    .from("tour_sync_state")
    .select("search_hit_count")
    .eq("destination_id", String(destinationId))
    .maybeSingle();

  if (existing) {
    await sb.from("tour_sync_state").update({
      search_hit_count: (existing.search_hit_count || 0) + 1,
      last_search_hit_at: now,
    }).eq("destination_id", String(destinationId));
  } else if (/^\d+$/.test(String(destinationId))) {
    await sb.from("tour_sync_state").upsert({
      destination_id: String(destinationId),
      destination_name: destinationName || "",
      search_hit_count: 1,
      last_search_hit_at: now,
      status: "pending",
      priority: 100,
    }, { onConflict: "destination_id" });
  } else {
    console.log(`[sync] Skipping non-numeric destination_id "${destinationId}" in recordSearchHit`);
  }

  return json({ success: true });
}

// ══════════════════════════════════════════════════════
// ── SYNC INIT ──
// ══════════════════════════════════════════════════════

async function syncInit() {
  const sb = getSupabaseAdmin();
  let inserted = 0;

  for (let i = 0; i < SYNC_DESTINATIONS.length; i++) {
    const dest = SYNC_DESTINATIONS[i];
    const priority = SYNC_DESTINATIONS.length - i;
    const { error } = await sb.from("tour_sync_state").upsert({
      destination_id: dest.id,
      destination_name: dest.name,
      priority,
      updated_at: new Date().toISOString(),
    }, { onConflict: "destination_id" });

    if (!error) inserted++;
  }

  return json({ success: true, destinations: SYNC_DESTINATIONS.length, inserted });
}

// ══════════════════════════════════════════════════════
// ── SYNC STATUS ──
// ══════════════════════════════════════════════════════

async function syncStatus() {
  const sb = getSupabaseAdmin();
  const { data: states } = await sb
    .from("tour_sync_state")
    .select("*")
    .order("priority", { ascending: false });

  const { count: totalProducts } = await sb
    .from("tour_product_cache")
    .select("*", { count: "exact", head: true })
    .eq("detail_fetched", true);

  const { count: totalCached } = await sb
    .from("tour_product_cache")
    .select("*", { count: "exact", head: true });

  const summary = {
    total_destinations: states?.length || 0,
    completed: states?.filter(s => s.status === "completed").length || 0,
    syncing: states?.filter(s => s.status === "syncing").length || 0,
    pending: states?.filter(s => s.status === "pending").length || 0,
    paused: states?.filter(s => s.status === "paused").length || 0,
    total_detailed_products: totalProducts || 0,
    total_cached_products: totalCached || 0,
    tier_breakdown: {
      daily: states?.filter(s => s.refresh_tier === "daily").length || 0,
      weekly: states?.filter(s => s.refresh_tier === "weekly").length || 0,
      monthly: states?.filter(s => s.refresh_tier === "monthly").length || 0,
    },
  };

  return json({ success: true, summary, destinations: states || [] });
}

// ══════════════════════════════════════════════════════
// ── SYNC PRIORITIZE ──
// ══════════════════════════════════════════════════════

async function syncPrioritize(body: any) {
  const { destinationId, destinationName, resetSearch } = body;
  if (!destinationId) return json({ success: false, error: "destinationId required" }, 400);
  // Only accept numeric Viator destination IDs — text names cause BAD_REQUEST errors
  if (!/^\d+$/.test(String(destinationId))) {
    return json({ success: false, error: `Invalid destination ID "${destinationId}" — must be a numeric Viator ID` }, 400);
  }

  const sb = getSupabaseAdmin();
  const upsertData: any = {
    destination_id: destinationId,
    destination_name: destinationName || "",
    status: "pending",
    priority: 100,
    updated_at: new Date().toISOString(),
  };

  // Full reset — re-discover products from scratch
  if (resetSearch) {
    upsertData.search_cursor = 1;
    upsertData.search_complete = false;
    upsertData.total_products_found = 0;
    upsertData.product_codes_pending = [];
    upsertData.product_codes_done = [];
    upsertData.products_detailed = 0;
    upsertData.error_count = 0;
  }

  await sb.from("tour_sync_state").upsert(upsertData, { onConflict: "destination_id" });

  return json({ success: true, message: `Destination ${destinationId} prioritized${resetSearch ? " (search reset)" : ""}` });
}

// ══════════════════════════════════════════════════════
// ── SEARCH-BASED DISCOVERY: Fallback when taxonomy unavailable ──
// ══════════════════════════════════════════════════════

// Extended destination list — covers all major Viator cities beyond initial 68
const EXTENDED_DESTINATIONS = [
  // Americas - Major
  { id: "662", name: "Miami" }, { id: "955", name: "San Francisco" },
  { id: "957", name: "Chicago" }, { id: "958", name: "Washington DC" },
  { id: "956", name: "Boston" }, { id: "952", name: "Honolulu" },
  { id: "961", name: "San Diego" }, { id: "959", name: "Orlando" },
  { id: "954", name: "New Orleans" }, { id: "963", name: "Nashville" },
  { id: "794", name: "Punta Cana" }, { id: "786", name: "Bogota" },
  { id: "788", name: "Cartagena" }, { id: "775", name: "Lima" },
  { id: "773", name: "Cusco" }, { id: "790", name: "Medellín" },
  { id: "783", name: "Rio de Janeiro" }, { id: "784", name: "São Paulo" },
  { id: "766", name: "Buenos Aires" }, { id: "770", name: "Santiago" },
  { id: "917", name: "Costa Rica" }, { id: "913", name: "Tulum" },
  { id: "780", name: "Quito" },
  // Europe - Extended
  { id: "745", name: "Dubrovnik" }, { id: "746", name: "Split" },
  { id: "747", name: "Berlin" }, { id: "749", name: "Munich" },
  { id: "750", name: "Madrid" }, { id: "751", name: "Seville" },
  { id: "752", name: "Granada" }, { id: "753", name: "Milan" },
  { id: "754", name: "Naples" }, { id: "755", name: "Amalfi Coast" },
  { id: "756", name: "Cinque Terre" }, { id: "757", name: "Porto" },
  { id: "758", name: "Brussels" }, { id: "759", name: "Copenhagen" },
  { id: "760", name: "Stockholm" }, { id: "761", name: "Helsinki" },
  { id: "762", name: "Oslo" }, { id: "763", name: "Warsaw" },
  { id: "764", name: "Krakow" }, { id: "549", name: "Mykonos" },
  { id: "550", name: "Crete" }, { id: "955", name: "Salzburg" },
  { id: "743", name: "Swiss Alps" },
  // Africa
  { id: "521", name: "Cape Town" }, { id: "522", name: "Johannesburg" },
  { id: "523", name: "Nairobi" }, { id: "524", name: "Zanzibar" },
  { id: "525", name: "Victoria Falls" }, { id: "526", name: "Casablanca" },
  { id: "527", name: "Fez" }, { id: "528", name: "Cairo" },
  { id: "529", name: "Luxor" }, { id: "530", name: "Accra" },
  { id: "531", name: "Dakar" }, { id: "532", name: "Kilimanjaro" },
  // Asia Pacific - Extended
  { id: "657", name: "Hoi An" }, { id: "658", name: "Nha Trang" },
  { id: "670", name: "Vientiane" }, { id: "675", name: "Kota Kinabalu" },
  { id: "676", name: "Malacca" }, { id: "846", name: "Hiroshima" },
  { id: "850", name: "Busan" }, { id: "853", name: "Kaohsiung" },
  { id: "856", name: "Manila" }, { id: "857", name: "Cebu" },
  { id: "858", name: "Boracay" }, { id: "859", name: "Colombo" },
  { id: "860", name: "Kathmandu" }, { id: "861", name: "Pokhara" },
  { id: "862", name: "Yangon" }, { id: "863", name: "Bagan" },
  { id: "692", name: "Koh Samui" }, { id: "693", name: "Chiang Rai" },
  // Oceania - Extended
  { id: "362", name: "Gold Coast" }, { id: "364", name: "Brisbane" },
  { id: "365", name: "Perth" }, { id: "366", name: "Cairns" },
  { id: "367", name: "Adelaide" }, { id: "371", name: "Auckland" },
  { id: "372", name: "Queenstown" }, { id: "373", name: "Rotorua" },
  { id: "374", name: "Christchurch" }, { id: "375", name: "Fiji" },
  // Caribbean
  { id: "795", name: "Jamaica" }, { id: "796", name: "Bahamas" },
  { id: "797", name: "Aruba" }, { id: "798", name: "Barbados" },
  { id: "799", name: "St. Lucia" }, { id: "800", name: "Curaçao" },
  { id: "801", name: "Trinidad" }, { id: "802", name: "Bermuda" },
  // Middle East Extended
  { id: "321", name: "Amman" }, { id: "322", name: "Oman" },
  { id: "323", name: "Riyadh" }, { id: "324", name: "Bahrain" },
  { id: "547", name: "Antalya" }, { id: "548", name: "Cappadocia" },
  { id: "549", name: "Bodrum" },
];

async function searchBasedDiscovery(apiKey: string): Promise<number> {
  const sb = getSupabaseAdmin();

  // Get existing destination IDs
  const { data: existing } = await sb
    .from("tour_sync_state")
    .select("destination_id");
  const existingIds = new Set((existing || []).map(d => String(d.destination_id)));

  const newDests = EXTENDED_DESTINATIONS.filter(d => !existingIds.has(d.id));

  if (newDests.length === 0) {
    // Extended list exhausted — fall back to own DB sources (OSM, city_intros, etc.)
    console.log("[search-discover] Extended list exhausted, trying own DB discovery...");
    return await discoverFromOwnData(sb);
  }

  let queued = 0;
  for (let i = 0; i < newDests.length; i++) {
    const dest = newDests[i];
    const priority = Math.max(1, 25 - Math.floor(i / 5));
    const { error } = await sb.from("tour_sync_state").upsert({
      destination_id: dest.id,
      destination_name: dest.name,
      status: "pending",
      priority,
      updated_at: new Date().toISOString(),
    }, { onConflict: "destination_id" });
    if (!error) {
      queued++;
      await enrichDestinationsTable(sb, dest.name);
    }
  }

  console.log(`[search-discover] Queued ${queued} new destinations from extended list`);
  return queued;
}

// ══════════════════════════════════════════════════════
// ── ENRICH DESTINATIONS TABLE ──
// ══════════════════════════════════════════════════════

async function enrichDestinationsTable(sb: any, destinationName: string, tourCount?: number) {
  try {
    if (!destinationName || destinationName.length < 2) return;

    // Check if already exists in destinations table
    const { data: existing } = await sb
      .from("destinations")
      .select("id, name, image_url, country, rating")
      .ilike("name", destinationName)
      .maybeSingle();

    if (existing) {
      // Update with better data if available
      const updates: Record<string, any> = {};
      if (tourCount && tourCount > 0) updates.flights = tourCount;

      // Fill missing image/country/rating from fallback sources
      if (!existing.image_url || !existing.country || !existing.rating) {
        const fallback = await gatherDestinationFallbackData(sb, destinationName);
        if (!existing.image_url && fallback.image_url) updates.image_url = fallback.image_url;
        if (!existing.country && fallback.country) updates.country = fallback.country;
        if ((!existing.rating || existing.rating === 0) && fallback.rating) updates.rating = fallback.rating;
      }

      if (Object.keys(updates).length > 0) {
        await sb.from("destinations").update(updates).eq("id", existing.id);
        console.log(`[enrich] Updated "${destinationName}" with ${Object.keys(updates).join(", ")}`);
      }
      return;
    }

    // New destination — gather data from all available sources
    const fallback = await gatherDestinationFallbackData(sb, destinationName);

    await sb.from("destinations").insert({
      name: destinationName,
      country: fallback.country || "",
      image_url: fallback.image_url || null,
      rating: fallback.rating || 0,
      flights: tourCount || 0,
      is_active: true,
      sort_order: 99,
    });

    console.log(`[enrich] Added "${destinationName}" to destinations table (sources: ${fallback.sources.join(",")})`);
  } catch (e: any) {
    console.warn(`[enrich] Failed to enrich destination "${destinationName}":`, e.message);
  }
}

/**
 * Multi-source fallback data gathering for a destination.
 * Checks: tour_product_cache → attractions → city_intros → city_landmarks_cache
 */
async function gatherDestinationFallbackData(sb: any, name: string) {
  const result = { image_url: "", country: "", rating: 0, sources: [] as string[] };

  // 1. Tour product cache — best rated product image
  const { data: topProduct } = await sb
    .from("tour_product_cache")
    .select("image_url, rating, destination")
    .ilike("destination", `%${name}%`)
    .order("rating", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (topProduct?.image_url) {
    result.image_url = topProduct.image_url;
    result.rating = topProduct.rating || 0;
    result.sources.push("tour_cache");
  }

  // 2. Attractions table — country info + image fallback
  const { data: attrInfo } = await sb
    .from("attractions")
    .select("country, image_url, popularity_score")
    .ilike("city", `%${name}%`)
    .order("popularity_score", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (attrInfo) {
    if (attrInfo.country) { result.country = attrInfo.country; result.sources.push("attractions"); }
    if (!result.image_url && attrInfo.image_url) { result.image_url = attrInfo.image_url; result.sources.push("attraction_img"); }
  }

  // 3. City intros — hero image + country
  if (!result.image_url || !result.country) {
    const { data: cityIntro } = await sb
      .from("city_intros")
      .select("hero_image_url, country")
      .ilike("city_name", `%${name}%`)
      .maybeSingle();

    if (cityIntro) {
      if (!result.image_url && cityIntro.hero_image_url) { result.image_url = cityIntro.hero_image_url; result.sources.push("city_intro"); }
      if (!result.country && cityIntro.country) { result.country = cityIntro.country; result.sources.push("city_intro_country"); }
    }
  }

  // 4. Attraction count as a proxy rating if no rating yet
  if (!result.rating || result.rating === 0) {
    const { count } = await sb
      .from("attractions")
      .select("id", { count: "exact", head: true })
      .ilike("city", `%${name}%`);

    if (count && count > 0) {
      result.rating = Math.min(5, Math.round((count / 20) * 10) / 10 + 3.5);
      result.sources.push("attraction_count");
    }
  }

  // 5. Fallback — curated hero images for known cities
  if (!result.image_url) {
    const CURATED: Record<string, string> = {
      singapore: "https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=800&h=600&fit=crop",
      bangkok: "https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=800&h=600&fit=crop",
      "kuala lumpur": "https://images.unsplash.com/photo-1596422846543-75c6fc197f07?w=800&h=600&fit=crop",
      penang: "https://images.unsplash.com/photo-1596604075071-101212b3ccab?w=800&h=600&fit=crop",
      langkawi: "https://images.unsplash.com/photo-1609946860441-a51ffcf22208?w=800&h=600&fit=crop",
      tokyo: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800&h=600&fit=crop",
      bali: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=800&h=600&fit=crop",
      paris: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800&h=600&fit=crop",
      london: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=800&h=600&fit=crop",
      dubai: "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=800&h=600&fit=crop",
      rome: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=800&h=600&fit=crop",
      barcelona: "https://images.unsplash.com/photo-1583422409516-2895a77efded?w=800&h=600&fit=crop",
      istanbul: "https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?w=800&h=600&fit=crop",
      phuket: "https://images.unsplash.com/photo-1589394815804-964ed0be2eb5?w=800&h=600&fit=crop",
      seoul: "https://images.unsplash.com/photo-1534274988757-a28bf1a57c17?w=800&h=600&fit=crop",
      "hong kong": "https://images.unsplash.com/photo-1536599018102-9f803c140fc1?w=800&h=600&fit=crop",
      osaka: "https://images.unsplash.com/photo-1590559899731-a382839e5549?w=800&h=600&fit=crop",
      hanoi: "https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=800&h=600&fit=crop",
      taipei: "https://images.unsplash.com/photo-1470004914212-05527e49370b?w=800&h=600&fit=crop",
      delhi: "https://images.unsplash.com/photo-1587474260584-136574528ed5?w=800&h=600&fit=crop",
      mumbai: "https://images.unsplash.com/photo-1570168007204-dfb528c6958f?w=800&h=600&fit=crop",
      jaipur: "https://images.unsplash.com/photo-1477587458883-47145ed94245?w=800&h=600&fit=crop",
      maldives: "https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=800&h=600&fit=crop",
      "new york": "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=800&h=600&fit=crop",
      miami: "https://images.unsplash.com/photo-1533106418989-88406c7cc8ca?w=800&h=600&fit=crop",
      "cape town": "https://images.unsplash.com/photo-1580060839134-75a5edca2e99?w=800&h=600&fit=crop",
      cairo: "https://images.unsplash.com/photo-1572252009286-268acec5ca0a?w=800&h=600&fit=crop",
      sydney: "https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?w=800&h=600&fit=crop",
      amsterdam: "https://images.unsplash.com/photo-1534351590666-13e3e96b5017?w=800&h=600&fit=crop",
      prague: "https://images.unsplash.com/photo-1519677100203-a0e668c92439?w=800&h=600&fit=crop",
      kyoto: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800&h=600&fit=crop",
      kathmandu: "https://images.unsplash.com/photo-1558799401-1dcba79834c2?w=800&h=600&fit=crop",
      santorini: "https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=800&h=600&fit=crop",
      marrakech: "https://images.unsplash.com/photo-1597212618440-806262de4f6b?w=800&h=600&fit=crop",
      cancun: "https://images.unsplash.com/photo-1510097467424-192d713fd8b2?w=800&h=600&fit=crop",
    };
    result.image_url = CURATED[name.toLowerCase()] || `https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&h=600&fit=crop&q=80`;
    result.sources.push("curated_fallback");
  }

  return result;
}

/**
 * Discover destinations from our own DB when Viator taxonomy is unavailable.
 * Uses: attractions table cities, city_intros, existing tour_product_cache destinations.
 */
async function discoverFromOwnData(sb: any): Promise<number> {
  console.log("[own-discover] Falling back to own DB for destination discovery...");

  // Get existing destination IDs we already track
  const { data: existing } = await sb
    .from("tour_sync_state")
    .select("destination_name");
  const existingNames = new Set((existing || []).map((d: any) => d.destination_name?.toLowerCase()));

  const newNames = new Set<string>();

  // Source 1: Unique cities from attractions table (sorted by attraction count)
  let attrCities: any = null;
  try {
    const rpcResult = await sb.rpc("get_top_attraction_cities_fallback");
    attrCities = rpcResult?.data ?? null;
  } catch { /* RPC may not exist */ }

  // Fallback if RPC doesn't exist — raw query via distinct cities
  if (!attrCities) {
    const { data: rawCities } = await sb
      .from("attractions")
      .select("city, country")
      .not("city", "eq", "")
      .limit(500);

    if (rawCities) {
      const cityCount = new Map<string, { country: string; count: number }>();
      for (const r of rawCities) {
        const key = r.city.toLowerCase();
        if (!cityCount.has(key)) cityCount.set(key, { country: r.country, count: 0 });
        cityCount.get(key)!.count++;
      }
      // Sort by attraction count desc, take top cities not already tracked
      const sorted = [...cityCount.entries()].sort((a, b) => b[1].count - a[1].count);
      for (const [city] of sorted) {
        if (!existingNames.has(city)) newNames.add(city);
      }
    }
  }

  // Source 2: Cities from city_intros table
  const { data: introCities } = await sb
    .from("city_intros")
    .select("city_name")
    .limit(200);

  if (introCities) {
    for (const c of introCities) {
      const key = c.city_name?.toLowerCase();
      if (key && !existingNames.has(key)) newNames.add(key);
    }
  }

  // Source 3: Unique destinations from tour_product_cache
  const { data: cachedDests } = await sb
    .from("tour_product_cache")
    .select("destination")
    .not("destination", "eq", "")
    .limit(500);

  if (cachedDests) {
    const destSet = new Set<string>();
    for (const d of cachedDests) {
      const key = d.destination?.toLowerCase();
      if (key && !existingNames.has(key) && !destSet.has(key)) {
        destSet.add(key);
        newNames.add(key);
      }
    }
  }

  if (newNames.size === 0) {
    console.log("[own-discover] No new destinations found from own DB");
    return 0;
  }

  // Queue them with low priority
  let queued = 0;
  const names = [...newNames];
  for (let i = 0; i < names.length; i++) {
    const cityName = names[i].replace(/\b\w/g, c => c.toUpperCase()); // Title Case
    const priority = Math.max(1, 15 - Math.floor(queued / 10));
    const { error } = await sb.from("tour_sync_state").upsert({
      destination_id: `own-${cityName.toLowerCase().replace(/\s+/g, "-")}`,
      destination_name: cityName,
      status: "pending",
      priority,
      updated_at: new Date().toISOString(),
    }, { onConflict: "destination_id" });

    if (!error) {
      queued++;
      await enrichDestinationsTable(sb, cityName);
    }
  }

  console.log(`[own-discover] Queued ${queued} destinations from own DB sources`);
  return queued;
}

// ══════════════════════════════════════════════════════
// ── AUTO-DISCOVER: Fetch Viator taxonomy for new destinations ──
// ══════════════════════════════════════════════════════

async function autoDiscoverDestinations(apiKey: string): Promise<number> {
  const sb = getSupabaseAdmin();

  // Fetch Viator's full destination taxonomy
  console.log("[auto-discover] Fetching Viator destination taxonomy...");
  
  // Try multiple endpoint formats (Viator API versions differ)
  const taxonomyUrls = [
    `${VIATOR_BASE}/v1/taxonomy/destinations`,
    `https://api.viator.com/partner/v1/taxonomy/destinations`,
  ];

  let taxonomyData: any = null;
  for (const url of taxonomyUrls) {
    try {
      const r = await fetch(url, {
        method: "GET",
        headers: {
          "exp-api-key": apiKey,
          "Accept-Language": "en-US",
          "Accept": "application/json",
        },
      });
      console.log(`[auto-discover] ${url} → ${r.status}`);
      if (r.ok) {
        taxonomyData = await r.json();
        break;
      }
    } catch (e) {
      console.warn(`[auto-discover] Failed ${url}:`, e);
    }
  }

  // Fallback: use /products/search to discover destinations dynamically
  if (!taxonomyData) {
    console.log("[auto-discover] Taxonomy endpoint unavailable, using search-based discovery...");
    return await searchBasedDiscovery(apiKey);
  }

  const destinations = taxonomyData.destinations || taxonomyData.data || taxonomyData || [];
  if (!Array.isArray(destinations) || !destinations.length) {
    console.warn("[auto-discover] Unexpected taxonomy format, falling back to search-based discovery");
    return await searchBasedDiscovery(apiKey);
  }

  console.log(`[auto-discover] Got ${destinations.length} destinations from Viator taxonomy`);

  // Get existing destination IDs we already track
  const { data: existing } = await sb
    .from("tour_sync_state")
    .select("destination_id");
  const existingIds = new Set((existing || []).map(d => String(d.destination_id)));

  // Filter to CITY-level destinations not yet in our DB, sort by lookupId (rough popularity proxy)
  const newDests = destinations
    .filter((d: any) => {
      const id = String(d.destinationId || d.ref || d.lookupId || "");
      const type = (d.destinationType || d.type || "").toUpperCase();
      return id && !existingIds.has(id) && (type === "CITY" || type === "TOWN" || type === "REGION");
    })
    .map((d: any) => ({
      id: String(d.destinationId || d.ref || d.lookupId),
      name: d.destinationName || d.name || d.lookupId || "",
      parentId: d.parentId || null,
      type: d.destinationType || d.type || "",
    }));

  if (newDests.length === 0) {
    console.log("[auto-discover] No new Viator taxonomy destinations, trying own DB...");
    return await discoverFromOwnData(sb);
  }

  // Insert in batches, with descending priority (first = higher priority)
  // Start from priority 30 down to 1 for auto-discovered destinations
  let queued = 0;
  const batchSize = 50;
  for (let i = 0; i < newDests.length; i += batchSize) {
    const batch = newDests.slice(i, i + batchSize);
    for (const dest of batch) {
      const priority = Math.max(1, 30 - Math.floor(queued / 10));
      const { error } = await sb.from("tour_sync_state").upsert({
        destination_id: dest.id,
        destination_name: dest.name,
        status: "pending",
        priority,
        updated_at: new Date().toISOString(),
      }, { onConflict: "destination_id" });

      if (!error) {
        queued++;
        // Also enrich the destinations table for homepage/UI usage
        await enrichDestinationsTable(sb, dest.name);
      }
    }
  }

  console.log(`[auto-discover] Queued ${queued} new destinations for syncing`);
  return queued;
}

// ══════════════════════════════════════════════════════
// ── SYNC BATCH: The main work loop ──
// ══════════════════════════════════════════════════════

async function syncBatch(apiKey: string) {
  const sb = getSupabaseAdmin();
  const destMap = await getDestIdToNameMap();

  // Auto-resume paused destinations after 5 min cooldown
  const cooldownCutoff = new Date(Date.now() - 5 * 60_000).toISOString();
  await sb.from("tour_sync_state")
    .update({ status: "syncing", updated_at: new Date().toISOString() })
    .eq("status", "paused")
    .lt("updated_at", cooldownCutoff);

  const { data: candidates } = await sb
    .from("tour_sync_state")
    .select("*")
    .in("status", ["syncing", "pending"])
    .order("priority", { ascending: false })
    .order("updated_at", { ascending: true })
    .limit(1);

  if (!candidates || candidates.length === 0) {
    // All current destinations are done — auto-discover more from Viator taxonomy
    console.log("[sync] All destinations complete. Triggering auto-discovery...");
    const newCount = await autoDiscoverDestinations(apiKey);
    if (newCount > 0) {
      return json({ success: true, message: `Auto-discovered ${newCount} new destinations, will sync on next batch`, autoDiscovered: newCount });
    }
    return json({ success: true, message: "All Viator destinations fully synced!", idle: true, allComplete: true });
  }

  const dest = candidates[0];
  console.log(`[sync] Working on: ${dest.destination_name} (${dest.destination_id}), status=${dest.status}, priority=${dest.priority}`);

  await sb.from("tour_sync_state").update({
    status: "syncing",
    started_at: dest.started_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("destination_id", dest.destination_id);

  let pendingCodes: string[] = [...(dest.product_codes_pending || [])];
  let doneCodes: string[] = [...(dest.product_codes_done || [])];
  let searchCursor = dest.search_cursor || 1;
  let searchComplete = dest.search_complete || false;
  let totalFound = dest.total_products_found || 0;
  let detailedCount = dest.products_detailed || 0;
  let errorCount = dest.error_count || 0;

  // Search for more product codes if needed
  if (!searchComplete && pendingCodes.length < BATCH_DETAIL_LIMIT * 2) {
    try {
      // Determine if we should use text-based search instead of destination ID filter.
      // "own-" prefixed IDs are from DB discovery (no Viator taxonomy ID).
      // Also use text search if prior attempt with destination ID found 0 products.
      const isOwnDiscovered = dest.destination_id.startsWith("own-");
      const isNonNumericId = !/^\d+$/.test(dest.destination_id) && !isOwnDiscovered;
      const priorSearchFailed = searchCursor <= 1 && totalFound === 0 && dest.total_products_found === 0 && dest.error_count === 0;
      const useTextSearch = isOwnDiscovered || isNonNumericId || priorSearchFailed;

      let searchPayload: any;
      let searchUrl = `${VIATOR_BASE}/products/search`;
      if (useTextSearch && dest.destination_name) {
        // Use /search/freetext endpoint for text-based discovery
        console.log(`[sync] Freetext-searching "${dest.destination_name}", cursor=${searchCursor}`);
        searchUrl = `${VIATOR_BASE}/search/freetext`;
        searchPayload = {
          searchTerm: dest.destination_name,
          searchTypes: [{ searchType: "PRODUCTS", pagination: { start: searchCursor, count: SEARCH_PAGE_SIZE } }],
          currency: "USD",
        };
      } else {
        console.log(`[sync] Searching destination ${dest.destination_id}, cursor=${searchCursor}`);
        searchPayload = {
          filtering: { destination: dest.destination_id },
          sorting: { sort: "TRAVELER_RATING", order: "DESCENDING" },
          pagination: { start: searchCursor, count: SEARCH_PAGE_SIZE },
          currency: "USD",
        };
      }

      const res = await fetch(searchUrl, {
        method: "POST",
        headers: viatorHeaders(apiKey),
        body: JSON.stringify(searchPayload),
      });

      if (res.ok) {
        const data = await res.json();
        // Handle both /products/search (data.products) and /search/freetext (data.products in results)
        let products = data.products || [];
        if (useTextSearch && !products.length) {
          // Freetext response: { products: { results: [...], totalCount: N } }
          const prodSection = data.products || {};
          products = prodSection.results || [];
          totalFound = prodSection.totalCount || 0;
        }
        const newCodes = products
          .map((p: any) => p.productCode)
          .filter((c: string) => c && !doneCodes.includes(c) && !pendingCodes.includes(c));

        // If destination ID search returned 0, automatically retry with freetext
        if (!useTextSearch && products.length === 0 && searchCursor <= 1 && dest.destination_name) {
          console.log(`[sync] Destination ID ${dest.destination_id} returned 0, retrying with freetext "${dest.destination_name}"...`);
          const textPayload = {
            searchTerm: dest.destination_name,
            searchTypes: [{ searchType: "PRODUCTS", pagination: { start: 1, count: SEARCH_PAGE_SIZE } }],
            currency: "USD",
          };
          const textRes = await fetch(`${VIATOR_BASE}/search/freetext`, {
            method: "POST",
            headers: viatorHeaders(apiKey),
            body: JSON.stringify(textPayload),
          });
          if (textRes.ok) {
            const textData = await textRes.json();
            const prodSection = textData.products || {};
            const textProducts = prodSection.results || textData.products || [];
            const textCodes = (Array.isArray(textProducts) ? textProducts : [])
              .map((p: any) => p.productCode)
              .filter((c: string) => c && !doneCodes.includes(c) && !pendingCodes.includes(c));
            pendingCodes.push(...textCodes);
            totalFound = prodSection.totalCount || textCodes.length;
            searchCursor = 1 + (Array.isArray(textProducts) ? textProducts.length : 0);
            console.log(`[sync] Freetext fallback found ${totalFound} products for "${dest.destination_name}"`);
            if (!Array.isArray(textProducts) || textProducts.length < SEARCH_PAGE_SIZE || searchCursor > totalFound) {
              searchComplete = true;
            }
          } else {
            console.error(`[sync] Freetext fallback error ${textRes.status}:`, (await textRes.text()).slice(0, 200));
            searchComplete = true;
          }
          await sleep(DELAY_BETWEEN_SEARCH_MS);
        } else {
          pendingCodes.push(...newCodes);
          if (!useTextSearch) totalFound = data.totalCount || totalFound;
          searchCursor += products.length;

          if (products.length < SEARCH_PAGE_SIZE || searchCursor > totalFound) {
            searchComplete = true;
            console.log(`[sync] Search complete for ${dest.destination_name}: ${totalFound} total products`);
          }
          await sleep(DELAY_BETWEEN_SEARCH_MS);
        }
      } else {
        const errText = await res.text();
        console.error(`[sync] Search error ${res.status}:`, errText.slice(0, 200));
        errorCount++;

        if (res.status === 429) {
          await sb.from("tour_sync_state").update({
            status: "paused",
            error_count: errorCount,
            last_error: "Rate limited (429)",
            updated_at: new Date().toISOString(),
          }).eq("destination_id", dest.destination_id);
          return json({ success: true, message: "Rate limited, pausing", rateLimited: true });
        }
      }
    } catch (e: any) {
      console.error(`[sync] Search exception:`, e);
      errorCount++;
    }
  }

  // Fetch product details one at a time (Viator 1-concurrent-request limit)
  // Pre-filter: batch-check which codes already have detail_fetched=true
  let detailsFetched = 0;
  if (pendingCodes.length > 0) {
    const checkBatch = pendingCodes.slice(0, BATCH_DETAIL_LIMIT + 10);
    const { data: alreadyDone } = await sb
      .from("tour_product_cache")
      .select("product_code")
      .in("product_code", checkBatch)
      .eq("provider", "viator")
      .eq("detail_fetched", true);
    const doneSet = new Set((alreadyDone || []).map((r: any) => r.product_code));
    // Move already-done codes out of pending
    for (const code of [...pendingCodes]) {
      if (doneSet.has(code)) {
        pendingCodes.splice(pendingCodes.indexOf(code), 1);
        if (!doneCodes.includes(code)) doneCodes.push(code);
        detailedCount++;
      }
    }
  }

  while (pendingCodes.length > 0 && detailsFetched < BATCH_DETAIL_LIMIT) {
    const productCode = pendingCodes.shift()!;

    try {
      console.log(`[sync] Fetching detail: ${productCode} (${detailsFetched + 1}/${BATCH_DETAIL_LIMIT})`);

      const res = await fetch(`${VIATOR_BASE}/products/${productCode}`, {
        method: "GET",
        headers: viatorHeaders(apiKey),
      });

      if (res.ok) {
        const raw = await res.json();

        // Smart schedule fetch: skip if we already have option pricing cached for this product
        const { data: existingCache } = await sb
          .from("tour_product_cache")
          .select("product_data")
          .eq("product_code", productCode)
          .eq("provider", "viator")
          .maybeSingle();
        const hasSchedulePricing = existingCache?.product_data?._schedulePricing?.optionPricing &&
          Object.keys(existingCache.product_data._schedulePricing.optionPricing).length > 0;

        if (!hasSchedulePricing) {
          try {
            await sleep(DELAY_BETWEEN_DETAILS_MS);
            const schedRes = await fetch(`${VIATOR_BASE}/availability/schedules/${productCode}`, {
              method: "GET", headers: viatorHeaders(apiKey),
            });
            if (schedRes.ok) {
              const schedData = await schedRes.json();
              const optionPricing: Record<string, { fromPrice: number; currency: string }> = {};
              if (schedData.bookableItems?.length > 0) {
                for (const item of schedData.bookableItems) {
                  const optCode = item.productOptionCode || "";
                  let optLowest = 0;
                  for (const season of (item.seasons || [])) {
                    for (const pricing of (season.pricingRecords || [])) {
                      for (const detail of (pricing.pricingDetails || [])) {
                        const p = detail.price?.original?.recommendedRetailPrice || detail.price?.original?.partnerTotalPrice || 0;
                        if (p > 0 && (optLowest === 0 || p < optLowest)) optLowest = p;
                      }
                    }
                  }
                  if (optCode && optLowest > 0) optionPricing[optCode] = { fromPrice: optLowest, currency: schedData.currency || "USD" };
                }
              }
              raw._schedulePricing = { optionPricing, fetchedAt: new Date().toISOString() };
              console.log(`[sync] Schedule pricing for ${productCode}: ${Object.keys(optionPricing).length} options`);
            }
          } catch (schedErr) {
            console.warn(`[sync] Schedule fetch failed for ${productCode}:`, schedErr);
          }
        } else {
          // Reuse existing schedule pricing
          raw._schedulePricing = existingCache.product_data._schedulePricing;
          console.log(`[sync] Reusing cached schedule pricing for ${productCode}`);
        }

        // Extract price with correct native currency
        const extracted = extractPriceWithCurrency(raw, "USD");
        const price = extracted.price;
        const priceCurrency = extracted.currency;

        const reviews = raw.reviews || {};
        const images = (raw.images || []).map((img: any) => {
          const variants = img.variants || [];
          const best = variants.reduce((a: any, b: any) => ((b.width || 0) > (a.width || 0) ? b : a), variants[0] || {});
          return best.url || "";
        }).filter(Boolean);

        let duration = "";
        const dur = raw.duration || {};
        if (dur.fixedDurationInMinutes) {
          const h = Math.floor(dur.fixedDurationInMinutes / 60);
          const m = dur.fixedDurationInMinutes % 60;
          duration = h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ""}` : `${m}m`;
        } else if (dur.variableDurationFromMinutes) {
          const fromH = Math.floor(dur.variableDurationFromMinutes / 60);
          const toH = Math.ceil((dur.variableDurationToMinutes || dur.variableDurationFromMinutes) / 60);
          duration = fromH === toH ? `${fromH}h` : `${fromH}-${toH}h`;
        }

        const rawPricingType = (raw.pricingInfo?.type || (raw.pricing || {}).type || "").toUpperCase();
        const pricingType = rawPricingType === "PER_GROUP" || rawPricingType === "UNIT" ? "PER_GROUP" : "PER_PERSON";
        const destination = resolveProductDestination(raw, destMap, dest.destination_name);
        await autoLearnDestIds(raw, destination);
        const highlights = extractRichHighlights(raw);
        const placesCovered = extractPlacesCoveredFromProduct(raw);

        await sb.from("tour_product_cache").upsert({
          product_code: productCode,
          provider: "viator",
          destination,
          title: raw.title || "",
          short_description: raw.shortDescription || "",
          price,
          currency: priceCurrency,
          pricing_type: pricingType,
          rating: reviews.combinedAverageRating || 0,
          review_count: reviews.totalReviews || 0,
          duration,
          image_url: images[0] || "",
          category: "",
          highlights,
          places_covered: placesCovered.length > 0 ? placesCovered : undefined,
          age_bands: raw.pricingInfo?.ageBands || [],
          product_data: raw, // Includes _schedulePricing
          images,
          tags: highlights,
          sync_source: "background",
          detail_fetched: true,
          is_active: price > 0, // Only active if we have a real price
          last_verified_at: new Date().toISOString(),
          cached_at: new Date().toISOString(),
        }, { onConflict: "product_code,provider" });

        doneCodes.push(productCode);
        detailedCount++;
        detailsFetched++;
        errorCount = 0;

        console.log(`[sync] ✓ ${productCode} — ${raw.title?.slice(0, 50)}`);
      } else if (res.status === 429) {
        pendingCodes.unshift(productCode);
        console.warn(`[sync] Rate limited on ${productCode}, pausing`);

        await sb.from("tour_sync_state").update({
          status: "paused",
          product_codes_pending: pendingCodes,
          product_codes_done: doneCodes,
          products_detailed: detailedCount,
          total_products_found: totalFound,
          search_cursor: searchCursor,
          search_complete: searchComplete,
          error_count: errorCount + 1,
          last_error: "Rate limited (429) on product detail",
          updated_at: new Date().toISOString(),
        }).eq("destination_id", dest.destination_id);

        return json({ success: true, message: "Rate limited, paused", rateLimited: true, detailsFetched });
      } else {
        const errText = await res.text();
        console.warn(`[sync] Error ${res.status} for ${productCode}:`, errText.slice(0, 100));
        errorCount++;
        if (errorCount >= 5) {
          console.warn(`[sync] Too many errors for ${dest.destination_name}, pausing`);
          await sb.from("tour_sync_state").update({
            status: "paused",
            product_codes_pending: pendingCodes,
            product_codes_done: doneCodes,
            products_detailed: detailedCount,
            total_products_found: totalFound,
            search_cursor: searchCursor,
            search_complete: searchComplete,
            error_count: errorCount,
            last_error: `HTTP ${res.status} on ${productCode}`,
            updated_at: new Date().toISOString(),
          }).eq("destination_id", dest.destination_id);
          return json({ success: true, message: "Too many errors, paused", detailsFetched });
        }
      }
    } catch (e: any) {
      console.error(`[sync] Exception fetching ${productCode}:`, e);
      errorCount++;
    }

    if (pendingCodes.length > 0 && detailsFetched < BATCH_DETAIL_LIMIT) {
      await sleep(DELAY_BETWEEN_DETAILS_MS);
    }
  }

  const isComplete = searchComplete && pendingCodes.length === 0;

  await sb.from("tour_sync_state").update({
    status: isComplete ? "completed" : "syncing",
    product_codes_pending: pendingCodes,
    product_codes_done: doneCodes.slice(-500),
    products_detailed: detailedCount,
    total_products_found: totalFound,
    search_cursor: searchCursor,
    search_complete: searchComplete,
    last_product_code: doneCodes[doneCodes.length - 1] || null,
    error_count: errorCount,
    completed_at: isComplete ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }).eq("destination_id", dest.destination_id);

  // When a destination finishes syncing, enrich the destinations table with product stats
  if (isComplete) {
    await enrichDestinationsTable(sb, dest.destination_name, detailedCount);
    console.log(`[sync] ✅ ${dest.destination_name} complete — enriched destinations table`);
  }

  console.log(`[sync] Batch done: ${dest.destination_name} — ${detailsFetched} detailed this batch, ${detailedCount} total, ${pendingCodes.length} remaining`);

  return json({
    success: true,
    destination: dest.destination_name,
    detailsFetched,
    totalDetailed: detailedCount,
    pendingRemaining: pendingCodes.length,
    searchComplete,
    complete: isComplete,
  });
}

// ══════════════════════════════════════════════════════
// ── BACKFILL: Fix $0 prices from schedule pricing ──
// ══════════════════════════════════════════════════════

async function backfillZeroPrices() {
  const sb = getSupabaseAdmin();
  const apiKey = Deno.env.get("VIATOR_API_KEY");
  
  // Get products with price=0
  const { data: zeroPriced } = await sb
    .from("tour_product_cache")
    .select("product_code, product_data")
    .eq("price", 0)
    .eq("is_active", true)
    .eq("detail_fetched", true)
    .limit(50); // Small batch to stay within timeout

  if (!zeroPriced?.length) return json({ success: true, fixed: 0, message: "No zero-priced products to fix" });

  let fixed = 0;
  let skipped = 0;

  for (const product of zeroPriced) {
    // First check if product_data already has schedule pricing
    let schedulePricing = product.product_data?._schedulePricing?.optionPricing;

    // If not, fetch schedule pricing from Viator API
    if ((!schedulePricing || Object.keys(schedulePricing).length === 0) && apiKey) {
      try {
        await sleep(1500);
        const schedRes = await fetch(`${VIATOR_BASE}/availability/schedules/${product.product_code}`, {
          method: "GET", headers: viatorHeaders(apiKey),
        });
        if (schedRes.ok) {
          const schedData = await schedRes.json();
          const optionPricing: Record<string, { fromPrice: number; currency: string }> = {};
          if (schedData.bookableItems?.length > 0) {
            for (const item of schedData.bookableItems) {
              const optCode = item.productOptionCode || "";
              let optLowest = 0;
              for (const season of (item.seasons || [])) {
                for (const pricing of (season.pricingRecords || [])) {
                  for (const detail of (pricing.pricingDetails || [])) {
                    const p = detail.price?.original?.recommendedRetailPrice || detail.price?.original?.partnerTotalPrice || 0;
                    if (p > 0 && (optLowest === 0 || p < optLowest)) optLowest = p;
                  }
                }
              }
              if (optCode && optLowest > 0) optionPricing[optCode] = { fromPrice: optLowest, currency: schedData.currency || "USD" };
            }
          }
          schedulePricing = optionPricing;

          // Save schedule pricing to product_data
          const updatedData = { ...product.product_data, _schedulePricing: { optionPricing, fetchedAt: new Date().toISOString() } };
          await sb.from("tour_product_cache")
            .update({ product_data: updatedData })
            .eq("product_code", product.product_code)
            .eq("provider", "viator");
        }
      } catch (e: any) {
        console.warn(`[backfill] Schedule fetch failed for ${product.product_code}:`, e.message);
      }
    }

    if (!schedulePricing || typeof schedulePricing !== "object") { skipped++; continue; }

    const opts = Object.values(schedulePricing) as Array<{ fromPrice: number }>;
    const lowest = opts.reduce((min: number, o: any) => {
      const p = o?.fromPrice || 0;
      return (p > 0 && (min === 0 || p < min)) ? p : min;
    }, 0);

    if (lowest > 0) {
      await sb.from("tour_product_cache")
        .update({ price: lowest })
        .eq("product_code", product.product_code)
        .eq("provider", "viator");
      fixed++;
      console.log(`[backfill] ✓ ${product.product_code} → $${lowest}`);
    } else {
      skipped++;
    }
  }

  console.log(`[backfill] Done: ${fixed} fixed, ${skipped} skipped out of ${zeroPriced.length}`);
  return json({ success: true, action: "backfill-prices", checked: zeroPriced.length, fixed, skipped });
}


// ══════════════════════════════════════════════════════
// ── BACKFILL: Fix multi-option products missing schedule pricing ──
// ══════════════════════════════════════════════════════

async function backfillOptionPricing(body?: any) {
  const sb = getSupabaseAdmin();
  const apiKey = Deno.env.get("VIATOR_API_KEY");
  if (!apiKey) return json({ success: false, error: "VIATOR_API_KEY not set" }, 500);

  // Accept explicit product codes or scan a small batch
  let productCodes: string[] = body?.productCodes || [];

  if (!productCodes.length) {
    // Scan approach: fetch only products we know have multiple options via a targeted query
    // We select a small batch and check in JS since supabase-js can't filter by jsonb_array_length
    const { data: batch } = await sb
      .from("tour_product_cache")
      .select("product_code, product_data")
      .eq("is_active", true)
      .eq("provider", "viator")
      .eq("detail_fetched", true)
      .order("updated_at", { ascending: true })
      .limit(1000);

    if (batch?.length) {
      productCodes = batch
        .filter((p: any) => {
          const opts = p.product_data?.productOptions;
          if (!Array.isArray(opts) || opts.length < 2) return false;
          const cached = p.product_data?._schedulePricing?.optionPricing;
          return !cached || typeof cached !== "object" || Object.keys(cached).length === 0;
        })
        .map((p: any) => p.product_code);
    }
  }

  if (!productCodes.length) return json({ success: true, action: "backfill-option-pricing", needsFix: 0, fixed: 0, message: "All multi-option products have pricing" });

  // Process up to 8 per invocation (rate limit safe within edge function timeout)
  const toProcess = productCodes.slice(0, 8);
  let fixed = 0;
  let failed = 0;

  for (const pc of toProcess) {
    try {
      await sleep(800);
      // Fetch product data if not already loaded
      const { data: prod } = await sb
        .from("tour_product_cache")
        .select("product_code, product_data")
        .eq("product_code", pc)
        .eq("provider", "viator")
        .maybeSingle();
      if (!prod) { failed++; continue; }

      const schedRes = await fetch(`${VIATOR_BASE}/availability/schedules/${pc}`, {
        method: "GET", headers: viatorHeaders(apiKey),
      });
      if (!schedRes.ok) { failed++; continue; }

      const schedData = await schedRes.json();
      const optionPricing: Record<string, { fromPrice: number; currency: string }> = {};
      if (schedData.bookableItems?.length > 0) {
        for (const item of schedData.bookableItems) {
          const optCode = item.productOptionCode || "";
          let optLowest = 0;
          for (const season of (item.seasons || [])) {
            for (const pricing of (season.pricingRecords || [])) {
              for (const detail of (pricing.pricingDetails || [])) {
                const p = detail.price?.original?.recommendedRetailPrice || detail.price?.original?.partnerTotalPrice || 0;
                if (p > 0 && (optLowest === 0 || p < optLowest)) optLowest = p;
              }
            }
          }
          if (optCode && optLowest > 0) optionPricing[optCode] = { fromPrice: optLowest, currency: schedData.currency || "USD" };
        }
      }

      if (Object.keys(optionPricing).length > 0) {
        const updatedData = { ...prod.product_data, _schedulePricing: { optionPricing, fetchedAt: new Date().toISOString() } };
        await sb.from("tour_product_cache")
          .update({ product_data: updatedData, updated_at: new Date().toISOString() })
          .eq("product_code", pc)
          .eq("provider", "viator");
        fixed++;
        console.log(`[backfill-opts] ✓ ${pc} → ${Object.keys(optionPricing).length} options priced`);
      } else {
        console.log(`[backfill-opts] ✗ ${pc} → no bookable items returned`);
        failed++;
      }
    } catch (e: any) {
      console.warn(`[backfill-opts] Error ${pc}:`, e.message);
      failed++;
    }
  }

  const remaining = productCodes.length - toProcess.length;
  console.log(`[backfill-opts] Done: ${fixed} fixed, ${failed} failed, ${remaining} remaining`);
  return json({ success: true, action: "backfill-option-pricing", needsFix: productCodes.length, processed: toProcess.length, fixed, failed, remaining });
}

// ══════════════════════════════════════════════════════
// ── RE-RESOLVE DESTINATIONS: Fix existing products without API calls ──
// ══════════════════════════════════════════════════════

async function reResolveDestinations(fixAll = false) {
  const sb = getSupabaseAdmin();
  // Force fresh map
  destIdToNameCache = null;
  destCacheExpiry = 0;
  const freshMap = await getDestIdToNameMap();
  const countryMap = destIdToCountryCache || {};

  console.log(`[re-resolve] Loaded ${Object.keys(freshMap).length} destination mappings, fixAll=${fixAll}`);

  if (fixAll) {
    // Efficient batch: use a DB-side approach — fetch only the destinations ref from JSONB
    // Process in smaller batches to avoid timeout
    let totalChanged = 0;
    let totalProcessed = 0;
    let offset = 0;
    const batchSize = 200;

    while (true) {
      const { data: products, error } = await sb
        .from("tour_product_cache")
        .select("product_code, provider, destination, title, product_data->destinations")
        .not("product_data", "is", null)
        .eq("is_active", true)
        .range(offset, offset + batchSize - 1);

      if (error || !products?.length) break;
      totalProcessed += products.length;

      for (const product of products) {
        const dests = (product as any).destinations || [];
        if (!Array.isArray(dests) || dests.length === 0) continue;

        const primary = dests.find((d: any) => d.primary) || dests[0];
        const ref = String(primary?.ref || "");
        const resolvedDest = ref && freshMap[ref] ? freshMap[ref] : null;

        if (resolvedDest && resolvedDest !== product.destination) {
          await sb.from("tour_product_cache")
            .update({ destination: resolvedDest })
            .eq("product_code", product.product_code)
            .eq("provider", product.provider);
          totalChanged++;
          console.log(`[fix-dest] ${product.product_code}: "${product.destination}" → "${resolvedDest}"`);
        }
      }

      if (products.length < batchSize) break;
      offset += batchSize;
      
      // Safety: don't process more than 5000 in one call
      if (offset >= 5000) break;
    }

    console.log(`[fix-dest] Done: ${totalChanged} changed out of ${totalProcessed} processed`);
    return json({ success: true, action: "fix-destinations", processed: totalProcessed, changed: totalChanged });
  }

  // Original behavior: only fix detail_fetched=false
  const { data: products, error } = await sb
    .from("tour_product_cache")
    .select("product_code, provider, destination, product_data, title")
    .eq("detail_fetched", false)
    .not("product_data", "is", null)
    .limit(500);

  if (error || !products?.length) {
    return json({ success: true, action: "re-resolve", resolved: 0, message: error?.message || "No products to re-resolve" });
  }

  let changed = 0;
  let unchanged = 0;

  for (const product of products) {
    const raw = product.product_data;
    if (!raw || typeof raw !== "object") continue;

    const newDest = resolveProductDestination(raw, freshMap, "");

    if (newDest && newDest !== product.destination) {
      await sb.from("tour_product_cache")
        .update({ destination: newDest, detail_fetched: true })
        .eq("product_code", product.product_code)
        .eq("provider", product.provider);
      changed++;
    } else if (newDest) {
      await sb.from("tour_product_cache")
        .update({ detail_fetched: true })
        .eq("product_code", product.product_code)
        .eq("provider", product.provider);
      unchanged++;
    }
  }

  return json({ success: true, action: "re-resolve", processed: products.length, changed, unchanged });
}

// ══════════════════════════════════════════════════════
// ── SYNC TAXONOMY: Cache ALL Viator destinations locally ──
// ══════════════════════════════════════════════════════

async function syncTaxonomy(apiKey: string) {
  const sb = getSupabaseAdmin();
  console.log("[taxonomy] Fetching full Viator destination taxonomy...");

  // Viator v2 API endpoint for destinations
  const res = await fetch(`${VIATOR_BASE}/destinations`, {
    method: "GET",
    headers: viatorHeaders(apiKey),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`[taxonomy] Error ${res.status}:`, errText.slice(0, 300));
    return json({ success: false, error: `Viator API error: ${res.status}` }, 500);
  }

  const data = await res.json();
  const destinations = data.destinations || data || [];
  
  if (!Array.isArray(destinations) || destinations.length === 0) {
    return json({ success: false, error: "No destinations in response" }, 500);
  }

  console.log(`[taxonomy] Received ${destinations.length} destinations from Viator`);

  // Build parent lookup for resolving country names from hierarchy
  const destById: Record<string, any> = {};
  for (const d of destinations) {
    const id = String(d.destinationId || d.ref || "");
    if (id) destById[id] = d;
  }

  // Resolve country name by walking up the parent chain
  function resolveCountry(dest: any): string {
    const visited = new Set<string>();
    let current = dest;
    while (current) {
      const id = String(current.destinationId || current.ref || "");
      if (visited.has(id)) break;
      visited.add(id);
      
      const type = (current.destinationType || current.type || "").toUpperCase();
      if (type === "COUNTRY") return current.destinationName || current.name || "";
      
      const parentId = String(current.parentId || current.parentDestinationId || "");
      if (!parentId || parentId === id) break;
      current = destById[parentId];
    }
    return "";
  }

  // Resolve region (intermediate level between city and country)
  function resolveRegion(dest: any): string {
    const visited = new Set<string>();
    let current = dest;
    while (current) {
      const id = String(current.destinationId || current.ref || "");
      if (visited.has(id)) break;
      visited.add(id);
      
      const type = (current.destinationType || current.type || "").toUpperCase();
      if (type === "REGION" || type === "STATE" || type === "PROVINCE") {
        return current.destinationName || current.name || "";
      }
      
      const parentId = String(current.parentId || current.parentDestinationId || "");
      if (!parentId || parentId === id) break;
      current = destById[parentId];
    }
    return "";
  }

  let upserted = 0;
  let errors = 0;
  const now = new Date().toISOString();

  // Process in batches of 100
  const batchSize = 100;
  for (let i = 0; i < destinations.length; i += batchSize) {
    const batch = destinations.slice(i, i + batchSize);
    const rows = batch.map((d: any) => {
      const destId = String(d.destinationId || d.ref || "");
      const destName = d.destinationName || d.name || "";
      const destType = (d.destinationType || d.type || "").toUpperCase();
      const parentId = String(d.parentId || d.parentDestinationId || "");
      const lookupId = String(d.lookupId || d.destinationUrlName || "");
      const lat = d.latitude || d.center?.latitude || null;
      const lng = d.longitude || d.center?.longitude || null;
      const iataCode = d.iataCode || "";
      const timeZone = d.timeZone || "";
      const currency = d.defaultCurrencyCode || "USD";
      const country = resolveCountry(d);
      const region = resolveRegion(d);

      return {
        dest_id: destId,
        city_name: destName,
        country,
        region,
        dest_type: destType,
        parent_id: parentId,
        lookup_id: lookupId,
        latitude: lat,
        longitude: lng,
        iata_code: iataCode,
        time_zone: timeZone,
        default_currency: currency,
        taxonomy_synced_at: now,
      };
    }).filter((r: any) => r.dest_id && r.city_name);

    const { error } = await sb.from("viator_destination_map").upsert(rows, {
      onConflict: "dest_id",
    });

    if (error) {
      console.error(`[taxonomy] Batch ${i} error:`, error.message);
      errors++;
    } else {
      upserted += rows.length;
    }
  }

  // Invalidate caches so next sync/search uses fresh data
  destIdToNameCache = null;
  destIdToCountryCache = null;
  destCacheExpiry = 0;

  // Count final state
  const { count: totalInMap } = await sb
    .from("viator_destination_map")
    .select("*", { count: "exact", head: true });

  console.log(`[taxonomy] Done: ${upserted} upserted, ${errors} errors, ${totalInMap} total in map`);

  return json({
    success: true,
    action: "sync-taxonomy",
    viatorTotal: destinations.length,
    upserted,
    errors,
    totalInMap: totalInMap || 0,
  });
}

// ══════════════════════════════════════════════════════
// ── FAST SYNC: Process specific destinations with minimal delay ──
// ══════════════════════════════════════════════════════

async function fastSyncDestinations(apiKey: string, destinationIds: string[]) {
  const sb = getSupabaseAdmin();
  const destMap = await getDestIdToNameMap();
  const FAST_DELAY_MS = 300;  // Aggressive but still serial
  const FAST_BATCH_LIMIT = 50; // More products per run
  const startTime = Date.now();
  const MAX_RUNTIME_MS = 110_000; // 110s safety margin

  if (!destinationIds.length) {
    return json({ success: false, error: "destinationIds required" }, 400);
  }

  // Bump priority for these destinations
  await sb.from("tour_sync_state")
    .update({ priority: 999, status: "syncing", updated_at: new Date().toISOString() })
    .in("destination_id", destinationIds);

  // Get the destination states
  const { data: dests } = await sb
    .from("tour_sync_state")
    .select("*")
    .in("destination_id", destinationIds)
    .order("products_detailed", { ascending: true });

  if (!dests?.length) return json({ success: false, error: "No destinations found" }, 404);

  const results: any[] = [];

  for (const dest of dests) {
    if (Date.now() - startTime > MAX_RUNTIME_MS) break;

    let pendingCodes: string[] = [...(dest.product_codes_pending || [])];
    let doneCodes: string[] = [...(dest.product_codes_done || [])];
    let searchCursor = dest.search_cursor || 1;
    let searchComplete = dest.search_complete || false;
    let totalFound = dest.total_products_found || 0;
    let detailedCount = dest.products_detailed || 0;
    let detailsFetched = 0;

    // Search for product codes if needed
    if (!searchComplete && pendingCodes.length < FAST_BATCH_LIMIT * 2) {
      const isOwnDiscovered = dest.destination_id.startsWith("own-");
      const isNonNumericId = !/^\d+$/.test(dest.destination_id) && !isOwnDiscovered;
      const priorSearchFailed = searchCursor <= 1 && totalFound === 0;
      const useTextSearch = isOwnDiscovered || isNonNumericId || priorSearchFailed;

      try {
        let searchUrl = `${VIATOR_BASE}/products/search`;
        let searchPayload: any;
        if (useTextSearch) {
          searchUrl = `${VIATOR_BASE}/search/freetext`;
          searchPayload = {
            searchTerm: dest.destination_name,
            searchTypes: [{ searchType: "PRODUCTS", pagination: { start: searchCursor, count: SEARCH_PAGE_SIZE } }],
            currency: "USD",
          };
        } else {
          searchPayload = {
            filtering: { destination: dest.destination_id },
            sorting: { sort: "TRAVELER_RATING", order: "DESCENDING" },
            pagination: { start: searchCursor, count: SEARCH_PAGE_SIZE },
            currency: "USD",
          };
        }

        const res = await fetch(searchUrl, {
          method: "POST", headers: viatorHeaders(apiKey), body: JSON.stringify(searchPayload),
        });
        if (res.ok) {
          const data = await res.json();
          const products = useTextSearch
            ? (data.products?.results || [])
            : (data.products || []);
          const total = useTextSearch
            ? (data.products?.totalCount || products.length)
            : (data.totalCount || products.length);
          totalFound = Math.max(totalFound, total);

          const newCodes = products
            .map((p: any) => p.productCode)
            .filter((c: string) => c && !doneCodes.includes(c) && !pendingCodes.includes(c));
          pendingCodes.push(...newCodes);
          searchCursor += SEARCH_PAGE_SIZE;
          if (products.length < SEARCH_PAGE_SIZE) searchComplete = true;
        }
        await sleep(FAST_DELAY_MS);
      } catch (e) {
        console.warn(`[fast-sync] Search error for ${dest.destination_name}:`, e);
      }
    }

    // Filter already-done codes
    if (pendingCodes.length > 0) {
      const checkBatch = pendingCodes.slice(0, FAST_BATCH_LIMIT + 10);
      const { data: alreadyDone } = await sb
        .from("tour_product_cache")
        .select("product_code")
        .in("product_code", checkBatch)
        .eq("provider", "viator")
        .eq("detail_fetched", true);
      const doneSet = new Set((alreadyDone || []).map((r: any) => r.product_code));
      for (const code of [...pendingCodes]) {
        if (doneSet.has(code)) {
          pendingCodes.splice(pendingCodes.indexOf(code), 1);
          if (!doneCodes.includes(code)) doneCodes.push(code);
          detailedCount++;
        }
      }
    }

    // Fetch details with fast delay
    while (pendingCodes.length > 0 && detailsFetched < FAST_BATCH_LIMIT && (Date.now() - startTime < MAX_RUNTIME_MS)) {
      const productCode = pendingCodes.shift()!;
      try {
        const res = await fetch(`${VIATOR_BASE}/products/${productCode}`, {
          method: "GET", headers: viatorHeaders(apiKey),
        });
        if (res.ok) {
          const raw = await res.json();

          // Check if schedule pricing already cached
          const { data: existingCache } = await sb
            .from("tour_product_cache")
            .select("product_data")
            .eq("product_code", productCode)
            .eq("provider", "viator")
            .maybeSingle();
          const hasSchedulePricing = existingCache?.product_data?._schedulePricing?.optionPricing &&
            Object.keys(existingCache.product_data._schedulePricing.optionPricing).length > 0;

          if (!hasSchedulePricing) {
            await sleep(FAST_DELAY_MS);
            try {
              const schedRes = await fetch(`${VIATOR_BASE}/availability/schedules/${productCode}`, {
                method: "GET", headers: viatorHeaders(apiKey),
              });
              if (schedRes.ok) {
                const schedData = await schedRes.json();
                const optionPricing: Record<string, { fromPrice: number; currency: string }> = {};
                if (schedData.bookableItems?.length > 0) {
                  for (const item of schedData.bookableItems) {
                    const optCode = item.productOptionCode || "";
                    let optLowest = 0;
                    for (const season of (item.seasons || [])) {
                      for (const pricing of (season.pricingRecords || [])) {
                        for (const detail of (pricing.pricingDetails || [])) {
                          const p = detail.price?.original?.recommendedRetailPrice || detail.price?.original?.partnerTotalPrice || 0;
                          if (p > 0 && (optLowest === 0 || p < optLowest)) optLowest = p;
                        }
                      }
                    }
                    if (optCode && optLowest > 0) optionPricing[optCode] = { fromPrice: optLowest, currency: schedData.currency || "USD" };
                  }
                }
                raw._schedulePricing = { optionPricing, fetchedAt: new Date().toISOString() };
              }
            } catch {}
          } else {
            raw._schedulePricing = existingCache.product_data._schedulePricing;
          }

          // Extract price with correct native currency
          const extracted = extractPriceWithCurrency(raw, "USD");
          const price = extracted.price;
          const priceCurrency = extracted.currency;

          const reviews = raw.reviews || {};
          const images = (raw.images || []).map((img: any) => {
            const variants = img.variants || [];
            const best = variants.reduce((a: any, b: any) => ((b.width || 0) > (a.width || 0) ? b : a), variants[0] || {});
            return best.url || "";
          }).filter(Boolean);
          let duration = "";
          const dur = raw.duration || {};
          if (dur.fixedDurationInMinutes) {
            const h = Math.floor(dur.fixedDurationInMinutes / 60);
            const m = dur.fixedDurationInMinutes % 60;
            duration = h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ""}` : `${m}m`;
          } else if (dur.variableDurationFromMinutes) {
            const fromH = Math.floor(dur.variableDurationFromMinutes / 60);
            const toH = Math.ceil((dur.variableDurationToMinutes || dur.variableDurationFromMinutes) / 60);
            duration = fromH === toH ? `${fromH}h` : `${fromH}-${toH}h`;
          }
          const rawPricingType = (raw.pricingInfo?.type || (raw.pricing || {}).type || "").toUpperCase();
          const pricingType = rawPricingType === "PER_GROUP" || rawPricingType === "UNIT" ? "PER_GROUP" : "PER_PERSON";
          const destination = resolveProductDestination(raw, destMap, dest.destination_name);
          await autoLearnDestIds(raw, destination);
          const highlights = (raw.tags || [])
            .map((t: any) => t?.allNamesByLocale?.en || t?.tagName || "")
            .filter((h: string) => h && !/viator/i.test(h))
            .slice(0, 5);

          await sb.from("tour_product_cache").upsert({
            product_code: productCode, provider: "viator", destination,
            title: raw.title || "", short_description: raw.shortDescription || "",
            price, currency: priceCurrency, pricing_type: pricingType,
            rating: reviews.combinedAverageRating || 0, review_count: reviews.totalReviews || 0,
            duration, image_url: images[0] || "", category: "", highlights,
            age_bands: raw.pricingInfo?.ageBands || [], product_data: raw, images, tags: highlights,
            sync_source: "fast-sync", detail_fetched: true, is_active: price > 0,
            last_verified_at: new Date().toISOString(), cached_at: new Date().toISOString(),
          }, { onConflict: "product_code,provider" });

          doneCodes.push(productCode);
          detailedCount++;
          detailsFetched++;
        } else if (res.status === 429) {
          pendingCodes.unshift(productCode);
          console.warn(`[fast-sync] Rate limited, stopping`);
          break;
        }
      } catch (e: any) {
        console.warn(`[fast-sync] Error on ${productCode}:`, e.message);
      }

      if (pendingCodes.length > 0 && detailsFetched < FAST_BATCH_LIMIT) {
        await sleep(FAST_DELAY_MS);
      }
    }

    // Save state
    const isComplete = searchComplete && pendingCodes.length === 0;
    await sb.from("tour_sync_state").update({
      status: isComplete ? "completed" : "syncing",
      product_codes_pending: pendingCodes,
      product_codes_done: doneCodes.slice(-500),
      products_detailed: detailedCount,
      total_products_found: totalFound,
      search_cursor: searchCursor,
      search_complete: searchComplete,
      updated_at: new Date().toISOString(),
      ...(isComplete ? { completed_at: new Date().toISOString() } : {}),
    }).eq("destination_id", dest.destination_id);

    results.push({
      destination: dest.destination_name,
      detailsFetched,
      totalDetailed: detailedCount,
      pending: pendingCodes.length,
      complete: isComplete,
    });

    console.log(`[fast-sync] ${dest.destination_name}: ${detailsFetched} fetched, ${pendingCodes.length} remaining`);
  }

  return json({ success: true, action: "fast-sync", results, elapsedMs: Date.now() - startTime });
}

// ── Main Handler ──
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { action } = body;

    if (action === "sync-status") return await syncStatus();
    if (action === "sync-init") return await syncInit();
    if (action === "sync-prioritize") return await syncPrioritize(body);
    if (action === "record-search-hit") return await recordSearchHit(body);
    if (action === "re-resolve") return await reResolveDestinations();
    if (action === "fix-destinations") {
      const sb = getSupabaseAdmin();
      const { data, error } = await sb.rpc("fix_tour_destinations", { batch_size: body.batchSize || 5000 });
      if (error) return json({ success: false, error: error.message }, 500);
      return json({ success: true, action: "fix-destinations", result: data });
    }

    const apiKey = Deno.env.get("VIATOR_API_KEY");
    if (!apiKey) return json({ success: false, error: "VIATOR_API_KEY not configured" }, 500);

    if (action === "sync-batch") return await syncBatch(apiKey);
    if (action === "fast-sync") return await fastSyncDestinations(apiKey, body.destinationIds || []);
    if (action === "sync-taxonomy") return await syncTaxonomy(apiKey);
    if (action === "modified-since") return await modifiedSinceSync(apiKey);
    if (action === "destination-refresh") return await destinationRefresh(apiKey);
    if (action === "sync-discover") {
      const count = await autoDiscoverDestinations(apiKey);
      return json({ success: true, action: "sync-discover", newDestinations: count });
    }
    if (action === "backfill-prices") return await backfillZeroPrices();
    if (action === "backfill-option-pricing") return await backfillOptionPricing(body);
    if (action === "backfill-highlights") {
      const sb = getSupabaseAdmin();
      const batchSize = body.batchSize || 5000;
      const { data, error } = await sb.rpc("backfill_tour_highlights", { batch_size: batchSize });
      if (error) return json({ success: false, error: error.message }, 500);
      return json({ success: true, ...(data || {}) });
    }

    return json({ success: false, error: `Unknown action: ${action}` }, 400);
  } catch (err: any) {
    console.error("[tour-inventory-sync] Error:", err);
    return json({ success: false, error: err.message }, 500);
  }
});

