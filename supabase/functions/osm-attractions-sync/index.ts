import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * OSM Attractions Sync — Fetches attractions from OpenStreetMap Overpass API
 * 
 * Actions:
 *   sync-city      — Fetch all attractions for a specific city from OSM
 *   sync-batch     — Process next pending city from attraction_sync_state
 *   sync-init      — Initialize popular cities into attraction_sync_state
 *   enrich-batch   — AI-enrich attractions missing descriptions (batch of 30-50 per prompt)
 *   search         — Search attractions from our DB
 *   sync-status    — Get current sync progress
 * 
 * Cost strategy:
 *   - OSM Overpass API: FREE, unlimited
 *   - Wikipedia API: FREE, no key needed
 *   - AI (Gemini Flash Lite): only for gaps, batched 30-50 per prompt (~$0.002/city)
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const WIKIPEDIA_API = "https://en.wikipedia.org/api/rest_v1/page/summary";

// Popular destinations — Asia first, then rest
const POPULAR_CITIES = [
  // Asia Tier 1
  { city: "Bangkok", country: "Thailand", priority: 100 },
  { city: "Singapore", country: "Singapore", priority: 99 },
  { city: "Tokyo", country: "Japan", priority: 98 },
  { city: "Bali", country: "Indonesia", priority: 97 },
  { city: "Phuket", country: "Thailand", priority: 96 },
  { city: "Kuala Lumpur", country: "Malaysia", priority: 95 },
  { city: "Seoul", country: "South Korea", priority: 94 },
  { city: "Hong Kong", country: "China", priority: 93 },
  { city: "Hanoi", country: "Vietnam", priority: 92 },
  { city: "Ho Chi Minh City", country: "Vietnam", priority: 91 },
  { city: "Taipei", country: "Taiwan", priority: 90 },
  { city: "Osaka", country: "Japan", priority: 89 },
  { city: "Kyoto", country: "Japan", priority: 88 },
  { city: "Manila", country: "Philippines", priority: 87 },
  { city: "Jakarta", country: "Indonesia", priority: 86 },
  // Asia Tier 2
  { city: "Delhi", country: "India", priority: 85 },
  { city: "Mumbai", country: "India", priority: 84 },
  { city: "Jaipur", country: "India", priority: 83 },
  { city: "Goa", country: "India", priority: 82 },
  { city: "Kolkata", country: "India", priority: 81 },
  { city: "Dhaka", country: "Bangladesh", priority: 80 },
  { city: "Kathmandu", country: "Nepal", priority: 79 },
  { city: "Colombo", country: "Sri Lanka", priority: 78 },
  { city: "Phnom Penh", country: "Cambodia", priority: 77 },
  { city: "Siem Reap", country: "Cambodia", priority: 76 },
  { city: "Yangon", country: "Myanmar", priority: 75 },
  { city: "Chiang Mai", country: "Thailand", priority: 74 },
  { city: "Beijing", country: "China", priority: 73 },
  { city: "Shanghai", country: "China", priority: 72 },
  // Middle East
  { city: "Dubai", country: "UAE", priority: 71 },
  { city: "Abu Dhabi", country: "UAE", priority: 70 },
  { city: "Doha", country: "Qatar", priority: 69 },
  { city: "Istanbul", country: "Turkey", priority: 68 },
  { city: "Muscat", country: "Oman", priority: 67 },
  // Europe
  { city: "Paris", country: "France", priority: 60 },
  { city: "London", country: "United Kingdom", priority: 59 },
  { city: "Rome", country: "Italy", priority: 58 },
  { city: "Barcelona", country: "Spain", priority: 57 },
  { city: "Amsterdam", country: "Netherlands", priority: 56 },
  { city: "Prague", country: "Czech Republic", priority: 55 },
  { city: "Vienna", country: "Austria", priority: 54 },
  { city: "Athens", country: "Greece", priority: 53 },
  { city: "Lisbon", country: "Portugal", priority: 52 },
  { city: "Berlin", country: "Germany", priority: 51 },
  // Americas & Oceania
  { city: "New York", country: "United States", priority: 45 },
  { city: "Sydney", country: "Australia", priority: 44 },
  { city: "Melbourne", country: "Australia", priority: 43 },
  { city: "Cancun", country: "Mexico", priority: 42 },
  { city: "Rio de Janeiro", country: "Brazil", priority: 41 },
  // Africa
  { city: "Cape Town", country: "South Africa", priority: 35 },
  { city: "Marrakech", country: "Morocco", priority: 34 },
  { city: "Cairo", country: "Egypt", priority: 33 },
];

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

// ── OSM Overpass query builder ──
function buildOverpassQueryBbox(south: number, west: number, north: number, east: number): string {
  const bbox = `${south},${west},${north},${east}`;
  return `
[out:json][timeout:30];
(
  nwr["tourism"~"attraction|museum|artwork|viewpoint|gallery|theme_park|zoo"](${bbox});
  nwr["historic"~"monument|memorial|castle|fort|ruins|archaeological_site|palace|temple"](${bbox});
  nwr["leisure"~"park|garden|nature_reserve|beach_resort|water_park"](${bbox});
  nwr["natural"~"beach|peak|volcano|cave_entrance|waterfall"](${bbox});
);
out center tags 150;`;
}

// Geocode city to bounding box using Nominatim (one call, free)
async function geocodeCity(city: string, country: string): Promise<{ south: number; west: number; north: number; east: number } | null> {
  try {
    const q = `${city}, ${country}`;
    const url = `https://nominatim.openstreetmap.org/search?${new URLSearchParams({
      q, format: "json", limit: "1", "accept-language": "en",
    })}`;
    const res = await fetch(url, { headers: { "User-Agent": "LovableTravelApp/1.0" } });
    if (!res.ok) { await res.text(); return null; }
    const data = await res.json();
    if (data.length === 0 || !data[0].boundingbox) return null;
    let [south, north, west, east] = data[0].boundingbox.map(Number);
    // Cap bbox to ~0.3° (~30km) around center to avoid Overpass timeouts on large regions
    const lat = data[0].lat ? Number(data[0].lat) : (south + north) / 2;
    const lon = data[0].lon ? Number(data[0].lon) : (west + east) / 2;
    const MAX_SPAN = 0.3;
    if ((north - south) > MAX_SPAN * 2) { south = lat - MAX_SPAN; north = lat + MAX_SPAN; }
    if ((east - west) > MAX_SPAN * 2) { west = lon - MAX_SPAN; east = lon + MAX_SPAN; }
    return { south, west, north, east };
  } catch { return null; }
}

// ── Category mapping from OSM tags ──
function categorizeOSM(tags: Record<string, string>): { category: string; subcategory: string } {
  const tourism = tags.tourism || "";
  const historic = tags.historic || "";
  const leisure = tags.leisure || "";
  const natural = tags.natural || "";

  if (tourism === "museum" || tourism === "gallery") return { category: "museum", subcategory: tourism };
  if (historic) return { category: "monument", subcategory: historic };
  if (natural === "beach" || leisure === "beach_resort") return { category: "beach", subcategory: natural || leisure };
  if (leisure === "park" || leisure === "garden" || leisure === "nature_reserve") return { category: "park", subcategory: leisure };
  if (tourism === "theme_park" || tourism === "zoo" || leisure === "water_park") return { category: "theme_park", subcategory: tourism || leisure };
  if (tourism === "viewpoint") return { category: "viewpoint", subcategory: "" };
  if (natural === "peak" || natural === "volcano") return { category: "nature", subcategory: natural };
  if (natural === "waterfall" || natural === "cave_entrance") return { category: "nature", subcategory: natural };
  if (tourism === "attraction") return { category: "attraction", subcategory: "" };
  return { category: "attraction", subcategory: tourism || historic || leisure || natural };
}

// ── Compute popularity from OSM data ──
function computePopularity(tags: Record<string, string>): number {
  let score = 0;
  if (tags.wikidata) score += 30; // Has Wikidata = notable
  if (tags.wikipedia) score += 20; // Has Wikipedia article
  if (tags["name:en"]) score += 5; // Has English name = international interest
  if (tags.tourism === "attraction") score += 10;
  if (tags.historic) score += 5;
  // UNESCO
  if (tags.heritage === "world_heritage" || tags["whc:inscription_date"]) score += 50;
  return score;
}

// ── Fetch Wikipedia summary ──
async function fetchWikipediaSummary(title: string): Promise<{ extract: string; url: string } | null> {
  try {
    const encoded = encodeURIComponent(title.replace(/ /g, "_"));
    const res = await fetch(`${WIKIPEDIA_API}/${encoded}`, {
      headers: { "User-Agent": "LovableTravelApp/1.0" },
    });
    if (!res.ok) { await res.text(); return null; }
    const data = await res.json();
    if (data.type === "standard" && data.extract) {
      return { extract: data.extract, url: data.content_urls?.desktop?.page || "" };
    }
    return null;
  } catch { return null; }
}

// ── Fetch attractions from OSM for a city ──
async function syncCity(city: string, country: string, sb: any): Promise<{ count: number; errors: string[] }> {
  const errors: string[] = [];
  
  // Update sync state
  await sb.from("attraction_sync_state").upsert({
    city, country, status: "syncing", updated_at: new Date().toISOString(),
  }, { onConflict: "city,country" });

  // 1. Geocode city to bounding box, then fetch from OSM Overpass
  const bbox = await geocodeCity(city, country);
  if (!bbox) {
    errors.push(`Could not geocode ${city}, ${country}`);
    await sb.from("attraction_sync_state").upsert({
      city, country, status: "error", error_message: "Geocode failed", updated_at: new Date().toISOString(),
    }, { onConflict: "city,country" });
    return { count: 0, errors };
  }
  const query = buildOverpassQueryBbox(bbox.south, bbox.west, bbox.north, bbox.east);
  console.log(`[osm] Fetching attractions for ${city}, ${country} (bbox: ${JSON.stringify(bbox)})...`);

  let osmData: any;
  try {
    const res = await fetch(OVERPASS_URL, {
      method: "POST",
      body: `data=${encodeURIComponent(query)}`,
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "LovableTravelApp/1.0" },
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OSM API ${res.status}: ${errText.slice(0, 200)}`);
    }
    osmData = await res.json();
  } catch (e: any) {
    errors.push(`OSM fetch failed: ${e.message}`);
    await sb.from("attraction_sync_state").upsert({
      city, country, status: "error", error_message: e.message, updated_at: new Date().toISOString(),
    }, { onConflict: "city,country" });
    return { count: 0, errors };
  }

  const elements = osmData.elements || [];
  console.log(`[osm] Got ${elements.length} raw elements for ${city}`);

  // 2. Filter & deduplicate
  const seen = new Set<string>();
  const attractions: any[] = [];

  for (const el of elements) {
    const tags = el.tags || {};
    const name = tags["name:en"] || tags.name;
    if (!name || name.length < 3) continue;

    const dedup = `${name.toLowerCase()}-${el.type}`;
    if (seen.has(dedup)) continue;
    seen.add(dedup);

    const { category, subcategory } = categorizeOSM(tags);
    const lat = el.lat || el.center?.lat;
    const lon = el.lon || el.center?.lon;

    attractions.push({
      osm_id: el.id,
      osm_type: el.type,
      name,
      name_en: tags["name:en"] || null,
      city,
      country,
      latitude: lat,
      longitude: lon,
      category,
      subcategory,
      tags: [category, subcategory, ...(tags.tourism ? [tags.tourism] : []), ...(tags.historic ? [tags.historic] : [])].filter(Boolean),
      wikidata_id: tags.wikidata || "",
      wikipedia_url: tags.wikipedia ? `https://en.wikipedia.org/wiki/${tags.wikipedia.replace("en:", "")}` : "",
      popularity_score: computePopularity(tags),
      sync_source: "osm",
    });
  }

  console.log(`[osm] ${attractions.length} unique named attractions for ${city}`);

  // 3. Upsert into DB in batches
  let insertedCount = 0;
  const BATCH = 50;
  for (let i = 0; i < attractions.length; i += BATCH) {
    const batch = attractions.slice(i, i + BATCH);
    const { error } = await sb.from("attractions").upsert(batch, { onConflict: "osm_id,osm_type" });
    if (error) {
      errors.push(`Insert batch ${i}: ${error.message}`);
      console.error(`[osm] Insert error:`, error.message);
    } else {
      insertedCount += batch.length;
    }
  }

  // 4. Skip Wikipedia in sync phase (too slow) — done separately in enrich-wiki action

  // 5. Update sync state
  await sb.from("attraction_sync_state").upsert({
    city, country, status: "done",
    attraction_count: insertedCount,
    last_synced_at: new Date().toISOString(),
    error_message: errors.join("; ") || "",
    updated_at: new Date().toISOString(),
  }, { onConflict: "city,country" });

  return { count: insertedCount, errors };
}

// ── AI batch enrichment for attractions missing descriptions ──
async function enrichBatch(city: string, country: string, sb: any): Promise<number> {
  // Get attractions without descriptions
  const { data: unenriched } = await sb
    .from("attractions")
    .select("id, name, category, subcategory")
    .eq("city", city)
    .eq("country", country)
    .eq("ai_enriched", false)
    .or("description.eq.,description.is.null")
    .order("popularity_score", { ascending: false })
    .limit(40);

  if (!unenriched || unenriched.length === 0) return 0;

  // Build a single prompt for ALL attractions at once
  const attractionList = unenriched.map((a: any, i: number) =>
    `${i + 1}. "${a.name}" (${a.category}${a.subcategory ? `/${a.subcategory}` : ""})`
  ).join("\n");

  const prompt = `For ${city}, ${country}, provide brief descriptions (1-2 sentences), suggested visit duration, and best time to visit for each attraction. Return ONLY valid JSON array.

Attractions:
${attractionList}

Return format: [{"index":1,"description":"...","duration":"1-2 hours","best_time":"morning","tags":["outdoor","family-friendly"]}]`;

  try {
    const apiKey = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!apiKey) {
      console.warn("[enrich] No GOOGLE_AI_API_KEY, skipping AI enrichment");
      return 0;
    }

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
        }),
      }
    );

    if (!res.ok) { await res.text(); return 0; }
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Parse JSON from response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return 0;

    const enrichments = JSON.parse(jsonMatch[0]);
    let updated = 0;

    for (const e of enrichments) {
      const idx = (e.index || 0) - 1;
      if (idx < 0 || idx >= unenriched.length) continue;

      const attr = unenriched[idx];
      const { error } = await sb.from("attractions").update({
        description: (e.description || "").slice(0, 500),
        description_source: "ai",
        suggested_duration: e.duration || "",
        best_time_to_visit: e.best_time || "",
        itinerary_tags: e.tags || [],
        ai_enriched: true,
        enriched_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", attr.id);

      if (!error) updated++;
    }

    // Mark sync state as AI-enriched
    await sb.from("attraction_sync_state").upsert({
      city, country, ai_enriched_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }, { onConflict: "city,country" });

    console.log(`[enrich] AI enriched ${updated}/${unenriched.length} for ${city}`);
    return updated;
  } catch (e: any) {
    console.error(`[enrich] AI error for ${city}:`, e.message);
    return 0;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || "sync-batch";
    const sb = getSupabaseAdmin();

    // ── sync-init: Seed popular cities ──
    if (action === "sync-init") {
      let initialized = 0;
      for (let i = 0; i < POPULAR_CITIES.length; i++) {
        const c = POPULAR_CITIES[i];
        const { error } = await sb.from("attraction_sync_state").upsert({
          city: c.city,
          country: c.country,
          priority: c.priority,
          status: "pending",
          updated_at: new Date().toISOString(),
        }, { onConflict: "city,country" });
        if (!error) initialized++;
      }
      return new Response(JSON.stringify({ initialized, total: POPULAR_CITIES.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── sync-city: Sync a specific city (OSM only, fast) ──
    if (action === "sync-city") {
      const { city, country } = body;
      if (!city) return new Response(JSON.stringify({ error: "city required" }), { status: 400, headers: corsHeaders });
      const result = await syncCity(city, country || "", sb);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── enrich-wiki: Fetch Wikipedia descriptions for a city's attractions ──
    if (action === "enrich-wiki") {
      const { city, country } = body;
      if (!city) return new Response(JSON.stringify({ error: "city required" }), { status: 400, headers: corsHeaders });
      
      const { data: attrs } = await sb
        .from("attractions")
        .select("osm_id, osm_type, name, wikipedia_url, wikidata_id, popularity_score")
        .eq("city", city)
        .eq("description_source", "")
        .or("wikipedia_url.neq.,wikidata_id.neq.")
        .order("popularity_score", { ascending: false })
        .limit(20); // 20 max per call to stay within timeout

      let wikiCount = 0;
      for (const attr of (attrs || [])) {
        let wikiTitle = attr.name;
        if (attr.wikipedia_url) {
          const match = attr.wikipedia_url.match(/wiki\/(.+)$/);
          if (match) wikiTitle = decodeURIComponent(match[1].replace(/_/g, " "));
        }
        const wiki = await fetchWikipediaSummary(wikiTitle);
        if (wiki) {
          await sb.from("attractions").update({
            description: wiki.extract.slice(0, 500),
            description_source: "wikipedia",
            wikipedia_url: wiki.url || attr.wikipedia_url,
            updated_at: new Date().toISOString(),
          }).eq("osm_id", attr.osm_id).eq("osm_type", attr.osm_type);
          wikiCount++;
        }
        await new Promise(r => setTimeout(r, 150));
      }
      return new Response(JSON.stringify({ city, wikiEnriched: wikiCount, checked: attrs?.length || 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── sync-batch: Process next pending city (OSM only) ──
    if (action === "sync-batch") {
      const { data: next } = await sb
        .from("attraction_sync_state")
        .select("city, country, priority")
        .eq("status", "pending")
        .order("priority", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!next) {
        // All cities synced — check if any need AI enrichment
        const { data: needsEnrich } = await sb
          .from("attraction_sync_state")
          .select("city, country")
          .eq("status", "done")
          .is("ai_enriched_at", null)
          .order("priority", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (needsEnrich) {
          const enriched = await enrichBatch(needsEnrich.city, needsEnrich.country, sb);
          return new Response(JSON.stringify({ phase: "enrich", city: needsEnrich.city, enriched }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ message: "All cities synced and enriched" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const result = await syncCity(next.city, next.country, sb);
      return new Response(JSON.stringify({ city: next.city, ...result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── enrich-batch: Just AI enrich a city ──
    if (action === "enrich-batch") {
      const { city, country } = body;
      if (!city) return new Response(JSON.stringify({ error: "city required" }), { status: 400, headers: corsHeaders });
      const enriched = await enrichBatch(city, country || "", sb);
      return new Response(JSON.stringify({ city, enriched }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── search: Query our attractions DB ──
    if (action === "search") {
      const { query: searchQuery, city: searchCity, country: searchCountry, category, limit = 20 } = body;
      let q = sb.from("attractions").select("*").order("popularity_score", { ascending: false }).limit(limit);

      if (searchQuery) q = q.ilike("name", `%${searchQuery}%`);
      if (searchCity) q = q.ilike("city", `%${searchCity}%`);
      if (searchCountry) q = q.ilike("country", `%${searchCountry}%`);
      if (category) q = q.eq("category", category);

      const { data, error } = await q;
      if (error) throw error;

      // If no results found and searchCity provided, auto-trigger sync for this city
      if ((!data || data.length === 0) && searchCity) {
        // Bump priority for on-demand sync
        await sb.from("attraction_sync_state").upsert({
          city: searchCity,
          country: searchCountry || "",
          status: "pending",
          priority: 200, // User demand = highest priority
          updated_at: new Date().toISOString(),
        }, { onConflict: "city,country" });
      }

      return new Response(JSON.stringify({ results: data || [], count: data?.length || 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── sync-status: Get progress ──
    if (action === "sync-status") {
      const { data: states } = await sb
        .from("attraction_sync_state")
        .select("*")
        .order("priority", { ascending: false });

      const { count: totalAttractions } = await sb
        .from("attractions")
        .select("id", { count: "exact", head: true });

      const done = states?.filter((s: any) => s.status === "done").length || 0;
      const pending = states?.filter((s: any) => s.status === "pending").length || 0;
      const enriched = states?.filter((s: any) => s.ai_enriched_at).length || 0;

      return new Response(JSON.stringify({
        totalCities: states?.length || 0,
        done, pending, enriched,
        totalAttractions,
        cities: states,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: corsHeaders });
  } catch (e: any) {
    console.error("[osm-sync] Error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
