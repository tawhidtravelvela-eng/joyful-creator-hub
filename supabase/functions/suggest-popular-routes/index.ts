import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const CACHE_TTL_DAYS = 30; // Cache AI-suggested routes for 30 days

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { country, countryCode } = await req.json();

    if (!country) {
      return new Response(
        JSON.stringify({ success: false, error: "Country is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const cacheKey = `ai_suggested_${country.toLowerCase().replace(/\s+/g, "_")}`;

    // 1. Check DB cache first — return cached routes if fresh
    const { data: cached } = await sb
      .from("popular_routes")
      .select("*")
      .eq("from_city", cacheKey)
      .gte("last_searched_at", new Date(Date.now() - CACHE_TTL_DAYS * 86400000).toISOString())
      .limit(1);

    if (cached?.length) {
      // Fetch all AI-suggested routes for this country
      const { data: cachedRoutes } = await sb
        .from("popular_routes")
        .select("from_code, to_code, from_city, to_city, airline, duration, stops, lowest_price, currency")
        .like("from_city", `${cacheKey}_%`)
        .gt("lowest_price", 0)
        .order("search_count", { ascending: false })
        .limit(6);

      if (cachedRoutes?.length) {
        const routes = cachedRoutes.map((r: any) => ({
          ...r,
          from_city: r.from_city.replace(`${cacheKey}_`, ""), // Strip cache prefix
          search_count: 0,
          ai_suggested: true,
        }));
        return new Response(
          JSON.stringify({ success: true, routes, fromCache: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 2. No cache — call AI (cheapest model)
    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!GOOGLE_AI_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "GOOGLE_AI_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const prompt = `You are a flight travel expert. Generate the 6 most popular flight routes from ${country} (country code: ${countryCode || "unknown"}).

For each route provide:
- from_code: IATA airport code of the origin (main airport in ${country})
- to_code: IATA airport code of the destination
- from_city: city name of the origin
- to_city: city name of the destination  
- airline: 2-letter IATA airline code of the most common carrier on this route
- duration: estimated flight duration (e.g. "5h 30m")
- stops: number of stops (0 for non-stop)
- lowest_price: approximate lowest one-way fare in BDT (Bangladeshi Taka)

Focus on the most commonly searched routes from ${country} - a mix of domestic (if applicable) and international destinations. Use realistic current market prices in BDT.

Return ONLY a valid JSON object with this exact structure:
{"routes": [{"from_code":"...","to_code":"...","from_city":"...","to_city":"...","airline":"...","duration":"...","stops":0,"lowest_price":0}]}`;

    const url = `${GEMINI_BASE}/gemini-2.5-flash-lite:generateContent?key=${GOOGLE_AI_API_KEY}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1500,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini API error:", response.status, errText);
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: "Rate limited" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ success: false, error: "AI error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      console.error("No text in Gemini response:", JSON.stringify(data));
      return new Response(
        JSON.stringify({ success: false, error: "Invalid AI response" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const parsed = JSON.parse(text);
    const routes = (parsed.routes || []).slice(0, 6).map((r: any) => ({
      from_code: r.from_code,
      to_code: r.to_code,
      from_city: r.from_city,
      to_city: r.to_city,
      airline: r.airline,
      duration: r.duration,
      stops: r.stops ?? 0,
      lowest_price: r.lowest_price ?? 0,
      currency: "BDT",
      search_count: 0,
      ai_suggested: true,
    }));

    // 3. Cache routes in popular_routes table (fire and forget)
    if (routes.length > 0) {
      const now = new Date().toISOString();
      const cacheRows = routes.map((r: any, idx: number) => ({
        from_code: r.from_code,
        to_code: r.to_code,
        from_city: `${cacheKey}_${r.from_city}`, // Prefix to identify AI-suggested cache
        to_city: r.to_city,
        airline: r.airline,
        duration: r.duration,
        stops: r.stops,
        lowest_price: r.lowest_price,
        currency: r.currency,
        search_count: 100 - idx, // Preserve order
        last_searched_at: now,
      }));

      // Also insert a sentinel row to track cache freshness
      cacheRows.push({
        from_code: "---",
        to_code: "---",
        from_city: cacheKey,
        to_city: "cache_sentinel",
        airline: "",
        duration: "",
        stops: 0,
        lowest_price: 0,
        currency: "BDT",
        search_count: 0,
        last_searched_at: now,
      });

      sb.from("popular_routes")
        .upsert(cacheRows, { onConflict: "from_code,to_code" })
        .then(({ error }) => { if (error) console.error("Cache write error:", error); });
    }

    return new Response(
      JSON.stringify({ success: true, routes }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("suggest-popular-routes error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
