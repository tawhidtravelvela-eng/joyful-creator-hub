// Fast hotel & city autocomplete from tripjack_hotels catalogue (2M+ rows)
// Uses direct Postgres connection to bypass PostgREST statement_timeout

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function queryPostgres(sql: string, params: any[] = []): Promise<any[]> {
  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  if (!dbUrl) throw new Error("SUPABASE_DB_URL not set");
  
  // Use Supabase's built-in postgres connection
  const { default: postgres } = await import("https://deno.land/x/postgresjs@v3.4.5/mod.js");
  const sql_client = postgres(dbUrl, { max: 1 });
  
  try {
    const result = await sql_client.unsafe(sql, params);
    return result;
  } finally {
    await sql_client.end();
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, limit = 10 } = await req.json();

    if (!query || query.length < 2) {
      return new Response(
        JSON.stringify({ success: true, hotels: [], cities: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const searchTerm = query.trim();
    const t0 = Date.now();
    const cap = Math.min(limit, 15);

    // Split into words for multi-word matching
    const words = searchTerm.toLowerCase().split(/\s+/).filter((w: string) => w.length >= 2);
    const remainingWords = words.slice(1);

    // Use the longest word for best trigram selectivity
    const bestWord = words.reduce((a: string, b: string) => b.length > a.length ? b : a, words[0] || searchTerm);
    const fetchLimit = remainingWords.length > 0 ? 100 : cap;

    // Run hotel search via direct Postgres and city search via Supabase client in parallel
    const [allHotelsRaw, cities] = await Promise.all([
      queryPostgres(
        `SELECT tj_hotel_id, unica_id, name, city_name, country_name, rating, property_type, image_url
         FROM tripjack_hotels
         WHERE is_deleted = false AND name ILIKE '%' || $1 || '%'
         ORDER BY CASE WHEN lower(name) LIKE lower($1) || '%' THEN 0 ELSE 1 END, rating DESC NULLS LAST
         LIMIT $2`,
        [bestWord, fetchLimit]
      ),

      // Cities: from pre-aggregated city map (small table, Supabase client is fine)
      (async () => {
        const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        const { data } = await sb
          .from("tripjack_city_hotel_map")
          .select("city_name, country_name, hotel_count")
          .ilike("city_name", `%${words[0] || searchTerm}%`)
          .order("hotel_count", { ascending: false })
          .limit(5);
        return (data || []).map((c: any) => ({
          city_name: c.city_name || "",
          country_name: c.country_name || "",
          hotel_count: c.hotel_count || 0,
        }));
      })(),
    ]);

    let allHotels = allHotelsRaw as any[];

    // Client-side filter for multi-word matching
    if (words.length > 1) {
      allHotels = allHotels.filter((h: any) => {
        const combined = `${(h.name || "").toLowerCase()} ${(h.city_name || "").toLowerCase()}`;
        return words.every((w: string) => combined.includes(w));
      });
    }

    // Filter cities by remaining words
    let filteredCities = cities;
    if (remainingWords.length > 0) {
      filteredCities = cities.filter((c: any) => {
        const combined = `${c.city_name.toLowerCase()} ${c.country_name.toLowerCase()}`;
        return remainingWords.every((w: string) => combined.includes(w));
      });
    }

    console.log(`[search-hotels-catalogue] "${searchTerm}" -> ${allHotels.length} hotels, ${filteredCities.length} cities in ${Date.now() - t0}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        hotels: allHotels.slice(0, 10).map((h: any) => ({
          tj_hotel_id: h.tj_hotel_id,
          unica_id: h.unica_id,
          name: h.name,
          city_name: h.city_name,
          country_name: h.country_name,
          rating: h.rating,
          property_type: h.property_type,
          image_url: h.image_url,
        })),
        cities: filteredCities,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[search-hotels-catalogue] error:", e);
    return new Response(
      JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
