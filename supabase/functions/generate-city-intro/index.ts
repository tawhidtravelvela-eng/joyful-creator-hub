import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

async function quickPriceEstimate(city: string, country: string, originCountry: string, apiKey: string) {
  const originClause = originCountry
    ? `The traveler is flying FROM ${originCountry}. Give a realistic round-trip economy flight price from ${originCountry} to ${city}.`
    : `Give a realistic round-trip economy flight price from the nearest major international hub.`;

  const prompt = `For the city "${city}"${country ? ` in ${country}` : ""}, provide realistic travel price estimates.
${originClause}
Return ONLY valid JSON:
{
  "avg_flight_price_usd": 250,
  "avg_hotel_per_night_usd": 45
}
avg_hotel_per_night_usd = average 3-star hotel per night in USD.`;

  const url = `${GEMINI_BASE}/gemini-2.5-flash-lite:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 200, responseMimeType: "application/json" },
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}

/** Check flight_price_cache and hotel_city_estimates for real data */
async function checkDbPrices(
  sb: any,
  city: string,
  destCode: string | null,
  originCodes: string[]
): Promise<{ flight: number | null; hotel: number | null }> {
  const result = { flight: null as number | null, hotel: null as number | null };

  // Hotel estimate from real search data
  try {
    const { data: hotelEst } = await sb
      .from("hotel_city_estimates")
      .select("avg_per_night_usd")
      .eq("city", city)
      .maybeSingle();
    if (hotelEst?.avg_per_night_usd > 0) {
      result.hotel = Math.round(hotelEst.avg_per_night_usd);
    }
  } catch {}

  // Flight estimate from real search data — prefer origin-aware
  if (destCode) {
    try {
      // Try origin-specific first
      if (originCodes.length > 0) {
        const { data: originFlights } = await sb
          .from("flight_price_cache")
          .select("lowest_price")
          .in("from_code", originCodes)
          .eq("to_code", destCode)
          .gt("lowest_price", 0)
          .gte("travel_date", new Date().toISOString().split("T")[0])
          .order("lowest_price", { ascending: true })
          .limit(1);
        if (originFlights?.length && originFlights[0].lowest_price > 0) {
          result.flight = Math.round(originFlights[0].lowest_price);
          return result; // Best case: origin-specific real price
        }
      }

      // Fallback: any origin
      const { data: anyFlights } = await sb
        .from("flight_price_cache")
        .select("lowest_price")
        .eq("to_code", destCode)
        .gt("lowest_price", 0)
        .gte("travel_date", new Date().toISOString().split("T")[0])
        .order("lowest_price", { ascending: true })
        .limit(1);
      if (anyFlights?.length && anyFlights[0].lowest_price > 0) {
        result.flight = Math.round(anyFlights[0].lowest_price);
      }
    } catch {}
  }

  return result;
}

const CITY_TO_IATA: Record<string, string> = {
  bali: "DPS", bangkok: "BKK", singapore: "SIN", dubai: "DXB",
  "kuala lumpur": "KUL", tokyo: "NRT", paris: "CDG", london: "LHR",
  istanbul: "IST", rome: "FCO", barcelona: "BCN", seoul: "ICN",
  kathmandu: "KTM", maldives: "MLE", "cox's bazar": "CXB",
  phuket: "HKT", mumbai: "BOM", delhi: "DEL", sydney: "SYD",
  "new york": "JFK", cancun: "CUN", miami: "MIA", cairo: "CAI",
  "hong kong": "HKG", taipei: "TPE", hanoi: "HAN", "ho chi minh": "SGN",
  colombo: "CMB", dhaka: "DAC", chittagong: "CGP", langkawi: "LGK",
  penang: "PEN", jakarta: "CGK", manila: "MNL", doha: "DOH",
  riyadh: "RUH", jeddah: "JED", muscat: "MCT", amman: "AMM",
  nairobi: "NBO", "cape town": "CPT", lagos: "LOS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { city, country, language, origin_codes, origin_country } = await req.json();
    if (!city) {
      return new Response(JSON.stringify({ success: false, error: "city is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lang = language || "en";
    const originCodes: string[] = Array.isArray(origin_codes) ? origin_codes : [];
    const originCountry: string = origin_country || "";
    const destCode = CITY_TO_IATA[city.toLowerCase()] || null;

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");

    // Check cache first
    const { data: cached } = await sb
      .from("city_intros")
      .select("*")
      .eq("city_name", city)
      .eq("language", lang)
      .maybeSingle();

    if (cached) {
      const br = (cached.budget_ranges || {}) as Record<string, unknown>;
      const hasPrices = br.avg_flight_price_usd && br.avg_hotel_per_night_usd;

      if (!hasPrices) {
        // Step 1: Check real DB data first (free, fast, accurate)
        const dbPrices = await checkDbPrices(sb, city, destCode, originCodes);

        const updatedBr = { ...br };
        let needsUpdate = false;

        if (dbPrices.hotel && !br.avg_hotel_per_night_usd) {
          updatedBr.avg_hotel_per_night_usd = dbPrices.hotel;
          needsUpdate = true;
        }
        if (dbPrices.flight && !br.avg_flight_price_usd) {
          updatedBr.avg_flight_price_usd = dbPrices.flight;
          needsUpdate = true;
        }

        // Step 2: Only call AI for remaining missing fields
        const stillMissingFlight = !updatedBr.avg_flight_price_usd;
        const stillMissingHotel = !updatedBr.avg_hotel_per_night_usd;

        if ((stillMissingFlight || stillMissingHotel) && GOOGLE_AI_API_KEY) {
          const prices = await quickPriceEstimate(city, cached.country || country || "", originCountry, GOOGLE_AI_API_KEY);
          if (prices) {
            if (stillMissingFlight && prices.avg_flight_price_usd) {
              updatedBr.avg_flight_price_usd = prices.avg_flight_price_usd;
              needsUpdate = true;
            }
            if (stillMissingHotel && prices.avg_hotel_per_night_usd) {
              updatedBr.avg_hotel_per_night_usd = prices.avg_hotel_per_night_usd;
              needsUpdate = true;
            }
          }
        }

        if (needsUpdate) {
          await sb
            .from("city_intros")
            .update({ budget_ranges: updatedBr, updated_at: new Date().toISOString() })
            .eq("id", cached.id);
          cached.budget_ranges = updatedBr;
        }
      }

      return new Response(JSON.stringify({ success: true, intro: cached, fromCache: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate with Gemini
    if (!GOOGLE_AI_API_KEY) {
      return new Response(JSON.stringify({ success: false, error: "AI key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check DB prices before generation too
    const dbPrices = await checkDbPrices(sb, city, destCode, originCodes);

    const originClause = originCountry
      ? `The traveler is flying FROM ${originCountry}. Give a realistic round-trip economy flight price from ${originCountry} to ${city}.`
      : `avg_flight_price_usd is a realistic round-trip economy flight price from the nearest major international hub.`;

    const prompt = `You are a travel content writer and pricing expert. Generate a city introduction for "${city}"${country ? ` in ${country}` : ""}.

Return ONLY valid JSON with this exact structure:
{
  "intro_text": "A compelling 2-3 sentence introduction about the city — what makes it special, its character, and why travelers love it.",
  "country": "Country name",
  "popular_areas": ["Area 1 — short description", "Area 2 — short description", "Area 3 — short description", "Area 4 — short description", "Area 5 — short description"],
  "best_time_to_visit": "Month range and brief reason, e.g. 'October to March — pleasant weather with temperatures around 20-30°C'",
  "budget_ranges": {
    "budget": {"min": 30, "max": 60, "currency": "USD", "note": "Hostels, street food, public transport"},
    "mid_range": {"min": 80, "max": 150, "currency": "USD", "note": "3-star hotels, restaurants, taxis"},
    "luxury": {"min": 200, "max": 500, "currency": "USD", "note": "5-star hotels, fine dining, private tours"},
    "avg_flight_price_usd": 250,
    "avg_hotel_per_night_usd": 45
  },
  "hero_image_query": "A search-friendly keyword for finding a beautiful photo of this city, e.g. 'paris eiffel tower skyline'"
}

Budget ranges should be per person per day in USD. ${originClause} avg_hotel_per_night_usd is average 3-star hotel per night. Make the intro vivid and enticing. Popular areas should be real neighborhoods, districts, or landmarks that travelers commonly visit.`;

    const url = `${GEMINI_BASE}/gemini-2.5-flash-lite:generateContent?key=${GOOGLE_AI_API_KEY}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 1500,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!response.ok) {
      console.error("Gemini error:", response.status, await response.text());
      return new Response(JSON.stringify({ success: false, error: "AI generation failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      return new Response(JSON.stringify({ success: false, error: "Empty AI response" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = JSON.parse(text);

    // Merge: DB real prices > AI estimates > top-level AI fields
    const budgetRanges = parsed.budget_ranges || {};
    if (parsed.avg_flight_price_usd && !budgetRanges.avg_flight_price_usd) {
      budgetRanges.avg_flight_price_usd = parsed.avg_flight_price_usd;
    }
    if (parsed.avg_hotel_per_night_usd && !budgetRanges.avg_hotel_per_night_usd) {
      budgetRanges.avg_hotel_per_night_usd = parsed.avg_hotel_per_night_usd;
    }
    // Real DB data always wins over AI estimates
    if (dbPrices.flight) budgetRanges.avg_flight_price_usd = dbPrices.flight;
    if (dbPrices.hotel) budgetRanges.avg_hotel_per_night_usd = dbPrices.hotel;

    // Try to find a hero image from Unsplash (free)
    let heroImageUrl = "";
    try {
      const imgQuery = parsed.hero_image_query || city;
      const unsplashRes = await fetch(
        `https://source.unsplash.com/800x400/?${encodeURIComponent(imgQuery)}`,
        { redirect: "follow" }
      );
      if (unsplashRes.ok) heroImageUrl = unsplashRes.url;
    } catch {}

    // Save to DB
    const introRow = {
      city_name: city,
      country: parsed.country || country || "",
      hero_image_url: heroImageUrl,
      intro_text: parsed.intro_text || "",
      popular_areas: parsed.popular_areas || [],
      best_time_to_visit: parsed.best_time_to_visit || "",
      budget_ranges: budgetRanges,
      language: lang,
    };

    const { data: inserted, error: insertErr } = await sb
      .from("city_intros")
      .upsert(introRow, { onConflict: "city_name,language" })
      .select()
      .single();

    if (insertErr) console.error("Insert error:", insertErr);

    return new Response(
      JSON.stringify({ success: true, intro: inserted || introRow, fromCache: false }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("generate-city-intro error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
