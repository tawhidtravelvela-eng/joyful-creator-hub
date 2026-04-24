import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

interface RouteIntel {
  origin: string;
  destination: string;
  cached_prices: { lowest_price: number; currency: string; cabin_class: string; source: string; travel_date: string }[];
  popular_routes: { from_code: string; to_code: string; from_city: string; to_city: string; airline: string; duration: string; stops: number; lowest_price: number }[];
  city_intro: any | null;
  route_tips: { flight_tip: string; best_months: string; avg_duration: string; common_airlines: string[]; travel_notes: string } | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { origin_city, destination_city, origin_code, destination_code } = await req.json();
    if (!origin_city && !origin_code) {
      return new Response(JSON.stringify({ success: false, error: "origin required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const result: RouteIntel = {
      origin: origin_city || origin_code || "",
      destination: destination_city || destination_code || "",
      cached_prices: [],
      popular_routes: [],
      city_intro: null,
      route_tips: null,
    };

    // 1. Fetch cached flight prices for this route
    if (origin_code && destination_code) {
      const { data: prices } = await sb
        .from("flight_price_cache")
        .select("lowest_price, currency, cabin_class, source, travel_date")
        .eq("from_code", origin_code)
        .eq("to_code", destination_code)
        .gt("lowest_price", 0)
        .gte("travel_date", new Date().toISOString().split("T")[0])
        .order("lowest_price", { ascending: true })
        .limit(5);
      if (prices?.length) result.cached_prices = prices;
    }

    // 2. Fetch popular routes involving these codes
    if (origin_code || destination_code) {
      let q = sb.from("popular_routes").select("*").gt("lowest_price", 0);
      if (origin_code && destination_code) {
        q = q.or(`from_code.eq.${origin_code},to_code.eq.${destination_code}`);
      } else if (origin_code) {
        q = q.eq("from_code", origin_code);
      } else {
        q = q.eq("to_code", destination_code);
      }
      const { data: routes } = await q.order("search_count", { ascending: false }).limit(6);
      if (routes?.length) result.popular_routes = routes;
    }

    // 3. Fetch city intro for destination (already cached)
    const destName = destination_city || destination_code || "";
    if (destName) {
      const { data: intro } = await sb
        .from("city_intros")
        .select("*")
        .eq("city_name", destName)
        .eq("language", "en")
        .maybeSingle();
      if (intro) result.city_intro = intro;
    }

    // 4. Route tips — check cache table first
    const routeKey = `${(origin_code || origin_city || "").toLowerCase()}_${(destination_code || destination_city || "").toLowerCase()}`;
    
    // Check if we have cached route tips in city_intros with a special format
    const { data: cachedTips } = await sb
      .from("city_intros")
      .select("budget_ranges")
      .eq("city_name", `route_${routeKey}`)
      .eq("language", "route_tips")
      .maybeSingle();

    if (cachedTips?.budget_ranges && typeof cachedTips.budget_ranges === "object") {
      result.route_tips = cachedTips.budget_ranges as any;
    } else {
      // Generate route tips with AI (one-time, then cached)
      const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
      if (GOOGLE_AI_API_KEY) {
        try {
          const fromLabel = origin_city || origin_code;
          const toLabel = destination_city || destination_code;
          const fromCode = origin_code || "";
          const toCode = destination_code || "";

          // Feed cached data context so AI can reference real numbers
          const priceContext = result.cached_prices.length
            ? `Known cached fares: ${result.cached_prices.map(p => `${p.currency} ${p.lowest_price} (${p.cabin_class}, ${p.source}, ${p.travel_date})`).join("; ")}.`
            : "";
          const routeContext = result.popular_routes.length
            ? `Popular route data: ${result.popular_routes.map(r => `${r.from_code}-${r.to_code} via ${r.airline}, ${r.duration}, ${r.stops} stops, ${r.lowest_price}`).join("; ")}.`
            : "";

          const prompt = `You are a senior aviation analyst who writes concise, data-driven route intelligence. Analyze the air route from ${fromLabel} (${fromCode}) to ${toLabel} (${toCode}).

${priceContext}
${routeContext}

STRICT RULES — ANY VIOLATION CAUSES IMMEDIATE REJECTION:
1. NEVER mention visas, passports, immigration, entry requirements, or customs. You do NOT know the traveler's nationality.
2. NEVER mention timezones, GMT offsets, UTC, or time differences.
3. NEVER mention currency exchange or money changing tips.
4. NEVER use filler phrases like "Direct flights are common" or "Check your terminal" — every word must add unique value.
5. Every claim must be specific and verifiable. Include airline names, terminal numbers, or route patterns.

QUALITY STANDARD — Each field must pass this test: "Would a frequent flyer on this exact route find this useful?"

Return ONLY valid JSON:
{
  "flight_tip": "One specific, actionable insight about THIS route that a frequent flyer would appreciate — e.g. which airline has the best schedule, a specific terminal tip, or a booking strategy. Must reference specific airlines or airports by name. (50 words max)",
  "best_months": "Best months to fly for deals with a brief reason, e.g. 'Jan-Mar (post-holiday lull), Sep-Nov (shoulder season)'",
  "avg_duration": "Average direct flight duration, e.g. '1h 25m'. If no direct flights, state shortest connection.",
  "common_airlines": ["Top 3 airlines on this route as 2-letter IATA codes — must be airlines that ACTUALLY operate this route"],
  "travel_notes": "One airport logistics insight: specific terminal info, transit tips between terminals, or connection patterns through specific hubs. Must name actual terminals, gates areas, or transit facilities. (40 words max). NO visa, timezone, or currency info."
}`;

          const url = `${GEMINI_BASE}/gemini-2.5-flash-lite:generateContent?key=${GOOGLE_AI_API_KEY}`;
          const aiRes = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.3, maxOutputTokens: 500, responseMimeType: "application/json" },
            }),
          });

          if (aiRes.ok) {
            const aiData = await aiRes.json();
            const text = aiData?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              const tips = JSON.parse(text);

              // Quality gate: reject generic filler tips
              const genericPatterns = /direct flights are common|check your.*terminal|varies by airline|book in advance|compare prices|plan ahead/i;
              if (genericPatterns.test(tips.flight_tip) || genericPatterns.test(tips.travel_notes)) {
                console.warn("Route tips failed quality gate, retrying not cached");
                // Still return them but don't cache — next request will regenerate
                result.route_tips = tips;
              } else {
                result.route_tips = tips;

                // Cache for future (store in city_intros with special key)
                await sb.from("city_intros").upsert({
                  city_name: `route_${routeKey}`,
                  language: "route_tips",
                  intro_text: tips.flight_tip || "",
                  budget_ranges: tips,
                  country: "",
                }, { onConflict: "city_name,language" }).select();
              }
            }
          }
        } catch (e) {
          console.error("AI route tips error:", e);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, intel: result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("route-intelligence error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
