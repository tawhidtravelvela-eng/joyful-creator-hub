/**
 * AI Trip Generate V2 — AI-First Pipeline (Plain Text, 5-Tier Fallback)
 *
 * Cascade:
 *  1. Gemini 3 Flash — Lovable Gateway
 *  2. Gemini 3 Flash — Own Google AI key
 *  3. GPT-4.1 Mini   — Own OpenAI key
 *  4. Gemini 2.5 Flash — Lovable Gateway
 *  5. Gemini 2.5 Flash — Own Google AI key
 *
 * All tiers use plain-text responses for speed & token efficiency,
 * then parse JSON from the output.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// ── Progress broadcaster ──
function createProgressBroadcaster(progressId?: string) {
  if (!progressId) return { send: () => {}, cleanup: () => {} };
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return { send: () => {}, cleanup: () => {} };
  const sb = createClient(supabaseUrl, serviceKey);
  const channel = sb.channel(`trip-progress-${progressId}`);
  let subscribed = false;
  const init = channel.subscribe((status: string) => { if (status === "SUBSCRIBED") subscribed = true; });
  return {
    send: (step: number, label: string) => {
      if (!subscribed) return;
      channel.send({ type: "broadcast", event: "progress", payload: { step, label } })
        .catch(() => {});
      console.log(`[Progress] → step=${step} label="${label}"`);
    },
    cleanup: () => { try { sb.removeChannel(channel); } catch {} },
  };
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Providers ──

interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
}

interface Provider {
  name: string;
  call: (system: string, user: string) => Promise<{ text: string; truncated: boolean; usage?: TokenUsage }>;
}

// ── Token usage logger ──
async function logAiUsage(functionName: string, model: string, provider: string, usage: TokenUsage, durationMs: number, success: boolean): Promise<void> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) return;

    // Estimate cost based on model (per 1M tokens)
    const rates: Record<string, { input: number; output: number }> = {
      "gemini-3-flash": { input: 0.15, output: 0.60 },
      "gemini-2.5-flash": { input: 0.15, output: 0.60 },
      "gemini-2.5-flash-lite": { input: 0.075, output: 0.30 },
      "gpt-5-mini": { input: 0.40, output: 1.60 },
    };
    const modelKey = Object.keys(rates).find(k => model.includes(k)) || "";
    const rate = rates[modelKey] || { input: 0.15, output: 0.60 };
    const estimatedCost = (usage.input_tokens * rate.input + usage.output_tokens * rate.output) / 1_000_000;

    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.49.1");
    const sb = createClient(supabaseUrl, serviceKey);
    await sb.from("ai_usage_logs").insert({
      function_name: functionName,
      model,
      provider,
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      total_tokens: usage.total_tokens,
      estimated_cost: estimatedCost,
      duration_ms: durationMs,
      success,
      route_reason: "v2-pipeline",
    });
    console.log(`[V2-usage] ${functionName} ${model}: ${usage.input_tokens}in + ${usage.output_tokens}out = ${usage.total_tokens} tokens, ~$${estimatedCost.toFixed(6)}, ${durationMs}ms`);
  } catch (e) {
    console.warn("[V2-usage] Failed to log:", e);
  }
}

// Determine token budget based on trip complexity
let _maxTokens = 16000;
function setMaxTokens(n: number) { _maxTokens = n; }

function buildProviders(): Provider[] {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY") || "";
  const googleKey = Deno.env.get("GOOGLE_AI_API_KEY") || "";
  const openaiKey = Deno.env.get("OPENAI_API_KEY") || "";

  const LOVABLE_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
  const GOOGLE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

  // Helper: Lovable Gateway call
  const lovableCall = (model: string, apiKey: string) =>
    async (system: string, user: string): Promise<{ text: string; truncated: boolean; usage?: TokenUsage }> => {
      const res = await fetch(LOVABLE_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          max_tokens: _maxTokens,
          temperature: 0.7,
        }),
      });
      if (!res.ok) throw new Error(`Lovable ${model} ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content || "";
      const reason = data.choices?.[0]?.finish_reason || "";
      const truncated = reason === "length";
      if (truncated) console.warn(`[V2] ⚠️ Lovable ${model} TRUNCATED (finish_reason=length)`);
      const usage: TokenUsage = {
        input_tokens: data.usage?.prompt_tokens || 0,
        output_tokens: data.usage?.completion_tokens || 0,
        total_tokens: data.usage?.total_tokens || 0,
      };
      return { text, truncated, usage };
    };

  // Helper: Direct Google AI call
  const googleCall = (model: string, apiKey: string) =>
    async (system: string, user: string): Promise<{ text: string; truncated: boolean; usage?: TokenUsage }> => {
      const res = await fetch(`${GOOGLE_URL}/${model}:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: system }] },
          contents: [{ parts: [{ text: user }] }],
          generationConfig: { maxOutputTokens: _maxTokens, temperature: 0.7 },
        }),
      });
      if (!res.ok) throw new Error(`Google ${model} ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const reason = data.candidates?.[0]?.finishReason || "";
      const truncated = reason === "MAX_TOKENS";
      if (truncated) console.warn(`[V2] ⚠️ Google ${model} TRUNCATED (finishReason=MAX_TOKENS)`);
      const um = data.usageMetadata;
      const usage: TokenUsage = {
        input_tokens: um?.promptTokenCount || 0,
        output_tokens: um?.candidatesTokenCount || 0,
        total_tokens: um?.totalTokenCount || 0,
      };
      return { text, truncated, usage };
    };

  // Helper: Direct OpenAI call
  const openaiCall = (model: string, apiKey: string) =>
    async (system: string, user: string): Promise<{ text: string; truncated: boolean; usage?: TokenUsage }> => {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          max_tokens: _maxTokens,
          temperature: 0.7,
        }),
      });
      if (!res.ok) throw new Error(`OpenAI ${model} ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content || "";
      const reason = data.choices?.[0]?.finish_reason || "";
      const truncated = reason === "length";
      if (truncated) console.warn(`[V2] ⚠️ OpenAI ${model} TRUNCATED (finish_reason=length)`);
      const usage: TokenUsage = {
        input_tokens: data.usage?.prompt_tokens || 0,
        output_tokens: data.usage?.completion_tokens || 0,
        total_tokens: data.usage?.total_tokens || 0,
      };
      return { text, truncated, usage };
    };

  const providers: Provider[] = [];

  // Tier 1: Gemini 3 Flash — Lovable Gateway
  if (lovableKey) providers.push({ name: "gemini-3-flash (lovable)", call: lovableCall("google/gemini-3-flash-preview", lovableKey) });

  // Tier 2: Gemini 3 Flash — Own key
  if (googleKey) providers.push({ name: "gemini-3-flash (own)", call: googleCall("gemini-3-flash-preview", googleKey) });

  // Tier 3: GPT-4.1 Mini — Own key
  if (openaiKey) providers.push({ name: "gpt-4.1-mini (own)", call: openaiCall("gpt-4.1-mini", openaiKey) });

  // Tier 4: Gemini 2.5 Flash — Lovable Gateway
  if (lovableKey) providers.push({ name: "gemini-2.5-flash (lovable)", call: lovableCall("google/gemini-2.5-flash", lovableKey) });

  // Tier 5: Gemini 2.5 Flash — Own key
  if (googleKey) providers.push({ name: "gemini-2.5-flash (own)", call: googleCall("gemini-2.5-flash", googleKey) });

  return providers;
}

// ── Timing helper ──

function timer() {
  const start = performance.now();
  return {
    elapsed: () => Math.round(performance.now() - start),
    log: (label: string) => {
      const ms = Math.round(performance.now() - start);
      console.log(`[V2 TIMING] ${label}: ${ms}ms`);
      return ms;
    },
  };
}

// ── System prompt ──

function buildSystemPrompt(currency: string): string {
  return `You are TravelVela AI — an expert travel planner.

RULES:
1. Every activity must be a REAL, named place that exists. No generic fillers.
2. Free attractions (parks, streets, beaches, temples) → cost_estimate=0, is_free=true.
3. Paid activities: estimate cost in USD (per person). Use USD for ALL cost_estimate values — the backend will convert to the user's display currency automatically.
4. Time slots must be chronological (morning → evening).
5. For meals (breakfast/lunch/dinner), NEVER use specific restaurant names. Instead suggest the type of cuisine and area — e.g. "Dinner at a local hawker center near Marina Bay" or "Lunch at a seafood restaurant in Cenang Beach area". Show estimated cost as a rough range.
6. For multi-city trips, include travel days with realistic transit times.
7. Respect the user's exact city/night allocation.
8. Honor ALL must-visit items — missing one is a CRITICAL FAILURE.
9. Include booking notes for Express Passes, Cable Cars, etc.
10. Pace realistically — account for travel between attractions and traveler composition.
11. Plan appropriately for the traveler group — if infants or seniors are present, choose suitable activities and realistic pacing naturally. Do NOT add extreme/dangerous activities for groups with infants or elderly.
12. Name activities clearly — use the attraction's well-known name including any user-requested ticket variant in parentheses (e.g., "Universal Studios Singapore (Express Pass)", "Langkawi SkyCab Cable Car and Sky Bridge"). The activity name is used directly for product matching.

INTER-CITY TRANSPORT PREFERENCE:
Always prefer FLIGHTS over ground transport (bus, ferry, train) for inter-city travel when:
- A flight route exists between the two cities (even if indirect)
- The ground alternative would take 3+ hours
- Both cities have airports
Only suggest ground transport (ferry, bus, train) when:
- No airport exists at either end (e.g., small islands without airports)
- The ground journey is under 2 hours AND significantly cheaper (e.g., KL↔Genting by road)
- The user explicitly requests ground transport
For example:
  ✅ Langkawi → Penang: suggest FLIGHT (even though ferry exists — flight is 35min vs 3h ferry)
  ✅ Singapore → Langkawi: FLIGHT (no direct ground option)
  ✅ Penang → KL: FLIGHT (1h vs 4h+ bus)
  ❌ KL → Genting Highlands: ROAD (no airport at Genting, only 1h drive)
  ❌ Hotel → Airport: ROAD transfer (not inter-city)
In travel_connections, set mode="flight" for all inter-city legs where flights are viable.
12. Use the departure date to set each day's date.

CRITICAL — Day Title Rule:
Each day MUST have a smart, descriptive "title" that captures the day's theme/highlight.
The title should be SHORT (3-6 words), evocative, and unique per day.
Rules:
- Lead with the day's PRIMARY highlight or landmark name
- Add the emotional/thematic context
- Travel days: mention both cities
- Arrival/departure: mention the transition
Examples:
  ✅ "Marina Bay & Gardens Magic"
  ✅ "Sentosa Island Adventure Day"
  ✅ "Fly to Langkawi"
  ✅ "Highland Thrills at Genting"
  ✅ "Heritage Walk in Georgetown"
  ✅ "Arrival & First Impressions"
  ✅ "KL Icons & Batu Caves"
  ✅ "Farewell Shopping & Departure"
  ❌ "Day 1" (too generic)
  ❌ "Sightseeing" (meaningless)
  ❌ "Activities in Singapore" (lazy)
  ❌ "Explore the City" (vague filler)

CRITICAL — Activity Classification Rule (BOOKABLE vs NON-BOOKABLE):
Every activity MUST have "is_bookable": true or false.
Set is_bookable=TRUE ONLY for activities that are REAL PAID PRODUCTS a tourist can purchase on a booking site:
  ✅ Theme parks, museums, observation decks, guided tours, day trips, cable cars, zoos, aquariums, butterfly farms, cooking classes, boat cruises, shows, adventure activities, spa/wellness, city tours
  ❌ Walking around a neighborhood, visiting a free park, eating at a restaurant, shopping, beach lounging, strolling a night market, checking into a hotel, airport transfer

CRITICAL — Activity Naming Rule:
For is_bookable=TRUE activities: Name EXACTLY as a travel booking site would list it, so it is directly searchable on tour platforms like Viator/GetYourGuide.
For is_bookable=FALSE activities: Use simple, natural names (e.g., "Merlion Park", "Chinatown Walk", "Cenang Beach").
NEVER use booking-style titles for free/non-bookable activities.

Include the CITY NAME and any specific VARIANT or OPTION in the title itself for bookable activities.

ZONE-AWARE NAMING (bookable activities only):
Only combine attractions into ONE activity title when they are genuinely sold as a SINGLE tour package or ticket bundle.
  ✅ "Genting Highlands Day Trip with SkyWorlds Theme Park and Cable Car" (sold as one day trip package)
  ✅ "Langkawi SkyCab Cable Car and Sky Bridge" (cable car + bridge sold as one ticket)
  ✅ "Penang Hill Guided Tour with Kek Lok Si Temple and Habitat" (sold as one guided tour)
  ✅ "Putrajaya Day Tour from Kuala Lumpur with Lake Cruise and Mosque Visit" (sold as one tour)
NEVER combine attractions that are sold as SEPARATE tickets, even if they are in the same zone/island:
  ❌ "Sentosa Island Cable Car Sky Pass with Universal Studios Singapore" (SEPARATE tickets!)
  ✅ Instead, list as TWO separate activities:
     - "Sentosa Island Cable Car Sky Pass" (is_bookable=true)
     - "Universal Studios Singapore (Express Pass)" (is_bookable=true)
  ❌ "Gardens by the Bay with ArtScience Museum" (separate tickets!)
  ✅ List separately: "Gardens by the Bay Singapore" + "ArtScience Museum Singapore"
Rule of thumb: If a tourist must buy TWO separate tickets, they MUST be TWO separate activities.

STANDALONE NAMING (bookable activities only):
For single-attraction paid activities, use the product's real booking title:
  ✅ "Universal Studios Singapore (Express Pass)" → is_bookable=true
  ✅ "Gardens by the Bay Singapore" → is_bookable=true
  ✅ "Aquaria KLCC" → is_bookable=true
  ✅ "Entopia Butterfly Farm Penang" → is_bookable=true
  ✅ "Zoo Negara Kuala Lumpur" → is_bookable=true

CRITICAL — search_title RULE:
For EVERY is_bookable=TRUE activity, you MUST include a "search_title" field.
The search_title is a booking-platform-optimized search string — how you'd search for this product on Viator/GetYourGuide.
Rules:
  1. ALWAYS include the CITY NAME in search_title
  2. ALWAYS include the ATTRACTION NAME
  3. Add "Ticket", "Admission", "Tour", "Pass", or "Day Trip" as appropriate
  4. Include ticket variants if user requested (e.g., "Express Pass", "Skip the Line")
  5. search_title must be 5-12 words — specific enough to find the exact product
Examples:
  activity: "Gardens by the Bay Singapore"           → search_title: "Gardens by the Bay Singapore Admission Ticket"
  activity: "Aquaria KLCC"                           → search_title: "Aquaria KLCC Kuala Lumpur Admission Ticket"
  activity: "ArtScience Museum Singapore"            → search_title: "ArtScience Museum Singapore Admission Ticket"
  activity: "Universal Studios Singapore (Express)"  → search_title: "Universal Studios Singapore Express Pass Ticket"
  activity: "Sentosa Island Cable Car"               → search_title: "Singapore Cable Car Sky Pass Sentosa Ticket"
  activity: "Penang Hill Guided Tour"                → search_title: "Penang Hill Funicular Train Guided Tour"
  activity: "Batu Caves Tour"                        → search_title: "Batu Caves Tour from Kuala Lumpur"
  activity: "Zoo Negara Kuala Lumpur"                → search_title: "Zoo Negara Kuala Lumpur Admission Ticket"
  activity: "Langkawi SkyCab and Sky Bridge"         → search_title: "Langkawi SkyCab Cable Car and Sky Bridge Ticket"
  activity: "Genting SkyWorlds Theme Park"           → search_title: "Genting SkyWorlds Theme Park Admission Ticket"
Do NOT include search_title for is_bookable=FALSE activities.

ACTIVITY NAMING RULE:
Name each activity using the attraction's well-known name. Include the city name for clarity.
If the user requested a specific ticket variant, include it in parentheses.
Examples:
  "Universal Studios Singapore (Express Pass)"
  "Gardens by the Bay Singapore"
  "Langkawi SkyCab Cable Car and Sky Bridge"
  "Zoo Negara Kuala Lumpur"
  "Genting SkyWorlds Theme Park"
  "Penang Hill Guided Tour"
OPTION VARIANT RULE — When the user explicitly requests a specific ticket variant or upgrade, you MUST include it in parentheses in the activity title:
  ✅ "Universal Studios Singapore (Express Pass)" — user asked for express pass
  ✅ "Colosseum Rome (Skip the Line)" — user asked for skip the line
  ✅ "Langkawi SkyCab Cable Car (Round Trip)" — user asked for round trip
  ✅ "Gardens by the Bay Singapore (Flower Dome + Cloud Forest)" — user asked for specific domes
  ✅ "Genting SkyWorlds Theme Park (All Day Pass)" — user asked for all day
Common option variants to preserve: Express Pass, Skip the Line, Fast Track, VIP, Combo, Round Trip, One Way, All Day Pass, Night Tour, Sunset, Private, Group, Family Pass.
If the user does NOT mention a specific variant, do NOT add one — use the base product name.

BAD NAMES — NEVER USE for bookable activities:
  ❌ "Visit Universal Studios" (too vague)
  ❌ "Cable Car Ride" (missing city and product name)
  ❌ "Theme Park" (generic)
  ❌ "Genting Highlands" (zone name only — what product?)
  ❌ "Day Trip" (meaningless without destination)
For non-bookable activities, simple names are fine: "Merlion Park", "Chinatown", "Bukit Bintang".

HOTEL SUGGESTION RULE:
For each city, include "preferred_hotel" in the city object and a "hotel_area" (neighborhood).
CRITICAL — PREFERRED HOTEL OVERRIDE:
If the user specifies a hotel name for a city, you MUST use EXACTLY that hotel name as the "preferred_hotel" value. Do NOT substitute, upgrade, or change it to a different property.
  ✅ User says "Batu Ferringi Resorts" → preferred_hotel: "Batu Ferringi Resorts"
  ✅ User says "KLCC View Suites" → preferred_hotel: "KLCC View Suites"
  ❌ User says "Batu Ferringi Resorts" → preferred_hotel: "Shangri-La Rasa Sayang" (WRONG — never override user choice!)
If the user does NOT specify a hotel, suggest a real hotel that fits their budget/style.
Examples:
  ✅ {"name":"Singapore","preferred_hotel":"Marina Bay Sands","hotel_area":"Marina Bay","nights":3}
  ✅ {"name":"Langkawi","preferred_hotel":"The Datai Langkawi","hotel_area":"Datai Bay","nights":2}
If budget is limited, suggest mid-range 3-4 star hotels. If luxury, suggest 5-star properties.

SELF-MANAGED NIGHTS RULE:
If a city has "self-managed" nights, include "self_managed_nights" in the city object.
These nights need NO hotel booking — the user has their own accommodation.
Example: {"name":"Kuala Lumpur","nights":6,"self_managed_nights":4,"preferred_hotel":"KLCC View Suites","hotel_area":"KLCC"}
This means: 6 total nights, only 2 need hotel booking, 4 are self-arranged.

RESPOND WITH A SINGLE VALID JSON OBJECT (no markdown fences, no extra text) with this structure:
{
  "trip_title": "string",
  "destination": "comma-separated cities",
  "duration_days": number,
  "cities": [{"name":"string","country":"string","nights":number,"days":number,"preferred_hotel":"string","hotel_area":"string"}],
  "days": [{"day":number,"date":"YYYY-MM-DD","city":"string","title":"string (SMART title, 3-6 words, unique per day)","is_travel_day":boolean,"activities":[{"time":"HH:MM","activity":"string","search_title":"string (REQUIRED for is_bookable=true ONLY — booking-site-style search query, e.g. 'Gardens by the Bay Singapore Admission Ticket'. Include city name + attraction + ticket/tour type. Omit for free/non-bookable.)","description":"string","duration_hours":number,"cost_estimate":number,"category":"activity|food|transport|free","is_free":boolean,"is_bookable":boolean,"booking_notes":"string","tips":"string"}]}],
  "travel_connections": [{"from_city":"string","to_city":"string","day":number,"mode":"flight|bus|ferry|train","estimated_duration":"string","notes":"string"}],
  "tips": ["string"],
  "best_time_to_visit": "string",
  "assumptions": ["string"],
  "packing_suggestions": ["string"]
}`;
}

// ── Build user message ──

function buildUserMessage(rawRequest: string, params: any): string {
  const parts: string[] = [];

  // If cities array exists, build a structured trip description from it
  // This is the primary source of truth for multi-city trips
  // ── Canonical duration helpers ──
  const getCityNights = (city: any): number => {
    const n = Number(city?.nights);
    if (Number.isFinite(n) && n > 0) return n;
    const d = Number(city?.days);
    if (Number.isFinite(d) && d > 1) return d - 1;
    return 2;
  };

  if (params?.cities && Array.isArray(params.cities) && params.cities.length > 0) {
    const totalNights = params.cities.reduce((sum: number, c: any) => sum + getCityNights(c), 0);
    const totalDays = totalNights + 1;

    // Parse departure date for calendar-aware prompting
    const departDateStr = params.depart_date || params.startDate;
    let departDateObj: Date | null = null;
    if (departDateStr) {
      try { departDateObj = new Date(departDateStr); } catch {}
    }

    // Compute per-city day ranges — each city gets nights+1 days of content.
    // Transition days (last day of city N = first day of city N+1) are on the same calendar day.
    // The AI decides which city owns the transition day based on context.
    const dayRanges: { name: string; startDay: number; endDay: number; dayDetails: string[] }[] = [];
    const interCityFlights: { from: string; to: string; day: number; date: string }[] = [];
    let dayCursor = 1;
    const numCities = params.cities.length;
    for (let ci = 0; ci < numCities; ci++) {
      const c = params.cities[ci];
      const nights = getCityNights(c);
      const isFirst = ci === 0;
      const isLast = ci === numCities - 1;
      const startDay = dayCursor;
      const endDay = startDay + nights; // nights+1 days inclusive

      // Build per-day type annotations with actual dates
      const dayDetails: string[] = [];
      for (let d = startDay; d <= endDay; d++) {
        let dtype: string;
        let dateLabel = "";
        if (departDateObj) {
          const dayDate = new Date(departDateObj);
          dayDate.setDate(dayDate.getDate() + d - 1);
          dateLabel = ` (${dayDate.toISOString().split("T")[0]})`;
        }

        if (d === startDay && isFirst) {
          dtype = "arrival — settle in, light activities after check-in";
        } else if (d === startDay && !isFirst) {
          const prevCity = params.cities[ci - 1]?.name || "previous city";
          dtype = `arrival/transition — TRAVEL DAY from ${prevCity} to ${c.name}. Morning: depart ${prevCity}. Afternoon/evening: arrive ${c.name}, check in, optional light activities. Set city="${c.name}", is_travel_day=true.`;
          // Track inter-city flight
          if (departDateObj) {
            const flightDate = new Date(departDateObj);
            flightDate.setDate(flightDate.getDate() + d - 1);
            interCityFlights.push({ from: prevCity, to: c.name, day: d, date: flightDate.toISOString().split("T")[0] });
          }
        } else if (d === endDay && isLast) {
          dtype = "departure — light activities if time permits, then airport transfer";
        } else if (d === endDay && !isLast) {
          // Last day of this city — this is the SAME calendar day as the next city's first day
          // The AI should assign this to the NEXT city as a transition/arrival day
          continue; // Skip — the next city's startDay will cover this calendar day
        } else {
          dtype = "full day — plan activities as needed";
        }
        dayDetails.push(`Day ${d}${dateLabel}: ${dtype}`);
      }

      dayRanges.push({ name: c.name, startDay, endDay, dayDetails });
      dayCursor = endDay; // next city shares this day
    }

    const cityDescriptions = params.cities.map((c: any, ci: number) => {
      const range = dayRanges[ci];
      let desc = `• ${c.name} (${c.country || ""}): ${nights} nights — Day ${range.startDay} to Day ${range.endDay}`;
      desc += `\n  Day schedule:\n    ${range.dayDetails.join("\n    ")}`;
      if (c.preferred_hotel) desc += `\n  ⚠️ REQUIRED HOTEL (do NOT change): "${c.preferred_hotel}"`;
      if (c.self_managed_nights > 0) {
        const paidNights = nights - (c.self_managed_nights || 0);
        desc += `\n  Self-managed: ${c.self_managed_nights} nights (only ${paidNights} nights need hotel booking)`;
        desc += `\n  Include "self_managed_nights": ${c.self_managed_nights} in the city object`;
      }
      if (c.must_visit && c.must_visit.length > 0) {
        desc += `\n  Must-visit: ${c.must_visit.join(", ")}`;
      }
      return desc;
    }).join("\n");

    // Set dynamic max_tokens based on trip size
    const tokenBudget = totalDays >= 10 ? 24000 : totalDays >= 7 ? 20000 : 16000;
    setMaxTokens(tokenBudget);

    parts.push(`MULTI-CITY TRIP PLAN (${params.cities.length} cities, ${totalNights} nights, ${totalDays} days total):`);
    parts.push(`\nCITIES IN ORDER (with day ranges, dates, and day types):\n${cityDescriptions}`);

    // Add explicit inter-city flight schedule
    if (interCityFlights.length > 0) {
      const flightSchedule = interCityFlights.map(f =>
        `  ✈️ Day ${f.day} (${f.date}): ${f.from} → ${f.to}`
      ).join("\n");
      parts.push(`\nINTER-CITY FLIGHT SCHEDULE (use these exact days/dates for travel_connections):\n${flightSchedule}
TRANSITION DAY RULES (CRITICAL — EXCLUSIVE MODEL):
1. Each city EXCLUSIVELY owns ALL its days (NxD = nights+1 days). No shared days.
2. The FIRST day of each new city is the arrival/transition day. The "city" field = the ARRIVAL city.
3. MANDATORY SEQUENCE on arrival/transition days:
   a) Flight/transport from previous city (set is_travel_day=true, category="transport")
   b) Transfer to hotel in arrival city
   c) Hotel check-in
   d) OPTIONAL: 1-2 light, nearby activities ONLY if arriving before 15:00
4. NEVER schedule full-day tours, theme parks, or long-distance attractions on transition days.
5. ALWAYS use "flight" as transport mode between cities with airports. Do NOT invent ferry/speedboat/train unless explicitly requested by user or no airports exist.`);
    }

    parts.push(`\nDAY TYPE RULES:
- arrival: First day — activities after settling in, pace naturally based on arrival time
- transition: Travel/arrival day — city = arrival city. Light activities AFTER check-in if time permits.
- full: Full exploration — plan as many activities as fit naturally for the traveler group
- departure: Last day of a city — can have morning activities before heading to airport. For the FINAL city, this is the trip departure day.
NO HARD ACTIVITY COUNT LIMITS. Plan based on traveler composition (adults, children, infants), available time windows, and natural pacing. The AI already knows the group — trust it to pace appropriately.
CRITICAL: Your "days" array MUST have exactly ${totalDays} entries (day 1 through day ${totalDays}). Generate ALL ${totalDays} days. Each day MUST have "day" number, "date" (YYYY-MM-DD), "city", "title", and "activities". On transition days, set is_travel_day=true and include the transport as the FIRST activity.`);
  } else if (rawRequest) {
    parts.push(`Here are my trip requirements:\n\n${rawRequest}`);
  } else {
    parts.push(`Plan a trip to ${params?.destination_city || "unknown destination"}`);
  }

  if (params) {
    if (params.adults || params.children || params.infants) {
      parts.push(`\nTravelers: ${params.adults || 1} adults${params.children ? `, ${params.children} children` : ""}${params.infants ? `, ${params.infants} infants` : ""}`);
    }
    if (params.depart_date) parts.push(`Departure date: ${params.depart_date}`);
    if (params.return_date) parts.push(`Return date: ${params.return_date}`);
    if (params.origin_city) parts.push(`From: ${params.origin_city}`);
    if (params.cabin_class) parts.push(`Cabin: ${params.cabin_class}`);
    if (params.prefer_direct) parts.push(`Preference: Direct flights`);
    if (params.travel_style) parts.push(`Style: ${params.travel_style}`);
    if (params.budget_max) parts.push(`Budget: ${params.budget_currency || "USD"} ${params.budget_min || 0} - ${params.budget_max}`);
    if (params.hotel_stars) parts.push(`Hotel preference: ${params.hotel_stars} stars`);
    if (params.budget_per_night) parts.push(`Hotel budget: ~${params.budget_currency || "USD"} ${params.budget_per_night} per night`);

    // Include special notes (option requirements like Express Pass, Cable Car, etc.)
    if (params.user_special_notes && Array.isArray(params.user_special_notes) && params.user_special_notes.length > 0) {
      parts.push(`\nSpecial requirements: ${params.user_special_notes.join(", ")}`);
    }
  }
  parts.push(`\nGenerate a complete day-by-day itinerary. Include every attraction I mentioned and respect the exact night allocation per city. Suggest specific, real hotel names for each city.`);
  return parts.join("\n");
}

// ── JSON parsing & recovery ──

function parseJsonFromText(text: string): any | null {
  if (!text) return null;
  const trimmed = text.trim();

  // Try direct parse
  try { return JSON.parse(trimmed); } catch {}

  // Try fenced JSON blocks
  const fenced = [...trimmed.matchAll(/```(?:json)?\s*([\s\S]*?)\s*```/gi)];
  for (const m of fenced) {
    try { const p = JSON.parse(m[1].trim()); if (p && typeof p === "object") return p; } catch {}
  }

  // Extract from first { to last }
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first !== -1 && last > first) {
    try { return JSON.parse(trimmed.slice(first, last + 1)); } catch {}
  }

  // Truncation recovery
  if (first !== -1) return recoverTruncatedJson(trimmed.slice(first));
  return null;
}

function recoverTruncatedJson(text: string): any | null {
  if (!text) return null;
  let candidate = text.trim();
  try { return JSON.parse(candidate); } catch {}

  let braces = 0, brackets = 0, inString = false, escape = false;
  for (const ch of candidate) {
    if (escape) { escape = false; continue; }
    if (ch === "\\") { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{") braces++; else if (ch === "}") braces--;
    else if (ch === "[") brackets++; else if (ch === "]") brackets--;
  }

  if (braces > 0 || brackets > 0) {
    candidate = candidate.replace(/,\s*"[^"]*"?\s*:?\s*[^,}\]]*$/, "");
    candidate = candidate.replace(/,\s*\{[^}]*$/, "");
    candidate = candidate.replace(/,\s*"[^"]*$/, "");
    for (let i = 0; i < brackets; i++) candidate += "]";
    for (let i = 0; i < braces; i++) candidate += "}";
    try {
      const p = JSON.parse(candidate);
      console.log(`[V2] Recovered truncated JSON`);
      return p;
    } catch {}
  }
  return null;
}

// ── Cascade caller ──

async function callWithFallback(providers: Provider[], system: string, user: string): Promise<{ content: string; provider: string; truncated: boolean; usage?: TokenUsage }> {
  for (let i = 0; i < providers.length; i++) {
    const p = providers[i];
    try {
      console.log(`[V2] 📤 Tier ${i + 1}: ${p.name}...`);
      const startMs = Date.now();
      const result = await p.call(system, user);
      const durationMs = Date.now() - startMs;
      if (!result.text || result.text.length < 100) throw new Error("Empty or too-short response");
      console.log(`[V2] ✅ Tier ${i + 1} (${p.name}) succeeded — ${result.text.length} chars${result.truncated ? " ⚠️ TRUNCATED" : ""}`);
      // Log token usage
      if (result.usage && result.usage.total_tokens > 0) {
        const providerName = p.name.includes("lovable") ? "lovable" : p.name.includes("own") ? "google" : "openai";
        const modelName = p.name.replace(/ \(.*\)/, "");
        logAiUsage("ai-trip-generate-v2", modelName, providerName, result.usage, durationMs, true);
      }
      return { content: result.text, provider: p.name, truncated: result.truncated, usage: result.usage };
    } catch (err: any) {
      console.warn(`[V2] ⚠️ Tier ${i + 1} (${p.name}) failed: ${err.message}`);
      if (err.message.includes("402")) throw err;
    }
  }
  throw new Error("All AI providers failed");
}

// ── Deterministic Calendar Normalization (ported from V1) ──

const KNOWN_COUNTRIES: Record<string, string> = {
  "singapore": "Singapore", "kuala lumpur": "Malaysia", "langkawi": "Malaysia",
  "penang": "Malaysia", "malacca": "Malaysia", "johor bahru": "Malaysia",
  "kota kinabalu": "Malaysia", "kuching": "Malaysia", "ipoh": "Malaysia",
  "bangkok": "Thailand", "phuket": "Thailand", "chiang mai": "Thailand",
  "pattaya": "Thailand", "krabi": "Thailand", "bali": "Indonesia",
  "jakarta": "Indonesia", "yogyakarta": "Indonesia", "hanoi": "Vietnam",
  "ho chi minh": "Vietnam", "da nang": "Vietnam", "manila": "Philippines",
  "cebu": "Philippines", "tokyo": "Japan", "osaka": "Japan", "kyoto": "Japan",
  "seoul": "South Korea", "busan": "South Korea", "hong kong": "Hong Kong",
  "macau": "Macau", "taipei": "Taiwan", "dubai": "UAE", "abu dhabi": "UAE",
  "doha": "Qatar", "muscat": "Oman", "jeddah": "Saudi Arabia",
  "riyadh": "Saudi Arabia", "istanbul": "Turkey", "london": "UK",
  "paris": "France", "rome": "Italy", "barcelona": "Spain", "amsterdam": "Netherlands",
  "dhaka": "Bangladesh", "chittagong": "Bangladesh", "cox's bazar": "Bangladesh",
  "mumbai": "India", "delhi": "India", "kolkata": "India", "chennai": "India",
  "goa": "India", "jaipur": "India", "colombo": "Sri Lanka", "maldives": "Maldives",
  "male": "Maldives", "kathmandu": "Nepal", "new york": "USA", "los angeles": "USA",
  "sydney": "Australia", "melbourne": "Australia",
};

function normalizeCalendar(aiPlan: any, params: any): void {
  const cities = aiPlan.cities;
  if (!Array.isArray(cities) || cities.length === 0) return;

  // ── 1. Normalize per-city nights/days ──
  // Use params.cities (user input) as source of truth if available
  const userCities = Array.isArray(params?.cities) ? params.cities : [];

  for (const city of cities) {
    // Try to find matching user city for authoritative nights
    const userCity = userCities.find((uc: any) =>
      (uc.name || "").toLowerCase() === (city.name || "").toLowerCase()
    );

    const userNights = Number(userCity?.nights || 0);
    const userDays = Number(userCity?.days || 0);

    if (userNights > 0 || userDays > 0) {
      city.nights = userNights > 0 ? userNights : Math.max(userDays - 1, 1);
      city.days = userDays > 0 ? userDays : city.nights + 1;
      console.log(`[V2-norm] ${city.name}: user-specified nights=${city.nights}, days=${city.days}`);
    } else if (city.nights && !city.days) {
      city.days = city.nights + 1;
    } else if (city.days && !city.nights) {
      city.nights = Math.max(city.days - 1, 1); // derive nights from inclusive days
      city.days = city.nights + 1;
    } else if (!city.nights && !city.days) {
      city.nights = 2;
      city.days = 3;
    }

    // Ensure days >= nights + 1
    if (city.days <= city.nights) city.days = city.nights + 1;

    // Auto-detect country
    if (!city.country) {
      const found = KNOWN_COUNTRIES[(city.name || "").toLowerCase()];
      if (found) city.country = found;
    }
  }

  // ── 2. Override duration_days = totalNights + 1 ──
  const totalNights = cities.reduce((s: number, c: any) => s + Number(c.nights || 1), 0);
  const correctDuration = totalNights + 1;

  if (aiPlan.duration_days !== correctDuration) {
    console.log(`[V2-norm] Duration override: AI=${aiPlan.duration_days} → ${correctDuration} (${totalNights} nights + 1)`);
    aiPlan.duration_days = correctDuration;
  }

  // ── 3. Assign day_type to AI days & fix city assignment ──
  // Each city has a range of startDay to endDay (nights+1 days).
  // Transition days overlap: last day of city A = first day of city B.
  // We trust the AI's city assignment and only correct if clearly wrong.
  const cityRanges: { name: string; startDay: number; endDay: number }[] = [];
  let cursor = 1;
  for (let ci = 0; ci < cities.length; ci++) {
    const c = cities[ci];
    const startDay = cursor;
    const endDay = startDay + (c.nights || 1); // nights+1 days
    cityRanges.push({ name: c.name, startDay, endDay });
    cursor = endDay; // next city starts at this city's last day (same calendar day)
  }
  // Ensure last city covers up to correctDuration
  if (cityRanges.length > 0) {
    const lastRange = cityRanges[cityRanges.length - 1];
    if (lastRange.endDay < correctDuration) {
      lastRange.endDay = correctDuration;
    }
  }

  console.log(`[V2-norm] City ranges: ${cityRanges.map(r => `${r.name} D${r.startDay}-${r.endDay}`).join(", ")}`);

  // Assign day_type and fix city on each AI-generated day
  const days = aiPlan.days || [];
  for (let di = 0; di < days.length; di++) {
    const day = days[di];
    const dayNum = day.day || di + 1;
    day.day = dayNum;

    // Find all ranges containing this day (transition days appear in 2 ranges)
    const rangesContaining = cityRanges.filter(r => dayNum >= r.startDay && dayNum <= r.endDay);
    const isTransition = rangesContaining.length > 1;

    if (dayNum === 1) {
      day._day_type = "arrival";
    } else if (dayNum === correctDuration) {
      day._day_type = "departure";
    } else if (isTransition) {
      day._day_type = "transition";
      day.is_travel_day = true;
      day._departure_city = rangesContaining[0].name;
      day._arrival_city = rangesContaining[rangesContaining.length - 1].name;
      console.log(`[V2-norm] Transition Day ${dayNum}: ${day._departure_city} → ${day._arrival_city} (AI city="${day.city}")`);
    } else {
      day._day_type = "full";
      if (day.is_travel_day) {
        console.log(`[V2-norm] Day ${dayNum}: AI marked is_travel_day but range says FULL day — correcting`);
        day.is_travel_day = false;
      }
    }

    // City assignment: TRUST AI on transition days, enforce range on others
    if (isTransition) {
      // AI decides which city owns the transition day — don't override
      if (!day.city) {
        day.city = day._arrival_city; // default to arrival if AI didn't set
      }
    } else {
      // Non-transition: enforce range-based city
      let ownerRange = null;
      for (const r of cityRanges) {
        if (dayNum >= r.startDay && dayNum <= r.endDay) {
          ownerRange = r;
          break;
        }
      }
      if (ownerRange) {
        if (day.city && day.city.toLowerCase() !== ownerRange.name.toLowerCase()) {
          console.log(`[V2-norm] Day ${dayNum}: city "${day.city}" → "${ownerRange.name}" (range correction)`);
        }
        day.city = ownerRange.name;
      }
    }
  }

  // ── 4. Fix dates if depart_date is known ──
  const departDate = params?.depart_date;
  if (departDate) {
    try {
      const dep = new Date(departDate);
      for (let di = 0; di < days.length; di++) {
        const d = new Date(dep);
        d.setDate(d.getDate() + di);
        days[di].date = d.toISOString().split("T")[0];
      }
      // Compute return_date
      const ret = new Date(dep);
      ret.setDate(ret.getDate() + totalNights);
      aiPlan._return_date = ret.toISOString().split("T")[0];
    } catch {}
  }

  // ── 5. Trim or pad days array to match correctDuration ──
  if (days.length > correctDuration) {
    console.log(`[V2-norm] Trimming days: ${days.length} → ${correctDuration}`);
    aiPlan.days = days.slice(0, correctDuration);
  } else if (days.length < correctDuration) {
    console.log(`[V2-norm] AI generated ${days.length} days but need ${correctDuration} — padding with city-aware days`);
    // Determine which cities need more days using the city ranges
    while (aiPlan.days.length < correctDuration) {
      const padDay = aiPlan.days.length + 1;
      const isDeparture = padDay === correctDuration;

      // Find which city should own this padded day (use ranges)
      let padCity = cities[cities.length - 1]?.name || "";
      for (let ri = cityRanges.length - 1; ri >= 0; ri--) {
        const r = cityRanges[ri];
        if (padDay >= r.startDay && padDay <= r.endDay) {
          padCity = r.name;
          break;
        }
      }

      // Check if this city has must-visits that haven't been placed yet
      const userCity = userCities.find((uc: any) =>
        (uc.name || "").toLowerCase() === padCity.toLowerCase()
      );
      const mustVisits = userCity?.must_visit || [];
      const existingActivities = (aiPlan.days || [])
        .filter((d: any) => (d.city || "").toLowerCase() === padCity.toLowerCase())
        .flatMap((d: any) => (d.activities || []).map((a: any) => (a.activity || "").toLowerCase()));

      const missingMustVisits = mustVisits.filter((mv: string) =>
        !existingActivities.some((ea: string) => ea.includes(mv.toLowerCase()) || mv.toLowerCase().includes(ea))
      );

      // Build activities for padded day from missing must-visits
      const paddedActivities: any[] = [];
      if (!isDeparture && missingMustVisits.length > 0) {
        const toAdd = missingMustVisits.splice(0, 3); // max 3 per padded day
        let hour = 9;
        for (const mv of toAdd) {
          const freeKw = /\b(park|beach|street|chinatown|little india|merlion|walking|market|mall|batu caves)\b/i;
          const isFree = freeKw.test(mv);
          paddedActivities.push({
            time: `${String(hour).padStart(2, "0")}:00`,
            activity: mv,
            description: `Must-visit attraction (auto-scheduled)`,
            duration_hours: 2,
            cost_estimate: isFree ? 0 : 25,
            category: isFree ? "free" : "activity",
            is_free: isFree,
            is_bookable: !isFree,
            booking_notes: isFree ? null : "Book tickets in advance",
          });
          hour += 3;
        }
      }

      aiPlan.days.push({
        day: padDay,
        city: padCity,
        title: isDeparture ? "Departure Day" : `Explore ${padCity}`,
        is_travel_day: isDeparture,
        _day_type: isDeparture ? "departure" : "full",
        activities: paddedActivities,
      });
    }
  }

  // ── 5b. REMOVED — transport reshuffling was too aggressive ──
  // The AI already places flights on the correct day. Moving them forward to the
  // "next transition day" caused flights to land on wrong city transitions.
  // The AI review layer (aiReviewPlan) handles genuine misplacements more accurately.

  // ── 5c. REMOVED — wrong-city activity removal was too aggressive ──
  // The AI already assigns activities per city. Name-based city matching caused
  // false positives (e.g., "Flight from Singapore" removed on Langkawi days).
  // The AI review layer (aiReviewPlan) handles genuine misplacements more accurately.

  // ── 6. Hotel rescue: move hotel names from special_notes to city.preferred_hotel ──
  const hotelKeywords = /\b(hotel|resort|suites?|lodge|inn|villa|hostel|motel|mansion|palace|boutique\s+stay|serviced\s+apartment)/i;
  const userSpecialNotes = Array.isArray(params?.user_special_notes) ? params.user_special_notes : [];
  const rescued: string[] = [];
  const cleanedNotes: string[] = [];
  for (const note of userSpecialNotes) {
    if (hotelKeywords.test(note)) rescued.push(note);
    else cleanedNotes.push(note);
  }
  if (rescued.length > 0 && params) {
    params.user_special_notes = cleanedNotes;
    for (const hotelNote of rescued) {
      let assigned = false;
      for (const city of cities) {
        const cName = (city.name || "").toLowerCase();
        if (hotelNote.toLowerCase().includes(cName) || !city.preferred_hotel) {
          if (!city.preferred_hotel) {
            city.preferred_hotel = hotelNote;
            console.log(`[V2-norm] Hotel rescue: "${hotelNote}" → ${city.name}`);
            assigned = true;
            break;
          }
        }
      }
      if (!assigned) console.log(`[V2-norm] Hotel rescue: "${hotelNote}" → unassigned`);
    }
  }

  // ── 6b. Enforce user-specified preferred hotels over AI choices ──
  const userCitiesForHotels = Array.isArray(params?.cities) ? params.cities : [];
  for (const city of cities) {
    const userCity = userCitiesForHotels.find((uc: any) =>
      (uc.name || "").toLowerCase() === (city.name || "").toLowerCase()
    );
    if (userCity?.preferred_hotel && city.preferred_hotel !== userCity.preferred_hotel) {
      console.log(`[V2-norm] Hotel override: AI chose "${city.preferred_hotel}" → user specified "${userCity.preferred_hotel}" for ${city.name}`);
      city.preferred_hotel = userCity.preferred_hotel;
    }
    // Propagate self_managed_nights from user input
    if (userCity?.self_managed_nights > 0) {
      city.self_managed_nights = userCity.self_managed_nights;
    }
  }

  console.log(`[V2-norm] Calendar: ${cities.length} cities, ${totalNights}n+1=${correctDuration}d, ${aiPlan.days.length} days generated`);
}

// ── Must-Visit Recovery Pass ──
// After AI generation + calendar normalization, check if all user-requested
// must-visit items are present. Inject missing ones into least-loaded city days.

function recoverMustVisits(aiPlan: any, params: any): string[] {
  const userCities = Array.isArray(params?.cities) ? params.cities : [];
  if (userCities.length === 0) return [];

  // Collect all must-visit items per city
  const mustVisitsByCity: { city: string; items: string[] }[] = [];
  for (const uc of userCities) {
    if (uc.must_visit && Array.isArray(uc.must_visit) && uc.must_visit.length > 0) {
      mustVisitsByCity.push({ city: uc.name, items: uc.must_visit });
    }
  }
  if (mustVisitsByCity.length === 0) return [];

  // Flatten all existing activity names (lowercased) for matching
  const allActivities = (aiPlan.days || []).flatMap((d: any) =>
    (d.activities || []).map((a: any) => (a.activity || a.name || "").toLowerCase())
  );

  const recovered: string[] = [];

  for (const { city, items } of mustVisitsByCity) {
    for (const mustItem of items) {
      const mustLower = mustItem.toLowerCase();
      // Fuzzy check: does any existing activity contain the must-visit term?
      // Split must-visit into key tokens and check if majority are present
      const tokens = mustLower.split(/[\s\-()]+/).filter(t => t.length > 2);
      const found = allActivities.some((act: string) => {
        if (act.includes(mustLower)) return true;
        if (mustLower.includes("universal") && act.includes("universal")) return true;
        if (mustLower.includes("artscience") && act.includes("artscience")) return true;
        if (mustLower.includes("entopia") && act.includes("entopia")) return true;
        if (mustLower.includes("zoo negara") && act.includes("zoo negara")) return true;
        // Token overlap: if 60%+ of tokens match, consider it found
        const matchCount = tokens.filter(t => act.includes(t)).length;
        return tokens.length > 0 && matchCount / tokens.length >= 0.6;
      });

      if (!found) {
        // Find least-loaded day for this city
        const cityDays = (aiPlan.days || []).filter((d: any) =>
          (d.city || "").toLowerCase() === city.toLowerCase() && !d.is_travel_day
        );
        if (cityDays.length === 0) continue;

        // Sort by activity count (least loaded first)
        cityDays.sort((a: any, b: any) => (a.activities?.length || 0) - (b.activities?.length || 0));
        const targetDay = cityDays[0];

        // Determine time slot: find last activity time and add 2 hours
        const activities = targetDay.activities || [];
        let insertTime = "10:00";
        if (activities.length > 0) {
          const lastAct = activities[activities.length - 1];
          const lastTime = lastAct.time || "10:00";
          const [h, m] = lastTime.split(":").map(Number);
          const newH = Math.min(h + Math.ceil(lastAct.duration_hours || 2), 18);
          insertTime = `${String(newH).padStart(2, "0")}:${String(m || 0).padStart(2, "0")}`;
        }

        // Determine if this is likely a paid or free attraction
        const freeKeywords = /\b(park|beach|street|chinatown|little india|merlion|walking|market|mall)\b/i;
        const isFree = freeKeywords.test(mustItem);

        const newActivity = {
          time: insertTime,
          activity: mustItem,
          description: `Must-visit attraction (recovered — was missing from AI plan)`,
          duration_hours: 2,
          cost_estimate: isFree ? 0 : 25,
          category: isFree ? "free" : "activity",
          is_free: isFree,
          booking_notes: isFree ? null : "Book tickets in advance",
          tips: null,
        };

        if (!targetDay.activities) targetDay.activities = [];
        targetDay.activities.push(newActivity);

        // Re-sort activities by time
        targetDay.activities.sort((a: any, b: any) => (a.time || "").localeCompare(b.time || ""));

        recovered.push(`${mustItem} → Day ${targetDay.day} (${city})`);
        console.log(`[V2-recovery] 🔄 Injected missing must-visit: "${mustItem}" → Day ${targetDay.day} in ${city} at ${insertTime}`);
      }
    }
  }

  // ── WITHIN-DAY DEDUP: exact match + semantic overlap on same day ──
  for (const day of (aiPlan.days || [])) {
    if (!day.activities) continue;
    const withinDaySeen: string[] = [];
    day.activities = day.activities.filter((a: any) => {
      const rawName = a.activity || a.name || "";
      const key = rawName.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (!key) return false;
      // Exact match
      if (withinDaySeen.some(s => s === key)) {
        console.log(`[V2-dedup] 🚫 Within-day exact dup removed: "${rawName}" on Day ${day.day}`);
        return false;
      }
      // Semantic overlap: tokenize and check if 60%+ tokens match any existing entry
      const tokens = key.replace(/\d+/g, "").match(/.{3,}/g) || rawName.toLowerCase().split(/\s+/).filter((t: string) => t.length >= 3);
      for (const existing of withinDaySeen) {
        if (tokens.length >= 2) {
          const matchCount = tokens.filter((t: string) => existing.includes(t)).length;
          if (matchCount / tokens.length >= 0.6) {
            console.log(`[V2-dedup] 🚫 Within-day semantic dup removed: "${rawName}" (overlaps with existing) on Day ${day.day}`);
            return false;
          }
        }
      }
      withinDaySeen.push(key);
      return true;
    });
  }

  // ── CROSS-DAY EXACT DEDUP: only remove if the exact same normalized name appears ──
  const globalSeenExact = new Set<string>();
  for (const day of (aiPlan.days || [])) {
    if (!day.activities) continue;
    day.activities = day.activities.filter((a: any) => {
      const rawName = a.activity || a.name || "";
      const key = rawName.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (!key || key.length < 5) return true; // keep short/generic entries
      if (globalSeenExact.has(key)) {
        console.log(`[V2-dedup] 🚫 Exact cross-day duplicate removed: "${rawName}" on Day ${day.day}`);
        return false;
      }
      globalSeenExact.add(key);
      return true;
    });
  }

  if (recovered.length > 0) {
    console.log(`[V2-recovery] ✅ Recovered ${recovered.length} missing must-visit items`);
  } else {
    console.log(`[V2-recovery] ✅ All must-visit items present in AI plan`);
  }

  return recovered;
}

// ── Global Activity Sanitization ──
// Ensures every activity in every day is a proper {activity, time, ...} object.
// Catches malformed entries from recovery, review, or AI parsing stages.

function sanitizeAllActivities(aiPlan: any): void {
  for (const day of (aiPlan.days || [])) {
    if (!Array.isArray(day.activities)) { day.activities = []; continue; }
    day.activities = day.activities
      .map((a: any) => {
        // Already a proper activity object
        if (a && typeof a === "object" && !Array.isArray(a)) {
          // Ensure `activity` field is a string — sometimes it's a nested object
          if (typeof a.activity === "object" && a.activity !== null) {
            a.activity = a.activity.name || a.activity.title || a.activity.activity || JSON.stringify(a.activity);
          }
          if (typeof a.name === "object" && a.name !== null) {
            a.name = a.name.name || a.name.title || JSON.stringify(a.name);
          }
          // Ensure at least one name field exists
          if (!a.activity && !a.name) {
            if (a.title) { a.activity = a.title; }
            else if (a.description) { a.activity = a.description; }
            else return null; // discard completely empty entries
          }
          // Coerce activity to string
          a.activity = String(a.activity || a.name || "");
          return a;
        }
        // Plain string → wrap into activity object
        if (typeof a === "string" && a.trim()) {
          return { time: "10:00", activity: a.trim(), description: "", duration_hours: 2, cost_estimate: 0, category: "activity", is_free: true };
        }
        // Discard anything else (null, number, array, etc.)
        return null;
      })
      .filter(Boolean);
  }
}

// ── Structure itinerary ──

function structureItinerary(aiPlan: any, params: any, currency: string): any {
  const adults = Math.max(1, Number(params?.adults || 1));
  const children = Math.max(0, Number(params?.children || 0));
  const infants = Math.max(0, Number(params?.infants || 0));
  const totalTravelers = adults + children + infants;

  const totalActivityCost = (aiPlan.days || []).reduce((sum: number, day: any) =>
    sum + (day.activities || []).reduce((ds: number, a: any) => ds + Number(a.cost_estimate || 0), 0), 0);

  return {
    trip_title: aiPlan.trip_title || "Your Trip",
    destination: aiPlan.destination || "",
    duration_days: aiPlan.duration_days || aiPlan.days?.length || 0,
    travelers: totalTravelers,
    adults, children, infants,
    budget_estimate: {
      currency,
      total: totalActivityCost,
      breakdown: { flights: 0, hotels: 0, activities: totalActivityCost },
      is_estimated: true,
    },
    selected_flight: null,
    selected_hotels: aiPlan.cities?.map((c: any) => {
      // Use user-specified preferred_hotel over AI suggestion
      const userCities = Array.isArray(params?.cities) ? params.cities : [];
      const userCity = userCities.find((uc: any) => (uc.name || "").toLowerCase() === (c.name || "").toLowerCase());
      const preferredHotel = userCity?.preferred_hotel || c.preferred_hotel || null;
      const selfManagedNights = Number(userCity?.self_managed_nights || c.self_managed_nights || 0);
      const totalNights = Number(c.nights || (c.days ? Math.max(c.days - 1, 1) : 2));
      const paidNights = Math.max(0, totalNights - selfManagedNights);

      return {
        name: preferredHotel || `Hotel in ${c.name}`,
        city: c.name, stars: params?.hotel_stars || 4,
        price_per_night: 0, total_price: 0,
        nights: paidNights,
        total_nights: totalNights,
        self_managed_nights: selfManagedNights,
        hotel_area: c.hotel_area || "",
        reason: preferredHotel ? (userCity?.preferred_hotel ? "User specified" : "AI suggested") : "To be matched",
        ai_suggestion: c.preferred_hotel || null,
        user_preferred: userCity?.preferred_hotel || null,
        currency, is_live_price: false,
      };
    }) || [],
    days: (aiPlan.days || []).map((day: any) => ({
      day: day.day, title: day.title || `Day ${day.day}`,
      city: day.city || "", date: day.date || undefined,
      is_travel_day: !!day.is_travel_day,
      day_type: day._day_type || (day.is_travel_day ? "transition" : "full"),
      departure_city: day._departure_city || undefined,
      arrival_city: day._arrival_city || undefined,
      activities: (day.activities || []).map((a: any) => ({
        time: a.time || "09:00",
        activity: a.activity || a.name || "",
        search_title: a.search_title || null,
        
        description: a.description || "",
        cost_estimate: Number(a.cost_estimate || 0),
        category: a.category || "activity",
        is_free: !!a.is_free || Number(a.cost_estimate || 0) === 0,
        is_bookable: a.is_bookable !== undefined ? !!a.is_bookable : (Number(a.cost_estimate || 0) > 0),
        is_live_price: a._price_source === "catalogue",
        source: a._price_source || (a.is_free ? "free" : "ai_estimate"),
        price_confidence: a._price_confidence || null,
        product_code: a.product_code || null,
        product_option_code: a.product_option_code || null,
        product_name: a.product_name || null,
        option_title: a.option_title || null,
        vela_id: a.vela_id || null,
        slug: a.slug || null,
        highlights: Array.isArray(a.highlights) ? a.highlights.slice(0, 5) : null,
        places_covered: Array.isArray(a.places_covered) ? a.places_covered.slice(0, 5) : null,
        rating: a.rating || null,
        review_count: a.review_count || null,
        duration_hours: a.duration_hours || 2,
        booking_notes: a.booking_notes || null,
        tips: a.tips || null,
        _swap_pool: a._swap_pool || null,
      })),
      hotel: {
        name: "TBD", area: day.city || "",
        price_per_night: 0, stars: params?.hotel_stars || 4,
        is_live_price: false,
      },
    })),
    travel_connections: aiPlan.travel_connections || [],
    included: [],
    excluded: ["Visa fees", "Travel insurance", "Personal expenses", "Tips & gratuities"],
    assumptions: aiPlan.assumptions || [],
    tips: aiPlan.tips || [],
    best_time_to_visit: aiPlan.best_time_to_visit || "",
    live_flights: [], live_hotels: [], live_activities: [],
    _pipeline_version: "v2_plaintext_5tier",
    _return_date: aiPlan._return_date || null,
  };
}

// ── Strip HTML ──

function stripHtml(obj: any): void {
  if (!obj || typeof obj !== "object") return;
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === "string") {
      obj[key] = obj[key].replace(/<[^>]*>/g, "").trim();
    } else if (typeof obj[key] === "object") {
      stripHtml(obj[key]);
    }
  }
}

// ── AI Review: compare original AI plan vs final pipeline output ──

async function aiReviewPlan(aiPlan: any, beforeNorm: any[], params: any): Promise<void> {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY") || "";
  const googleKey = Deno.env.get("GOOGLE_AI_API_KEY") || "";
  if (!lovableKey && !googleKey) {
    console.log("[V2-review] No AI keys available, skipping review");
    return;
  }

  // Build detailed snapshot of ORIGINAL AI plan (before any pipeline touches)
  const originalPlan = beforeNorm.map((d: any) => ({
    day: d.day,
    city: d.city,
    title: d.title,
    is_travel_day: !!d.is_travel_day,
    activities: d.activities || [],
  }));

  // Build detailed snapshot of FINAL pipeline plan (after normalization + recovery)
  const finalPlan = (aiPlan.days || []).map((d: any) => ({
    day: d.day,
    city: d.city,
    title: d.title,
    day_type: d._day_type || "full",
    is_travel_day: !!d.is_travel_day,
    departure_city: d._departure_city || null,
    arrival_city: d._arrival_city || null,
    activities: (d.activities || []).map((a: any) => ({
      time: a.time || "",
      name: a.activity || a.name || "",
      category: a.category || "",
      is_bookable: !!a.is_bookable,
    })).slice(0, 8),
  }));

  // Detect structural diffs
  const diffs: string[] = [];
  for (let i = 0; i < Math.max(originalPlan.length, finalPlan.length); i++) {
    const orig = originalPlan[i];
    const final = finalPlan[i];
    if (!orig && final) { diffs.push(`Day ${final.day}: ADDED by pipeline (not in original AI plan)`); continue; }
    if (orig && !final) { diffs.push(`Day ${orig.day}: REMOVED by pipeline`); continue; }
    if (orig.city?.toLowerCase() !== final.city?.toLowerCase()) {
      diffs.push(`Day ${final.day}: city changed "${orig.city}" → "${final.city}"`);
    }
    if (orig.is_travel_day !== final.is_travel_day) {
      diffs.push(`Day ${final.day}: travel_day ${orig.is_travel_day} → ${final.is_travel_day}`);
    }
    // Check activity count changes
    const origActs = orig.activities || [];
    const finalActs = final.activities || [];
    if (Math.abs(origActs.length - finalActs.length) > 1) {
      diffs.push(`Day ${final.day}: activity count ${origActs.length} → ${finalActs.length}`);
    }
    // Check if flight/transport moved away
    const origHasFlight = origActs.some((a: any) => /flight|fly|depart|arrive/i.test(typeof a === "string" ? a : (a.name || a.activity || "")));
    const finalHasFlight = finalActs.some((a: any) => /flight|fly|depart|arrive/i.test(typeof a === "string" ? a : (a.name || a.activity || "")));
    if (origHasFlight && !finalHasFlight) {
      diffs.push(`Day ${final.day}: ⚠️ FLIGHT was in original but MISSING in final`);
    }
    if (!origHasFlight && finalHasFlight) {
      diffs.push(`Day ${final.day}: ⚠️ FLIGHT ADDED that wasn't in original`);
    }
  }

  console.log(`[V2-review] ${diffs.length} structural diffs detected`);

  // Build user cities context
  const userCities = Array.isArray(params?.cities) ? params.cities : [];
  const citySpec = userCities.map((c: any) =>
    `${c.name} (${c.nights}n${c.must_visit?.length ? `, must-visit: ${c.must_visit.join(", ")}` : ""})`
  ).join(" → ");

  const reviewPrompt = `You are a travel itinerary QA reviewer. Your job: ensure the FINAL pipeline output faithfully matches the ORIGINAL AI-generated day structure.

USER REQUEST: ${citySpec || params?.destination_city || "multi-city trip"}
DEPART: ${params?.depart_date || "unknown"}

══ ORIGINAL AI PLAN (the source of truth for day structure) ══
${JSON.stringify(originalPlan, null, 1)}

══ FINAL PIPELINE OUTPUT (what the user will see) ══
${JSON.stringify(finalPlan, null, 1)}

══ STRUCTURAL DIFFS DETECTED ══
${diffs.length > 0 ? diffs.join("\n") : "None detected by diff engine"}

══ REVIEW RULES (STRICT — follow exactly) ══
1. The ORIGINAL AI plan defines the CORRECT day structure: which day is which city, which day is a travel/transition day, which day has flights.
2. If the final plan has MOVED a flight to a different day than the original, FIX IT — move it back to the original day.
3. If the final plan has CHANGED a day's city from the original, FIX IT — restore the original city unless the original was clearly wrong (e.g., activities don't match city).
4. If the final plan has activities from the WRONG CITY on a day, remove them — BUT NEVER remove activities that were in the ORIGINAL AI plan for that day. If the original AI placed it there, it stays.
5. Transition/travel days: the flight STAYS on the day the original AI placed it. NEVER move flights between days.
6. Day titles must match: city name + day type (e.g., "Explore Singapore" for full, "Singapore → Langkawi" for transition).
7. Activity ordering within a day should be chronologically sensible (check-out → transfer → flight → arrive → check-in).
8. Do NOT add new activities the original didn't have unless a day would be completely empty.
9. CRITICAL: NEVER use "remove_activity" for activities that exist in the ORIGINAL AI plan on the same day. Only remove activities that were INCORRECTLY ADDED by the pipeline and don't exist in the original. User-requested must-visit items (landmarks, attractions) must NEVER be removed.
10. NO activity count limits. Do NOT remove activities to reduce count. The AI planned them based on traveler composition and available time.

══ OUTPUT FORMAT ══
If the final plan correctly matches the original AI structure: {"verdict":"ok"}
If fixes needed:
{
  "verdict": "fix",
  "fixes": [
    {"day": 4, "field": "title", "value": "Singapore → Langkawi"},
    {"day": 4, "field": "city", "value": "Singapore"},
    {"day": 4, "field": "day_type", "value": "transition"},
    {"day": 5, "field": "remove_activity", "value": "Flight to Langkawi"},
    {"day": 4, "field": "move_activity_from_day", "source_day": 5, "value": "Flight to Langkawi", "time": "14:00"}
  ]
}
Only output JSON. No explanation.`;

  try {
    let reviewText = "";
    const LOVABLE_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
    const GOOGLE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

    // Use Gemini 2.5 Flash (not Lite) for better structural reasoning
    if (lovableKey) {
      try {
        const reviewStart = Date.now();
        const res = await fetch(LOVABLE_URL, {
          method: "POST",
          headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [{ role: "user", content: reviewPrompt }],
            max_tokens: 3000, temperature: 0.1,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          reviewText = data.choices?.[0]?.message?.content || "";
          // Log review token usage
          const reviewUsage = data.usage;
          if (reviewUsage) {
            logAiUsage("ai-trip-generate-v2-review", "gemini-2.5-flash", "lovable", {
              input_tokens: reviewUsage.prompt_tokens || 0,
              output_tokens: reviewUsage.completion_tokens || 0,
              total_tokens: reviewUsage.total_tokens || 0,
            }, Date.now() - reviewStart, true);
          }
        }
      } catch (e) { console.log("[V2-review] Lovable Flash failed, trying fallback:", e); }
    }

    if (!reviewText && googleKey) {
      try {
        const res = await fetch(`${GOOGLE_URL}/gemini-2.5-flash:generateContent?key=${googleKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: reviewPrompt }] }],
            generationConfig: { maxOutputTokens: 3000, temperature: 0.1 },
          }),
        });
        if (res.ok) {
          const data = await res.json();
          reviewText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        }
      } catch (e) { console.log("[V2-review] Google Flash fallback failed:", e); }
    }

    if (!reviewText) {
      console.log("[V2-review] No review response, skipping");
      return;
    }

    // Parse review JSON
    const jsonMatch = reviewText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.log("[V2-review] Could not parse review JSON");
      return;
    }

    const review = JSON.parse(jsonMatch[0]);
    console.log(`[V2-review] Verdict: ${review.verdict}${review.fixes ? ` (${review.fixes.length} fixes)` : ""}`);

    if (review.verdict === "ok" || !review.fixes || !Array.isArray(review.fixes)) {
      console.log("[V2-review] ✅ Plan verified — structure matches original AI plan");
      return;
    }

    // Apply fixes
    let fixCount = 0;
    for (const fix of review.fixes) {
      const dayIdx = (aiPlan.days || []).findIndex((d: any) => d.day === fix.day);
      if (dayIdx === -1) continue;
      const day = aiPlan.days[dayIdx];

      switch (fix.field) {
        case "title":
          console.log(`[V2-review] Fix Day ${fix.day} title: "${day.title}" → "${fix.value}"`);
          day.title = fix.value;
          fixCount++;
          break;
        case "city":
          console.log(`[V2-review] Fix Day ${fix.day} city: "${day.city}" → "${fix.value}"`);
          day.city = fix.value;
          fixCount++;
          break;
        case "day_type":
          console.log(`[V2-review] Fix Day ${fix.day} day_type: "${day._day_type}" → "${fix.value}"`);
          day._day_type = fix.value;
          day.is_travel_day = fix.value === "transition";
          fixCount++;
          break;
        case "remove_activity": {
          // Safety guard: check if this activity existed in the ORIGINAL AI plan for this day
          // If it did, the AI reviewer is wrong to remove it — skip the fix
          const removeTarget = (fix.value || "").toLowerCase();
          const origDay = (beforeNorm || []).find((d: any) => d.day === fix.day);
          const existedInOriginal = origDay && (origDay.activities || []).some((a: any) => {
            const origName = (typeof a === "string" ? a : (a.name || a.activity || "")).toLowerCase();
            return origName.includes(removeTarget) || removeTarget.includes(origName);
          });
          if (existedInOriginal) {
            console.log(`[V2-review] ⛔ BLOCKED removal of "${fix.value}" on Day ${fix.day} — activity exists in original AI plan`);
            break;
          }
          const beforeLen = (day.activities || []).length;
          day.activities = (day.activities || []).filter((a: any) =>
            !(a.activity || "").toLowerCase().includes(removeTarget)
          );
          if ((day.activities || []).length < beforeLen) {
            console.log(`[V2-review] Fix Day ${fix.day}: removed activity "${fix.value}"`);
            fixCount++;
          }
          break;
        }
        case "move_activity_from_day": {
          // Move an activity from source_day to this day
          const srcIdx = (aiPlan.days || []).findIndex((d: any) => d.day === fix.source_day);
          if (srcIdx === -1) break;
          const srcDay = aiPlan.days[srcIdx];
          const actIdx = (srcDay.activities || []).findIndex((a: any) =>
            (a.activity || "").toLowerCase().includes((fix.value || "").toLowerCase())
          );
          if (actIdx === -1) break;
          const [movedAct] = srcDay.activities.splice(actIdx, 1);
          movedAct.time = fix.time || movedAct.time;
          if (!day.activities) day.activities = [];
          day.activities.push(movedAct);
          day.activities.sort((a: any, b: any) => (a.time || "").localeCompare(b.time || ""));
          console.log(`[V2-review] Fix: moved "${fix.value}" from Day ${fix.source_day} → Day ${fix.day}`);
          fixCount++;
          break;
        }
        case "add_activity":
          if (!day.activities) day.activities = [];
          day.activities.push({
            time: fix.time || "12:00",
            activity: fix.value,
            description: "Added by AI review",
            duration_hours: fix.duration_hours || 2,
            cost_estimate: 0,
            category: fix.category || "activity",
            is_free: true,
            is_bookable: false,
          });
          day.activities.sort((a: any, b: any) => (a.time || "").localeCompare(b.time || ""));
          console.log(`[V2-review] Fix Day ${fix.day}: added activity "${fix.value}" at ${fix.time || "12:00"}`);
          fixCount++;
          break;
      }
    }

    console.log(`[V2-review] ✅ Applied ${fixCount} structural fixes from AI review`);
  } catch (e) {
    console.log("[V2-review] Review failed (non-fatal):", e);
  }
}

// matchActivitiesToProducts REMOVED — activity matching is handled by ai-trip-match-v2 (activity-prefetch mode)

// ═══ MAIN HANDLER ═══

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const t = timer();
    const body = await req.json();

    const rawRequest = body.raw_request || "";
    const searchParams = body.searchParams || {};
    const currency = body.currency || "USD";
    const debugMode = body.debug_mode || false;

    // Merge top-level traveler counts into searchParams so buildUserMessage sees them
    if (body.adults) searchParams.adults = body.adults;
    if (body.children) searchParams.children = body.children;
    if (body.infants) searchParams.infants = body.infants;
    if (body.startDate && !searchParams.depart_date) searchParams.depart_date = body.startDate;
    if (body.origin && !searchParams.origin_city) searchParams.origin_city = body.origin;
    if (body.destinations && !searchParams.destination_city) searchParams.destination_city = Array.isArray(body.destinations) ? body.destinations.join(", ") : body.destinations;
    if (body.travelStyle && !searchParams.travel_style) searchParams.travel_style = body.travelStyle;
    if (body.budget && !searchParams.hotel_stars) {
      searchParams.hotel_stars = body.budget === "luxury" ? 5 : body.budget === "medium" ? 4 : 3;
    }

    if (!rawRequest && !searchParams?.destination_city) {
      return new Response(
        JSON.stringify({ error: "No trip requirements provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`[V2] 🚀 Starting plain-text 5-tier cascade pipeline | Travelers: ${searchParams.adults || 1}a+${searchParams.children || 0}c+${searchParams.infants || 0}i`);

    const progress = createProgressBroadcaster(body.progress_id);
    // Give channel a moment to subscribe
    await new Promise(r => setTimeout(r, 300));
    progress.send(0, "Planning your itinerary with AI…");

    const providers = buildProviders();
    if (providers.length === 0) {
      progress.cleanup();
      return new Response(
        JSON.stringify({ error: "No AI provider keys configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const systemPrompt = buildSystemPrompt(currency);
    const userMessage = buildUserMessage(rawRequest, searchParams);
    t.log("Pre-AI setup");

    // ═══ Call AI with fallback ═══
    progress.send(1, "Building day-by-day schedule…");
    const { content, provider, truncated } = await callWithFallback(providers, systemPrompt, userMessage);
    t.log(`AI response from ${provider}`);

    // ═══ Parse JSON from plain text ═══
    progress.send(2, "Parsing AI response…");
    const aiPlan = parseJsonFromText(content);

    if (!aiPlan || !aiPlan.days || !Array.isArray(aiPlan.days)) {
      console.error(`[V2] ❌ Failed to parse plan from ${provider}`);
      progress.cleanup();
      return new Response(
        JSON.stringify({ error: "Failed to parse AI tour plan" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`[V2] ✅ Parsed: ${aiPlan.days.length} days, ${aiPlan.cities?.length || 0} cities (via ${provider})${truncated ? " ⚠️ TRUNCATED" : ""}`);

    // ═══ Snapshot AI plan BEFORE normalization (for AI review) ═══
    const aiPlanBeforeNorm = JSON.parse(JSON.stringify(
      (aiPlan.days || []).map((d: any) => ({
        day: d.day, city: d.city, title: d.title,
        is_travel_day: !!d.is_travel_day,
        activities: (d.activities || []).map((a: any) => ({
          time: a.time || "",
          name: a.activity || a.name || "",
          category: a.category || "",
        })).slice(0, 8),
      }))
    ));

    // ═══ Deterministic Calendar Normalization ═══
    progress.send(2, "Normalizing dates & connections…");
    normalizeCalendar(aiPlan, { ...searchParams, cities: searchParams.cities });
    t.log("Calendar normalized");

    // ═══ Must-Visit Recovery ═══
    progress.send(2, "Checking must-visit coverage…");
    const recoveredItems = recoverMustVisits(aiPlan, { ...searchParams, cities: searchParams.cities });
    if (recoveredItems.length > 0) {
      console.log(`[V2] 🔄 Recovered ${recoveredItems.length} must-visit items: ${recoveredItems.join("; ")}`);
    }
    t.log("Must-visit recovery");

    // ═══ AI Review: compare initial vs corrected plan ═══
    progress.send(3, "AI reviewing itinerary accuracy…");
    await aiReviewPlan(aiPlan, aiPlanBeforeNorm, { ...searchParams, cities: searchParams.cities });
    t.log("AI review complete");

    // ═══ Global Activity Sanitization (catch malformed entries from any stage) ═══
    sanitizeAllActivities(aiPlan);

    // Activity product matching handled by ai-trip-match-v2 (activity-prefetch mode)

    // ═══ Structure ═══
    const itinerary = structureItinerary(aiPlan, searchParams, currency);
    stripHtml(itinerary);
    t.log("Itinerary structured");

    const response: any = {
      reply: `✨ Your ${itinerary.duration_days}-day ${itinerary.destination} itinerary is ready! Check the results panel →`,
      itinerary,
      liveData: { flightsFound: 0, hotelsFound: 0, activitiesFound: 0 },
    };

    if (debugMode) {
      response.debug = {
        ai_provider: provider,
        ai_truncated: truncated,
        must_visit_recovered: recoveredItems,
        ai_generated_snapshot: aiPlanBeforeNorm,
        ai_parsed_plan: aiPlan,
        timings: { total_ms: t.elapsed() },
        pipeline_version: "v2_plaintext_5tier",
      };
    }

    t.log("TOTAL V2 pipeline");
    progress.cleanup();

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[V2] Pipeline error:", e);
    const status = e.message?.includes("402") ? 402 : e.message?.includes("429") ? 429 : 500;
    return new Response(
      JSON.stringify({ error: e.message || "Unknown error" }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
