import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const LOVABLE_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

// ── Model Tiers — Gateway-first, then Direct API ──
// Extraction: 2.5 Flash (primary) → 3.0 Flash (fallback) → 2.5 Flash Lite (last resort)
// Simple/trivial tasks can use 2.5 Lite directly
const MODEL_EXTRACT_PRIMARY = "gemini-2.5-flash";               // Best accuracy/speed ratio for extraction
const MODEL_EXTRACT_FALLBACK = "gemini-3-flash-preview";        // Deeper reasoning fallback
const MODEL_EXTRACT_LAST_RESORT = "gemini-2.5-flash-lite";      // Ultra-cheap last resort

// Chat/Info-gathering: 2.5 Flash Lite (simple) → 2.5 Flash (fallback) → 3.0 Flash (last resort)
const MODEL_CHAT_PRIMARY = "gemini-2.5-flash-lite";             // Fast for conversational
const MODEL_CHAT_FALLBACK = "gemini-2.5-flash";                 // Accurate fallback
const MODEL_CHAT_LAST_RESORT = "gemini-3-flash-preview";        // Deep reasoning last resort

// Gateway model name mapping (Gemini model → gateway model path)
const GATEWAY_MODEL_MAP: Record<string, string> = {
  "gemini-2.5-flash": "google/gemini-2.5-flash",
  "gemini-2.5-flash-lite": "google/gemini-2.5-flash-lite",
  "gemini-3-flash-preview": "google/gemini-3-flash-preview",
};

const EXTRACTION_CONTEXT_MAX_CHARS = 6500;
const EXTRACTION_CONTEXT_MAX_MESSAGES = 8;
const EXTRACTION_USER_ONLY_MAX_CHARS = 3800;

// ── Timing helper ──
function timer() {
  const start = performance.now();
  return {
    elapsed: () => Math.round(performance.now() - start),
    log: (label: string) => {
      const ms = Math.round(performance.now() - start);
      console.log(`[TIMING] ${label}: ${ms}ms`);
      return ms;
    },
  };
}

// ── CORE RULES: compact universal rules for ALL prompts (chat, travel queries, ack) ──
const CORE_RULES = `
⛔ CORE RULES:
- LANGUAGE LOCK: Reply in the EXACT language of the user's LATEST message. Default English if uncertain.
- NEVER mention third-party providers (Viator, Tripjack, Travelport, Agoda, Amadeus, Sabre). Everything is "Travel Vela".
- NEVER name specific restaurants/cafés — describe cuisine + neighborhood instead. Exception: world-famous food landmarks.
- All prices in the user's display currency.
- NEVER mention timezone offsets.
- For visa/passport questions: use API data if provided, otherwise say "Check your country's embassy website." NEVER guess.
- Invoice integrity: never agree to issue documents showing different amounts from actual purchase price.`;

// ── ITINERARY RULES: detailed planning rules ONLY for generation, modification, and day-fix prompts ──
const ITINERARY_RULES = `
🛬 ARRIVAL DAY FLOW:
- Arrival time + 30min immigration/baggage → transfer → hotel check-in + 90min rest → activities ONLY after.
- Transfer vehicle by group: 1-2 pax=Sedan, 3-6=SUV/MPV, 7+=Van.

🛫 FLIGHT-TIME RULES (FLIGHT = SINGLE SOURCE OF TRUTH):
- Flights are HARD ANCHORS. Morning flight (<12PM): NO activities before flight. Evening flight (>4PM): 1-2 light activities ending ≥4h before departure.
- Departure day: checkout before 12:00, airport 3h before flight. checkout + transfer + flight SAME day. NEVER place checkout on previous day.

🚫 LONG ACTIVITY PROTECTION:
- NEVER place theme parks, water parks, full-day tours on departure/transition days. Schedule on full sightseeing days only.

📋 ACTIVITY LIMITS & PACING:
- Max 3-4 activities/day. Group by geographic proximity. 20-40min buffer between activities.
- Quality > quantity. Never zigzag across the city.

⏱️ DURATION MODEL:
- Landmark 60-90min, Museum 2-3h, Walking district 2-3h, Gardens 2-4h, Theme park 6-8h, Zoo 2-4h, Half-day tour 4-5h, Full-day tour 7-9h.
- Add buffers: queues +15-30min, walking +15-30min, rest +15-30min.
- Peak hours (10:30-16:30) +20-40%. Infant +30-40%, Senior +25-40%, Honeymoon +15-25%.

📋 DAY FEASIBILITY:
- Total scheduled hours ≤ available window (08:00-21:00). If exceeded, remove lowest-priority activity.
- Reject days with >4 sightseeing activities, <1h between activities, or >10h total.

⏱️ TIME ANCHORS:
- Place ALL anchors FIRST (flights, transfers, check-in/out, rest, fixed-time tours), THEN fill activities.
- No overlaps, no duplicates, no activity during transfers.

🏨 HOTELS & REST:
- "staying with relatives/self managed" → NO hotel injection for those nights.
- "free day/rest day/no activities" → mark as "Free day – self managed", no activities.

🚗 TRANSFERS:
- Always include airport↔hotel transfers. Vehicle by group size.

🔍 PRODUCT VERIFICATION:
- Verify variant, pricing (per person vs group), inclusions, schedule compatibility. Never assume first result is correct.
- Bundle detection: if one product covers multiple attractions, use it and remove standalone duplicates.

🚆 INTERCITY TRANSPORT:
- Direct flight preferred. Ground for <300km, transit flight for >500km. Prioritize shortest time, comfort for families/seniors.

🔢 NxD NOTATION:
- "3N4D" = 3 nights, 4 days. Arrival day = partial. Departure day = partial.

👤 TRIP TYPE ADAPTATION:
- Infer from travelers: adults+kids→family, 2 adults→couple, 1 adult→solo, 3+ adults→group.
- Honeymoon: romantic/boutique, max 2-3 activities, scenic. Family+infant: max 2-3 gentle, stroller-friendly, done by 18:00. Senior: relaxed, elevator access, avoid steep terrain. Adventure: 4/day OK, active. Luxury: 5★, private transfers, premium. Budget: value-focused, free attractions.
- NEVER autonomously suggest products conflicting with traveler profile. However, if the user EXPLICITLY requests a specific activity (e.g., cycling, hiking), always respect their choice regardless of traveler composition.
- When traveling with infants or toddlers and the AI is choosing activities on its own (not user-requested), exclude cycling, bike tours, hiking, trekking, kayaking, scuba diving, or any physically demanding activity. Suggest gentle alternatives instead (gardens, aquariums, cable cars, boat tours, cultural shows). But if the user explicitly asks for any of these activities, include them without question — the user's choice overrides safety suggestions.`;

// Combined for backward compatibility in generation/fix prompts
const SHARED_RULES = CORE_RULES + "\n" + ITINERARY_RULES;

// Phase 1: Extract structured trip parameters from FULL conversation
// ── Minimal prompt — let the AI reason naturally ──
const EXTRACT_PROMPT_MINIMAL = `You are a travel parameter extractor. Read the conversation and extract trip details.

TODAY: ${new Date().toISOString().split("T")[0]}

CRITICAL DURATION RULES:
- city.nights = number of NIGHTS in that city.
- city.days = city.nights + 1 (e.g. 3 nights → 4 days).
- NxD notation: "3N4D" → nights=3, days=4. "2N3D" → nights=2, days=3. Always output BOTH nights AND days.
- If only nights given (e.g. "5 nights"): nights=5, days=6.
- duration_days = sum of all city DAYS, but the last city's departure day overlaps with trip end.
  Simplified: duration_days = sum of all city nights + 1.
- CITY-STATES: Singapore, Hong Kong, Macau are CITIES — always include them in the cities array with their own nights/days. NEVER skip or merge them with other cities.

HOTEL EXTRACTION — CRITICAL DISTINCTION:
- preferred_hotel: ONLY for specific, named hotels/resorts the user wants to stay at (e.g. "Shangri-La", "Hilton", "JW Marriott", "Marina Bay Sands"). Must be a real, identifiable hotel brand/name.
- hotel_area: Area/neighborhood/zone preference for the hotel (e.g. "KLCC", "Batu Ferringhi", "Sentosa", "Bukit Bintang", "near beach", "city center"). Extract from phrases like "KLCC view hotel", "hotel near the beach", "Batu Ferringhi resort".
- hotel_type: Property type preference (e.g. "resort", "boutique", "villa", "guesthouse", "apartment", "hostel"). Extract from "beach resort", "boutique hotel", "private villa".
- If user says "KLCC view hotel" → preferred_hotel=null, hotel_area="KLCC", hotel_type=null (it's an area preference, not a hotel name)
- If user says "Batu Ferringhi resort" → preferred_hotel=null, hotel_area="Batu Ferringhi", hotel_type="resort"
- If user says "Shangri-La KLCC" → preferred_hotel="Shangri-La", hotel_area="KLCC", hotel_type=null
- If user says "any hotel" or "AI pick best" → preferred_hotel=null, hotel_area=null, hotel_type=null
- user_special_notes: experience modifiers, passes, transport preferences (e.g. "Express pass", "Cable car inclusive", "direct flight").
- NEVER put hotel/resort names into user_special_notes.

Only flag fields as missing_critical if truly absent from the entire conversation.`;

// ── Tool schema for structured extraction ──
const EXTRACT_TOOL_SCHEMA = {
  type: "function" as const,
  function: {
    name: "extract_trip_params",
    description: "Extract structured trip parameters from the user's conversation",
    parameters: {
      type: "object",
      properties: {
        origin_city: { type: ["string", "null"], description: "Departure city" },
        origin_airport: { type: ["string", "null"], description: "IATA code of origin airport" },
        destination_city: { type: ["string", "null"], description: "Primary destination city" },
        destination_country: { type: ["string", "null"], description: "Destination country" },
        destination_airport: { type: ["string", "null"], description: "IATA code of destination airport" },
        cities: {
          type: ["array", "null"],
          description: "Multi-city breakdown with BOTH nights and days fields",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              nights: { type: "number", description: "Number of NIGHTS in this city (e.g. '3n4d' → 3, '5 nights' → 5)" },
              days: { type: "number", description: "Number of DAYS in this city = nights + 1 (e.g. '3n4d' → 4, '5 nights' → 6)" },
              country: { type: ["string", "null"] },
              needs_city: { type: "boolean" },
              must_visit: { type: "array", items: { type: "string" } },
              preferred_hotel: { type: ["string", "null"], description: "ONLY specific named hotel/resort (e.g. 'Shangri-La', 'Hilton', 'JW Marriott'). NOT area descriptions like 'KLCC hotel' or 'beach resort'." },
              hotel_area: { type: ["string", "null"], description: "Area/neighborhood preference (e.g. 'KLCC', 'Batu Ferringhi', 'Sentosa', 'near beach', 'city center')" },
              hotel_type: { type: ["string", "null"], description: "Property type preference (e.g. 'resort', 'boutique', 'villa', 'guesthouse', 'apartment')" },
              self_managed_nights: { type: ["number", "null"], description: "Number of nights the traveler will arrange their own accommodation (e.g. staying with friends/family, Airbnb, or 'self managed'). Extract from phrases like '4 nights self managed', 'own accommodation for 3 nights', 'staying with relatives'. null if not mentioned." },
              free_days: { type: ["array", "null"], items: { type: "number" }, description: "Day numbers (1-indexed) the user wants as free/rest days with no activities. Extract from 'day 3 free', 'rest on day 2', 'no activities day 4', etc. null if not mentioned." }
            },
            required: ["name", "nights"]
          }
        },
        depart_date: { type: ["string", "null"], description: "YYYY-MM-DD format" },
        return_date: { type: ["string", "null"], description: "YYYY-MM-DD format" },
        duration_days: { type: ["number", "null"], description: "Total trip days = sum of all city nights + 1. MUST equal the sum of city nights + 1." },
        adults: { type: ["number", "null"] },
        children: { type: ["number", "null"] },
        infants: { type: ["number", "null"] },
        travelers_confirmed: { type: "boolean", description: "True if exact adult/child/infant breakdown is known" },
        travel_type: { type: ["string", "null"], enum: ["solo", "couple", "honeymoon", "family", "group", "business", null] },
        travel_style: { type: ["string", "null"], enum: ["budget", "comfortable", "luxury", null] },
        cabin_class: { type: ["string", "null"], enum: ["Economy", "Premium Economy", "Business", "First", null] },
        selection_priority: { type: ["string", "null"], enum: ["cheapest", "best_value", "luxury", null] },
        prefer_direct: { type: "boolean" },
        hotel_stars: { type: ["number", "null"] },
        include_breakfast: { type: "boolean" },
        request_type: { type: "string", enum: ["flight_only", "hotel_only", "full_trip", "unknown"] },
        user_language: { type: "string", description: "Language the user is writing in (not place names)" },
        missing_critical: {
          type: "array",
          items: { type: "string", enum: ["destination", "destination_city", "origin", "dates_or_duration", "travelers"] },
          description: "Only fields truly missing from the entire conversation"
        },
        hotel_city_name: { type: ["string", "null"] },
        budget_min: { type: ["number", "null"] },
        budget_max: { type: ["number", "null"] },
        budget_currency: { type: ["string", "null"] },
        user_must_visit: { type: ["array", "null"], items: { type: "string" } },
        user_preferred_hotels: { type: ["object", "null"] },
        user_special_notes: { type: ["array", "null"], items: { type: "string" } }
      },
      required: ["request_type", "user_language", "missing_critical", "travelers_confirmed", "prefer_direct", "include_breakfast"]
    }
  }
};

// Legacy prompt for Gemini fallback (no tool calling) — minimal, let AI think
const EXTRACT_PROMPT_LEGACY = `You are a travel parameter extractor. Read the conversation and extract trip details as JSON.

TODAY: ${new Date().toISOString().split("T")[0]}

CRITICAL DURATION RULES:
- city.nights = number of NIGHTS in that city.
- city.days = city.nights + 1.
- NxD notation: "3N4D" → nights=3, days=4.
- duration_days = sum of all city nights + 1.
- CITY-STATES: Singapore, Hong Kong, Macau are CITIES — always include them in the cities array with their own nights/days. NEVER skip them.

HOTEL EXTRACTION — CRITICAL:
- preferred_hotel: ONLY specific named hotels (e.g. "Shangri-La", "Hilton"). NOT area descriptions.
- hotel_area: Area/neighborhood (e.g. "KLCC", "Batu Ferringhi", "near beach").
- hotel_type: Property type (e.g. "resort", "boutique", "villa").
- "KLCC view hotel" → preferred_hotel=null, hotel_area="KLCC"
- "Batu Ferringhi resort" → preferred_hotel=null, hotel_area="Batu Ferringhi", hotel_type="resort"
- "any hotel" / "AI pick best" → all null
- user_special_notes: passes, transport preferences, experience modifiers only.

Only flag fields as missing_critical if truly absent from the entire conversation.

Respond ONLY with a JSON code block:
\`\`\`json
{
  "origin_city": "string|null", "origin_airport": "string|null",
  "destination_city": "string|null", "destination_country": "string|null", "destination_airport": "string|null",
  "cities": "[{name, nights, days, country, needs_city, must_visit[], preferred_hotel (ONLY real hotel brand names), hotel_area (neighborhood/zone), hotel_type (resort/villa/boutique/etc), self_managed_nights, free_days}]|null",
  "depart_date": "YYYY-MM-DD|null", "return_date": "YYYY-MM-DD|null", "duration_days": "number|null",
  "adults": "number|null", "children": "number|null", "infants": "number|null", "travelers_confirmed": "boolean",
  "travel_type": "solo|couple|honeymoon|family|group|business|null",
  "travel_style": "budget|comfortable|luxury|null", "cabin_class": "Economy|Premium Economy|Business|First|null",
  "selection_priority": "cheapest|best_value|luxury|null", "prefer_direct": "boolean",
  "hotel_stars": "3|4|5|null", "include_breakfast": "boolean",
  "request_type": "flight_only|hotel_only|full_trip|unknown",
  "user_language": "string",
  "missing_critical": "string[]",
  "hotel_city_name": "string|null",
  "budget_min": "number|null", "budget_max": "number|null", "budget_currency": "string|null",
  "user_must_visit": "string[]|null",
  "user_preferred_hotels": "{city: hotel_name}|null",
  "user_special_notes": "string[]|null"
}
\`\`\``;

// Phase 2: Generate itinerary with real price data
// [REMOVED] Planner-side getItineraryPrompt deleted — canonical prompt lives in ai-trip-generate only.


// Rich conversational system prompt — human-like, sales-focused
const CHAT_PROMPT_EN = `You are **Vela AI** — TravelVela's personal travel concierge. You're warm, confident, and genuinely passionate about helping people travel. You speak like a knowledgeable friend who happens to work in travel — never robotic, never corporate.

**YOUR PERSONALITY:**
- Warm, enthusiastic, and naturally conversational — like texting a friend who's a travel expert
- Confident and decisive — don't hedge or over-qualify. Give clear recommendations
- Sales-minded but not pushy — create excitement about destinations, subtly drive toward booking
- Empathetic — read the mood. If someone's stressed, be reassuring. If excited, match their energy
- Use occasional emojis naturally (✈️ 🏖️ ✨ 🎉) but don't overdo it

**CONVERSATION RULES:**

1. **Never re-ask what the user already told you.** Scan the FULL conversation history. If they said "Kolkata" → destination is set. Acknowledge ALL info given so far.

2. **First city = DESTINATION** unless they say "from X". "kolkata" → destination. "from dhaka" → origin.

3. **Country ≠ City.** If user says "Thailand" → suggest top cities with personality: "Thailand is amazing! 🏖️ Are you thinking Bangkok for the buzz, Phuket for beaches, or Chiang Mai for mountains?"

4. **Acknowledge warmly, then ask ONE question** in this priority:
   - Destination city (if only country given)
   - Origin ("Where will you be travelling from?")
   - Travel dates ("When are you thinking of going?")
   - Duration (SKIP if already given like "3n4d")
   - Travel type (solo/couple/family/group/honeymoon)
   - Passengers ("How many travellers? Any kids or infants?")
   Never combine two questions. Never ask about travel_style — it defaults automatically.

5. **Multi-info messages** — acknowledge ALL pieces enthusiastically. "5 days. Couple. Budget." → "A 5-day getaway for two on a budget — love it! ✨ Where are you travelling from?"

6. **BREVITY is king.** Max 2-3 short sentences. Sound like a text message, not an email. No repeating back details they just told you.
   - BAD: "I understand you want to visit Singapore for 3 nights and Langkawi for 2 nights, totaling 5 nights across 2 cities..."
   - GOOD: "Multi-city trip — great plan! ✨ When do you want to start?"

7. **FORMATTING — Make responses scannable and beautiful:**
   - Use **bold** for key info (city names, dates, traveler counts)
   - When listing cities/options, use bullet points or line breaks — NEVER cram them into a single paragraph
   - Separate distinct topics with line breaks
   - When confirming trip details, structure as a short summary block:
     - ✅ **Destination:** Singapore, Langkawi, Penang, KL
     - ✅ **Dates:** Apr 22 – Apr 30
     - ✅ **Travelers:** 2 Adults + 1 Infant
   - When asking about cities/areas, list each on its own line with the city bolded
   - Keep individual lines short — max 1-2 sentences per line
   - BAD: "A budget-friendly adventure through Singapore, Langkawi, Penang, and Kuala Lumpur for 2 adults and 1 infant, starting from Dhaka on April 22nd. I love it! Now, to make sure I've got everything perfect for your multi-city adventure, could you confirm the specific cities/areas you'd like to explore in Langkawi, Penang, and Kuala Lumpur? Langkawi: Penang: Kuala Lumpur: Let me know your preferences"
   - GOOD: "Love this plan! ✨\n\n✅ **4 cities** · **Budget-friendly** · **2 Adults + 1 Infant**\n📍 Singapore → Langkawi → Penang → KL\n📅 Apr 22 from Dhaka\n\nJust need to confirm areas:\n\n🏝️ **Langkawi** — Pantai Cenang (beaches) or Kuah Town?\n🏛️ **Penang** — Georgetown (heritage) or Batu Ferringhi (beach)?\n🏙️ **KL** — KLCC area or Bukit Bintang?\n\nOr say **'you pick'** and I'll choose the best! 🗺️"

7. **Create excitement about destinations.** Don't just acknowledge — sell the dream:
   - BAD: "Dubai noted as destination."
   - GOOD: "Dubai — incredible choice! 🌟 The skyline, the beaches, the food... you're going to love it!"

8. **Greetings** — introduce yourself ONLY on first message: "Hey! I'm Vela ✈️ — your personal travel planner. Where's your next adventure taking you?"

9. **Say "travelling from"** — never "flying from" (not everyone flies).

10. **Travel questions** (weather, safety, visa, flight status) — answer helpfully using any API data provided, then naturally guide back to trip planning if appropriate.

11. **Off-topic** — be human about it. Quick friendly response, then steer back naturally. Never say "I am just an AI" or "as an AI." You're Vela, a travel expert.

12. **When the user seems ready** — create urgency naturally: "Want me to find the best deals for those dates? Prices tend to go up closer to travel! 🎯"

13. **Invoice integrity** — never agree to issue documents showing different amounts from actual purchase price.

14. **When unsure, ask naturally.** "Just to make sure I get this right — did you mean...?"

${CORE_RULES}`;


// ── Language detection & session system ──

interface LanguageDetection {
  language: string;
  confidence: number; // 0-1
  isMixed: boolean;
  dominantLanguage: string;
}

interface LanguageSession {
  current_language: string;
  last_strong_language: string;
  user_language_switched: boolean;
}

function detectLanguageRich(text: string, aiDetectedLang?: string): LanguageDetection {
  const t = text.trim();
  if (!t) return { language: "English", confidence: 0.5, isMixed: false, dominantLanguage: "English" };

  // ── Step 1: Non-Latin script detection (unambiguous, high confidence) ──
  const scriptMap: [RegExp, string][] = [
    [/[\u0980-\u09FF]/g, "Bengali"],
    [/[\u0600-\u06FF]/g, "Arabic"],
    [/[\u0900-\u097F]/g, "Hindi"],
    [/[\u4E00-\u9FFF]/g, "Chinese"],
    [/[\u3040-\u309F\u30A0-\u30FF]/g, "Japanese"],
    [/[\uAC00-\uD7AF]/g, "Korean"],
    [/[\u0E00-\u0E7F]/g, "Thai"],
    [/[\u0400-\u04FF]/g, "Russian"],
    [/[\u0B80-\u0BFF]/g, "Tamil"],
    [/[\u0C00-\u0C7F]/g, "Telugu"],
  ];

  const detectedScripts: { lang: string; count: number }[] = [];
  for (const [regex, lang] of scriptMap) {
    const matches = t.match(regex);
    if (matches && matches.length > 0) {
      detectedScripts.push({ lang, count: matches.length });
    }
  }

  // Check for Latin characters too
  const latinMatches = t.match(/[a-zA-Z]/g);
  const latinCount = latinMatches?.length || 0;
  const totalChars = t.replace(/[\s\d.,!?'"()\-:;@#$%&*+=/\\|<>[\]{}~`^_]/g, "").length || 1;

  if (detectedScripts.length > 0) {
    // Sort by character count
    detectedScripts.sort((a, b) => b.count - a.count);
    const primary = detectedScripts[0];
    const nonLatinTotal = detectedScripts.reduce((s, d) => s + d.count, 0);
    const nonLatinRatio = nonLatinTotal / totalChars;
    const isMixed = latinCount > 3 && nonLatinRatio < 0.7;
    const confidence = Math.min(1, 0.6 + nonLatinRatio * 0.4);
    return {
      language: primary.lang,
      confidence,
      isMixed,
      dominantLanguage: primary.lang,
    };
  }

  // ── Step 2: Latin-script only — check Romanized patterns ──
  const banglishWords = /\b(ami|amra|kothay|kobe|din|raat|jete|chai|korbo|korte|lagbe|bhai|vai|achen|thik|jabe|ghure|jaiga|desh|shob|koto|bolo|bolen|dekhi|hobe|bolun|apni|tumi|amader)\b/gi;
  const banglishMatches = t.match(banglishWords) || [];

  const hinglishWords = /\b(mujhe|humko|jaana|hai|kitne|chahiye|karna|batao|bataiye|ghumne|safar|udna|hum|main|kaisa|kaise|kahaan|kab|mein|nahi|acha|theek|haan|zaroor|bohot|bahut)\b/gi;
  const hinglishMatches = t.match(hinglishWords) || [];

  const frenchWords = /\b(je|nous|vous|bonjour|merci|oui|non|pour|avec|dans|jours|ville|voyage|aller|partir|cherche|veux|voudrais)\b/gi;
  const frenchMatches = t.match(frenchWords) || [];

  const spanishWords = /\b(quiero|necesito|viaje|viajar|ciudad|dias|noches|vuelo|playa|desde|hasta|hola|gracias|por favor)\b/gi;
  const spanishMatches = t.match(spanishWords) || [];

  const malayWords = /\b(saya|nak|pergi|hari|malam|tempat|penerbangan|berapa|boleh|cuti|percutian|bajet)\b/gi;
  const malayMatches = t.match(malayWords) || [];

  // Find the best Romanized match
  const romanizedCandidates = [
    { lang: "Bengali", count: banglishMatches.length, threshold: 2 },
    { lang: "Hindi", count: hinglishMatches.length, threshold: 2 },
    { lang: "French", count: frenchMatches.length, threshold: 2 },
    { lang: "Spanish", count: spanishMatches.length, threshold: 2 },
    { lang: "Malay", count: malayMatches.length, threshold: 2 },
  ].filter(c => c.count >= c.threshold)
   .sort((a, b) => b.count - a.count);

  if (romanizedCandidates.length > 0) {
    const best = romanizedCandidates[0];
    const words = t.split(/\s+/).length;
    const ratio = best.count / words;
    // Mixed if strong Romanized signal but lots of English too
    const isMixed = ratio < 0.4 && words > 4;
    const confidence = Math.min(1, 0.4 + ratio * 0.6);
    return {
      language: best.lang,
      confidence,
      isMixed,
      dominantLanguage: best.lang,
    };
  }

  // ── Step 3: Trust AI detection for other Latin-script languages ──
  const nonLatinAiLangs = new Set(["Bengali", "Hindi", "Arabic", "Chinese", "Japanese", "Korean", "Thai", "Russian", "Urdu", "Tamil", "Telugu"]);
  if (aiDetectedLang && !nonLatinAiLangs.has(aiDetectedLang) && aiDetectedLang !== "English") {
    return {
      language: aiDetectedLang,
      confidence: 0.6,
      isMixed: false,
      dominantLanguage: aiDetectedLang,
    };
  }

  // ── Step 4: Default to English ──
  return {
    language: "English",
    confidence: 0.8,
    isMixed: false,
    dominantLanguage: "English",
  };
}

/**
 * Resolve the response language using strict priority:
 * 1. Explicit user request ("reply in X language") → use that
 * 2. Detected language from latest message (if confidence >= 0.5)
 * 3. Fallback to previous session language
 * 4. Default to English
 */
function resolveSessionLanguage(
  latestMessage: string,
  detection: LanguageDetection,
  session: LanguageSession | null,
): LanguageSession {
  const prev = session || { current_language: "English", last_strong_language: "English", user_language_switched: false };

  // Priority 1: Explicit language request
  const explicitMatch = latestMessage.match(/\b(?:reply|respond|speak|talk|answer|write)\s+(?:in|to me in)\s+(\w+)/i);
  if (explicitMatch) {
    const requested = explicitMatch[1].charAt(0).toUpperCase() + explicitMatch[1].slice(1).toLowerCase();
    return {
      current_language: requested,
      last_strong_language: requested,
      user_language_switched: requested !== prev.current_language,
    };
  }

  // Priority 2: Detected language with good confidence
  if (detection.confidence >= 0.5 && !detection.isMixed) {
    const lang = detection.language;
    return {
      current_language: lang,
      last_strong_language: lang,
      user_language_switched: lang !== prev.current_language,
    };
  }

  // If mixed language, use dominant
  if (detection.isMixed && detection.confidence >= 0.4) {
    const lang = detection.dominantLanguage;
    return {
      current_language: lang,
      last_strong_language: lang,
      user_language_switched: lang !== prev.current_language,
    };
  }

  // Priority 3: Low confidence → keep previous session language
  if (detection.confidence < 0.5) {
    return {
      current_language: prev.last_strong_language,
      last_strong_language: prev.last_strong_language,
      user_language_switched: false,
    };
  }

  // Priority 4: Default English
  return {
    current_language: "English",
    last_strong_language: prev.last_strong_language || "English",
    user_language_switched: prev.current_language !== "English",
  };
}

/** Build the language lock directive for system prompts */
function buildLanguageLock(session: LanguageSession): string {
  const lang = session.current_language;
  return `\n\nLANGUAGE LOCK: You MUST reply in ${lang}. Do NOT use any other language. Do NOT mix languages. Keep responses short, chat-friendly — like a real travel agent. No long paragraphs.`;
}

// Backward-compatible wrapper
function detectUserLanguage(text: string, aiDetectedLang?: string): string {
  return detectLanguageRich(text, aiDetectedLang).language;
}

// ── AI-powered intent classifier (Gemini 2.5 Flash Lite — ultra fast, ~200ms, ~$0.0001/call) ──
const INTENT_CLASSIFY_PROMPT = `You are an intent classifier for a travel planning chatbot. Given the user's latest message and conversation state, classify the intent.

INTENTS:
- "new_trip" — User is starting a new trip request OR providing trip details (destination, dates, travelers, budget, answering bot's info-gathering questions like city names, "2 adults", "5 days", "from Dhaka").
- "modify_trip" — User wants to change something specific about an EXISTING generated itinerary (swap hotel, change day, add activity, different flight, extend trip, remove an activity, "make it luxury", "change hotel to 5 star").
- "clarification" — User is asking ABOUT the existing itinerary without requesting changes (why this hotel? how is day 2? looks good, is the budget ok?, are you sure?).
- "travel_query" — User is asking about flight status (e.g. "is BS326 on time?", "check flight EK502", "status of SQ321"), or visa requirements (e.g. "do I need a visa for Japan?", "visa for Bangladesh passport to Thailand", "what visa do I need?").
- "chat" — Everything else: greetings, insults, off-topic, emotions, general non-travel questions, thank you, goodbye, jokes, frustration.

CRITICAL RULES:
- If no itinerary exists yet: short answers like city names, numbers, "yes" → "new_trip" (they're answering info questions)
- If itinerary EXISTS: "are you stupid", "lol", "wtf", "nice", "ok", "thanks" → "chat"
- If itinerary EXISTS: "looks good", "is day 2 ok?", "why this flight?" → "clarification"
- If itinerary EXISTS: "change the hotel", "I want 5 star", "remove day 3", "add a beach day" → "modify_trip"
- If itinerary EXISTS: new destination/dates without "also"/"add" → "new_trip" (starting over)
- Flight status or visa questions → ALWAYS "travel_query" regardless of itinerary state

Respond with ONLY one word: new_trip, modify_trip, clarification, travel_query, or chat`;

type IntentType = "new_trip" | "modify_trip" | "clarification" | "travel_query" | "chat";

async function classifyIntent(
  lastUserMessage: string,
  hasExistingItinerary: boolean,
  recentContext: string
): Promise<IntentType> {
  const classifyTimer = timer();
  const lower = lastUserMessage.toLowerCase().trim();

  // ── Ultra-fast regex pre-filter for travel queries (flight status / visa) ──
  if (/\b(flight\s*status|status\s*of\s*flight|is\s+[A-Z]{2}\d{1,4}|check\s+flight|track\s+flight|flight\s+[A-Z]{2}\s*\d{1,4}\b.*\b(status|delay|on\s*time|cancel|land|depart))/i.test(lastUserMessage) ||
      /\b[A-Z]{2}\d{1,4}\b/i.test(lastUserMessage) && /\b(status|on\s*time|delay|cancel|gate|terminal|track|check|land|depart|arriv|how|is|where|when|update|what)\b/i.test(lower)) {
    console.log("[Intent] Regex fast-path: travel_query (flight status)");
    return "travel_query";
  }
  if (/\b(visa|passport)\b/i.test(lower) && /\b(need|require|for|to|from|get|apply|check|do i)\b/i.test(lower)) {
    console.log("[Intent] Regex fast-path: travel_query (visa)");
    return "travel_query";
  }
  if (/\b(holiday|holidays|public\s*holiday|festival|festivals)\b/i.test(lower) && /\b(when|what|which|next|upcoming|list|in\b|are there)\b/i.test(lower)) {
    console.log("[Intent] Regex fast-path: travel_query (holiday)");
    return "travel_query";
  }

  // ── Ultra-fast regex pre-filter for obvious cases (skip AI call) ──
  if (/^(hi|hello|hey|thanks|thank you|ok|okay|bye|good morning|good evening|bonjour|hola|ciao|namaste|assalamu|salam)[\s!.?]*$/i.test(lower)) {
    console.log("[Intent] Regex fast-path: chat (greeting)");
    return "chat";
  }
  if (/^[\s😂😡😤🤦👍👎❤️🔥💯🙏✈️🏨🎉\u200d]+$/u.test(lower) || lower.length === 0) {
    console.log("[Intent] Regex fast-path: chat (emoji/empty)");
    return "chat";
  }

  // ── Gemini 2.5 Flash Lite for intent classification (~200ms, ~$0.0001/call) ──
  try {
    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!GOOGLE_AI_API_KEY) {
      console.warn("[Intent] No GOOGLE_AI_API_KEY, falling back to regex");
      return fallbackRegexClassify(lower, hasExistingItinerary);
    }

    const userPrompt = `Itinerary already generated: ${hasExistingItinerary ? "YES" : "NO"}
Recent conversation:
${recentContext.slice(0, 600)}

Latest user message: "${lastUserMessage}"

Intent:`;

    const controller = new AbortController();
    const abortTimeout = setTimeout(() => controller.abort(), 5000); // 5s for Flash Lite

    const url = `${GEMINI_BASE}/gemini-2.5-flash-lite:generateContent?key=${GOOGLE_AI_API_KEY}`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [
          { role: "user", parts: [{ text: INTENT_CLASSIFY_PROMPT }] },
          { role: "model", parts: [{ text: "I'll classify the intent." }] },
          { role: "user", parts: [{ text: userPrompt }] },
        ],
        generationConfig: { temperature: 0.1, maxOutputTokens: 10, thinkingConfig: { thinkingBudget: 0 } },
      }),
    });
    clearTimeout(abortTimeout);

    if (!resp.ok) {
      console.warn(`[Intent] Gemini Flash Lite returned ${resp.status}, falling back to regex`);
      return fallbackRegexClassify(lower, hasExistingItinerary);
    }

    const data = await resp.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const raw = rawText.trim().toLowerCase().replace(/[^a-z_]/g, "");

    if (["new_trip", "modify_trip", "clarification", "travel_query", "chat"].includes(raw)) {
      const ms = classifyTimer.log(`Intent AI → ${raw}`);
      console.log(`[Intent] Gemini Flash Lite: "${lastUserMessage.slice(0, 60)}" → ${raw} (itinerary=${hasExistingItinerary}, ${ms}ms)`);
      return raw as IntentType;
    }

    console.warn(`[Intent] AI returned unknown "${raw}", regex fallback`);
    return fallbackRegexClassify(lower, hasExistingItinerary);
  } catch (err: any) {
    console.warn(`[Intent] AI error: ${err.message}, regex fallback`);
    return fallbackRegexClassify(lower, hasExistingItinerary);
  }
}

// Regex fallback if AI classifier fails
function fallbackRegexClassify(lower: string, hasItinerary: boolean): IntentType {
  if (isPostItineraryClarificationRegex(lower)) return hasItinerary ? "clarification" : "chat";
  if (isTripLikeMessageRegex(lower)) return "new_trip";
  return "chat";
}

// ── Minor fix detection (day-specific OR general itinerary tweaks) ──
interface MinorFixMatch {
  dayIndex: number | null; // null = whole itinerary, 0-based if specific day
  action: "fix_duplicates" | "remove_activity" | "reorder" | "general_fix" | "add_activity" | "change_time" | "swap_activity";
}

function detectMinorFix(message: string): MinorFixMatch | null {
  const lower = message.toLowerCase().trim();

  // Exclude requests that clearly need full regeneration
  if (/\b(regenerat|start over|new trip|new itinerary|plan again|from scratch|completely different|extend.*trip|add.*city|add.*day|change.*destination|different.*destination)\b/i.test(lower)) {
    return null;
  }

  // Match "day N" or "day-N" patterns (optional — many minor fixes don't reference a day)
  let dayNum: number | null = null;
  const dayPatterns = [
    /\bday\s*[-#]?\s*(\d+)\b/i,
    /\b(\d+)(?:st|nd|rd|th)\s*day\b/i,
  ];
  for (const pat of dayPatterns) {
    const m = lower.match(pat);
    if (m) { dayNum = parseInt(m[1], 10); break; }
  }
  if (dayNum !== null && (dayNum < 1 || dayNum > 30)) dayNum = null;

  // Action patterns — ordered by specificity
  const fixPatterns: { pattern: RegExp; action: MinorFixMatch["action"] }[] = [
    { pattern: /\b(duplicat|same\s+(activity|place|thing)|repeated|overlap|identical|two\s+of|twice)\b/i, action: "fix_duplicates" },
    // "remove X and add Y" → swap, not just remove
    { pattern: /\b(remove|delete|drop|take out)\b.*\b(and|&|then)\b.*\b(add|include|put|replace with)\b/i, action: "swap_activity" },
    { pattern: /\b(remove|delete|drop|get rid of|take out|skip)\b/i, action: "remove_activity" },
    { pattern: /\b(reorder|rearrange|shuffle|reorganize|cluster|better order|logical order)\b/i, action: "reorder" },
    { pattern: /\b(add|include|insert|put in|squeeze in)\b.*\b(activity|attraction|place|visit|stop)\b/i, action: "add_activity" },
    { pattern: /\b(change|move|shift|adjust|earlier|later)\b.*\b(time|timing|schedule|slot|morning|evening|afternoon)\b/i, action: "change_time" },
    { pattern: /\b(swap|replace|switch|instead of|better alternative)\b/i, action: "swap_activity" },
    { pattern: /\b(fix|solve|correct|improve|too many|crowded|empty|sparse|boring|wrong|issue|problem|error|messed up|broken|weird)\b/i, action: "general_fix" },
    { pattern: /\b(identify|check|find)\b.*\b(duplicat|issue|problem|error|wrong)\b/i, action: "fix_duplicates" },
    { pattern: /\b(identify|check|find|detect)\b.*\b(and|then|&)\b.*\b(solve|fix|remove|correct)\b/i, action: "general_fix" },
  ];

  for (const { pattern, action } of fixPatterns) {
    if (pattern.test(lower)) {
      return { dayIndex: dayNum !== null ? dayNum - 1 : null, action };
    }
  }

  return null;
}


function isTripLikeMessageRegex(lower: string): boolean {
  if (/\b(visa|passport required|do i need|entry requirement|is it safe|weather in|currency)\b/i.test(lower) &&
      /\?|do i|can i|should i|what|how|is it|are there/i.test(lower)) return false;
  if (/\b(when|what|which|next|upcoming|list)\b/i.test(lower) && /\b(holiday|holidays|public\s*holiday|festival|festivals)\b/i.test(lower)) return false;
  if (isPostItineraryClarificationRegex(lower)) return false;
  const wordCount = lower.split(/\s+/).length;
  if (/\d/.test(lower) && wordCount >= 3) return true;
  if (lower.length >= 50 && !/^\s*(what|how|why|when|where|is|are|do|does|can|should)\b.*\?\s*$/i.test(lower)) return true;
  if (/\b(trip|travel|fly|flight|hotel|book|plan|tour|visit|go to|going to|vacation|holiday|honeymoon|itinerary|budget|days?\s+in|nights?\s+in|from\s+\w+\s+to|couple|solo|family|group|luxury|beach|resort|package)\b/i.test(lower)) return true;
  if (lower.length >= 3 && lower.length <= 50) {
    if (/^[\w\s\-'.]+$/i.test(lower) || /\d/.test(lower)) return true;
  }
  return false;
}

// Regex clarification/insult detection (fallback)
function isPostItineraryClarificationRegex(lower: string): boolean {
  const patterns = [
    /^how\s+(did\s+you|you\s+managed|come|is\s+it|are\s+the|about|many)/,
    /^why\s+(did|is|are|do|does|not|only|so)/,
    /^what\s+(about|if|is|are|do|does|happened)/,
    /^can\s+you\s+(explain|tell|clarify|show|change|reduce|increase)/,
    /\b(are\s+you\s+sure|looks?\s+(good|ok|fine|right|correct))\b/,
    /\b(stupid|idiot|dumb|useless|suck|terrible|worst|broken|wtf|lol|lmao|bruh|smh|omg)\b/,
    /\b(are\s+you\s+(stupid|dumb|deaf|blind|crazy|mad|kidding|serious|joking))\b/,
    /\b(not\s+what\s+i\s+(asked|said|meant|wanted))\b/,
    /^(no+|yes+|nah|nope|yep|yeah|yea|wow|ugh|hmm+|huh|oh|ah|meh|nice|cool|great|awesome|perfect|thanks?|ok(ay)?|sure|fine|whatever|seriously|damn|omg|wtf|lol|haha)[\s!?.]*$/i,
  ];
  for (const pat of patterns) { if (pat.test(lower)) return true; }
  return false;
}

// Check if conversation is trip-related
function isConversationTripRelated(messages: { role: string; content: string }[]): boolean {
  if (messages.length >= 2) return true;
  for (const m of messages) {
    if (m.role === "user" && isTripLikeMessageRegex(m.content.toLowerCase().trim())) return true;
    if (m.role === "assistant" && /\b(travel|trip|destination|where|when|flying|plan|itinerary)\b/i.test(m.content)) return true;
  }
  return false;
}

// ── Preference-only modification detector ──
// Returns refinement params if the message is a simple preference tweak (no full regen needed)
function detectPreferenceUpdate(message: string): { refinements: Record<string, any>; defaultAck: string } | null {
  const lower = message.toLowerCase().trim();
  const refinements: Record<string, any> = {};
  let defaultAck = "✅ Got it! Applying your changes now...";

  // Direct flight preference
  if (/\b(direct\s*flight|nonstop|non[\s-]stop|no\s*layover|no\s*transit|no\s*stop|no\s*connecting|direct\s*only)\b/i.test(lower)) {
    refinements.prefer_direct = true;
    defaultAck = "✅ Filtering for direct flights only...";
  }

  // Hotel star preference
  const starMatch = lower.match(/\b(\d)\s*star\s*(hotel)?/);
  if (starMatch) {
    const stars = parseInt(starMatch[1]);
    if (stars >= 1 && stars <= 5) {
      refinements.hotel_stars = stars;
      defaultAck = `✅ Switching to ${stars}-star hotels...`;
    }
  }

  // Cabin class changes
  if (/\b(business\s*class|upgrade.*business)\b/i.test(lower)) {
    refinements.cabin_class = "Business";
    defaultAck = "✅ Upgrading to Business class...";
  } else if (/\b(first\s*class|upgrade.*first)\b/i.test(lower)) {
    refinements.cabin_class = "First";
    defaultAck = "✅ Upgrading to First class...";
  } else if (/\b(premium\s*economy)\b/i.test(lower)) {
    refinements.cabin_class = "Premium Economy";
    defaultAck = "✅ Switching to Premium Economy...";
  } else if (/\b(economy\s*class|downgrade.*economy)\b/i.test(lower)) {
    refinements.cabin_class = "Economy";
    defaultAck = "✅ Switching to Economy class...";
  }

  // Travel style / budget level changes — these need full re-search, not preference-only
  // Mark them so they're excluded from preference-only shortcut when itinerary exists
  if (/\b(make\s*it\s*luxury|luxury\s*style|go\s*luxury|want\s*luxury|travel\s*style:\s*luxury)\b/i.test(lower)) {
    refinements.travel_style = "luxury";
    refinements.selection_priority = "luxury";
    refinements._needs_regeneration = true;
    defaultAck = "✅ Upgrading to luxury options...";
  } else if (/\b(make\s*it\s*budget|go\s*budget|cheap(er)?|budget[\s-]*style|save\s*money|travel\s*style:\s*budget)\b/i.test(lower)) {
    refinements.travel_style = "budget";
    refinements.selection_priority = "cheapest";
    refinements._needs_regeneration = true;
    defaultAck = "✅ Switching to budget-friendly options...";
  } else if (/\b(make\s*it\s*comfortable|comfortable\s*style|travel\s*style:\s*comfortable)\b/i.test(lower)) {
    refinements.travel_style = "comfortable";
    refinements._needs_regeneration = true;
    defaultAck = "✅ Switching to comfortable options...";
  }

  // Breakfast preference
  if (/\b(with\s*breakfast|include\s*breakfast|breakfast\s*included|add\s*breakfast)\b/i.test(lower)) {
    refinements.include_breakfast = true;
    defaultAck = "✅ Looking for hotels with breakfast included...";
  } else if (/\b(no\s*breakfast|without\s*breakfast|remove\s*breakfast)\b/i.test(lower)) {
    refinements.include_breakfast = false;
    defaultAck = "✅ Removing breakfast preference...";
  }

  // Only return if we found actual preference changes
  if (Object.keys(refinements).length === 0) return null;
  
  console.log(`[PreferenceDetect] "${message.slice(0, 60)}" → refinements:`, JSON.stringify(refinements));
  return { refinements, defaultAck };
}


async function getAirlineContext(message: string): Promise<string> {
  try {
    const airlineMatch = message.match(/\b([A-Z]{2})\b/) || 
      message.match(/(biman|emirates|qatar|singapore|indigo|air india|thai|turkish|malaysia|cathay|saudia|spicejet|vistara|air asia|flydubai|lufthansa|british airways|ryanair|delta|united|american airlines|jetblue|southwest|ana|jal|korean air|etihad|oman air)/i);
    if (!airlineMatch) return "";

    const sb = getSupabaseAdmin();
    const searchTerm = airlineMatch[1] || airlineMatch[0];
    const { data: settings } = await sb
      .from("airline_settings")
      .select("*")
      .or(`airline_code.ilike.%${searchTerm}%,airline_name.ilike.%${searchTerm}%`)
      .limit(1);
    
    if (settings?.length) {
      const s = settings[0];
      return `\n\n[AIRLINE DATA from our system for ${s.airline_name} (${s.airline_code})]:\n- Cabin baggage: ${s.cabin_baggage}\n- Check-in baggage: ${s.checkin_baggage}\n- Cancellation: ${s.cancellation_policy}\n- Date change: ${s.date_change_policy}\n- Name change: ${s.name_change_policy}\n- No-show: ${s.no_show_policy}`;
    }
    return "";
  } catch {
    return "";
  }
}

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

// ── Trip Insights: Fetch top patterns for AI context ──
async function fetchTripInsights(sb: any): Promise<string> {
  try {
    // Get top destinations (last 90 days)
    const { data: topDests } = await sb
      .from("trip_insights")
      .select("destination, travel_type, travel_style, duration_days, budget_total, budget_currency, travelers, cabin_class, season")
      .gte("created_at", new Date(Date.now() - 90 * 86400000).toISOString())
      .order("created_at", { ascending: false })
      .limit(50);

    if (!topDests || topDests.length < 3) return "";

    // Aggregate patterns
    const destCounts: Record<string, number> = {};
    const destDurations: Record<string, number[]> = {};
    const destBudgets: Record<string, { total: number; currency: string; count: number }> = {};
    const destStyles: Record<string, Record<string, number>> = {};
    const destTypes: Record<string, Record<string, number>> = {};

    for (const row of topDests) {
      const d = row.destination?.toLowerCase();
      if (!d) continue;
      destCounts[d] = (destCounts[d] || 0) + 1;
      if (row.duration_days) {
        if (!destDurations[d]) destDurations[d] = [];
        destDurations[d].push(row.duration_days);
      }
      if (row.budget_total && row.budget_total > 0) {
        if (!destBudgets[d]) destBudgets[d] = { total: 0, currency: row.budget_currency || "USD", count: 0 };
        destBudgets[d].total += row.budget_total;
        destBudgets[d].count++;
      }
      if (row.travel_style) {
        if (!destStyles[d]) destStyles[d] = {};
        destStyles[d][row.travel_style] = (destStyles[d][row.travel_style] || 0) + 1;
      }
      if (row.travel_type) {
        if (!destTypes[d]) destTypes[d] = {};
        destTypes[d][row.travel_type] = (destTypes[d][row.travel_type] || 0) + 1;
      }
    }

    // Build top 5 destinations summary
    const sorted = Object.entries(destCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    if (sorted.length === 0) return "";

    let insights = "\n\n📊 **TRAVEL INSIGHTS FROM RECENT TRIPS (use to give better recommendations):**\n";
    insights += `Based on ${topDests.length} recent trip plans:\n`;

    for (const [dest, count] of sorted) {
      const avgDuration = destDurations[dest] 
        ? Math.round(destDurations[dest].reduce((a, b) => a + b, 0) / destDurations[dest].length) 
        : null;
      const avgBudget = destBudgets[dest] 
        ? Math.round(destBudgets[dest].total / destBudgets[dest].count) 
        : null;
      const topStyle = destStyles[dest] 
        ? Object.entries(destStyles[dest]).sort((a, b) => b[1] - a[1])[0]?.[0] 
        : null;
      const topType = destTypes[dest] 
        ? Object.entries(destTypes[dest]).sort((a, b) => b[1] - a[1])[0]?.[0] 
        : null;

      const name = dest.charAt(0).toUpperCase() + dest.slice(1);
      let line = `- ${name} (${count} trips)`;
      if (avgDuration) line += `, avg ${avgDuration} days`;
      if (avgBudget && destBudgets[dest]) line += `, avg budget ~${avgBudget} ${destBudgets[dest].currency}`;
      if (topStyle) line += `, most prefer ${topStyle}`;
      if (topType) line += `, mostly ${topType}`;
      insights += line + "\n";
    }

    insights += "\nUse these patterns to make better default suggestions (e.g., if most Bali trips are 5 days, suggest 5 days as default).";
    console.log(`[TripPlanner] Loaded ${topDests.length} trip insights, ${sorted.length} top destinations`);
    return insights;
  } catch (e: any) {
    console.error(`[TripPlanner] Failed to fetch insights: ${e.message}`);
    return "";
  }
}

// ── Log trip insight after itinerary generation ──
async function logTripInsight(sb: any, params: any, itineraryJson: any, tenantId?: string): Promise<void> {
  try {
    const month = params.depart_date ? new Date(params.depart_date).getMonth() + 1 : new Date().getMonth() + 1;
    const seasonMap: Record<number, string> = { 12: "winter", 1: "winter", 2: "winter", 3: "spring", 4: "spring", 5: "spring", 6: "summer", 7: "summer", 8: "summer", 9: "autumn", 10: "autumn", 11: "autumn" };

    await sb.from("trip_insights").insert({
      destination: params.destination_city || params.destination_country || "",
      origin: params.origin_city || "",
      duration_days: params.duration_days || itineraryJson?.duration_days || 5,
      travelers: params.adults || itineraryJson?.travelers || 1,
      travel_type: params.travel_type || null,
      travel_style: params.travel_style || null,
      cabin_class: params.cabin_class || "Economy",
      budget_total: itineraryJson?.budget_estimate?.total || params.budget_usd || 0,
      budget_currency: itineraryJson?.budget_estimate?.currency || "USD",
      hotel_stars: itineraryJson?.selected_hotel?.stars || null,
      selection_priority: params.selection_priority || "best_value",
      season: seasonMap[month] || "unknown",
      month,
      was_finalized: false,
      tenant_id: tenantId || null,
    });
    console.log("[TripPlanner] Trip insight logged successfully");
  } catch (e: any) {
    console.error(`[TripPlanner] Failed to log insight: ${e.message}`);
  }
}

// ── RAG: Embedding + Retrieval helpers ──
function buildTripSignature(params: any): string {
  const parts: string[] = [];
  if (params.destination_city || params.destination) parts.push(`destination: ${params.destination_city || params.destination}`);
  if (params.origin_city || params.origin) parts.push(`from: ${params.origin_city || params.origin}`);
  if (params.duration_days) parts.push(`${params.duration_days} days`);
  if (params.travelers || params.adults) parts.push(`${params.travelers || params.adults} travelers`);
  if (params.travel_type) parts.push(`travel type: ${params.travel_type}`);
  if (params.travel_style) parts.push(`style: ${params.travel_style}`);
  if (params.cabin_class && params.cabin_class !== "Economy") parts.push(`cabin: ${params.cabin_class}`);
  if (params.budget_total && params.budget_total > 0) parts.push(`budget: ~${params.budget_total} ${params.budget_currency || "USD"}`);
  return parts.join(", ");
}

function buildItinerarySummary(itineraryJson: any): string {
  if (!itineraryJson) return "";
  const parts: string[] = [];
  if (itineraryJson.trip_title) parts.push(itineraryJson.trip_title);
  if (itineraryJson.destination) parts.push(`Destination: ${itineraryJson.destination}`);
  if (itineraryJson.duration_days) parts.push(`${itineraryJson.duration_days} days`);
  if (itineraryJson.travelers) parts.push(`${itineraryJson.travelers} travelers`);
  if (itineraryJson.budget_estimate?.total) parts.push(`Budget: ${itineraryJson.budget_estimate.total} ${itineraryJson.budget_estimate.currency || "USD"}`);
  if (itineraryJson.selected_hotel?.name) parts.push(`Hotel: ${itineraryJson.selected_hotel.name} (${itineraryJson.selected_hotel.stars}★)`);
  if (itineraryJson.selected_flight?.summary) parts.push(`Flight: ${itineraryJson.selected_flight.summary}`);
  // Add day highlights
  if (itineraryJson.days?.length) {
    const dayHighlights = itineraryJson.days.slice(0, 5).map((d: any) => `Day ${d.day}: ${d.title}`).join("; ");
    parts.push(`Itinerary: ${dayHighlights}`);
  }
  if (itineraryJson.tips?.length) parts.push(`Tips: ${itineraryJson.tips.slice(0, 2).join("; ")}`);
  return parts.join(". ");
}

async function generateEmbedding(text: string): Promise<number[] | null> {
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiKey || !text) return null;
  
  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: text.slice(0, 8000),
      }),
    });
    
    if (!res.ok) {
      console.error(`[RAG] Embedding API error: ${res.status}`);
      return null;
    }
    
    const data = await res.json();
    return data?.data?.[0]?.embedding || null;
  } catch (e: any) {
    console.error(`[RAG] Embedding error: ${e.message}`);
    return null;
  }
}

async function storeItineraryEmbedding(sb: any, params: any, itineraryJson: any, tenantId?: string): Promise<void> {
  try {
    const signature = buildTripSignature(params);
    const summary = buildItinerarySummary(itineraryJson);
    if (!summary) return;
    
    const embeddingText = `${signature}. ${summary}`;
    const embedding = await generateEmbedding(embeddingText);
    if (!embedding) {
      console.log("[RAG] Skipping storage — no embedding generated");
      return;
    }
    
    // Store a compact version of the itinerary (strip live_flights/live_hotels arrays to save space)
    const compactItinerary = { ...itineraryJson };
    delete compactItinerary.live_flights;
    delete compactItinerary.live_hotels;
    delete compactItinerary.live_activities;
    
    await sb.from("trip_itinerary_embeddings").insert({
      destination: params.destination_city || itineraryJson?.destination || "",
      origin: params.origin_city || "",
      duration_days: params.duration_days || itineraryJson?.duration_days || 1,
      travelers: params.adults || itineraryJson?.travelers || 1,
      travel_type: params.travel_type || null,
      travel_style: params.travel_style || null,
      cabin_class: params.cabin_class || "Economy",
      budget_total: itineraryJson?.budget_estimate?.total || 0,
      budget_currency: itineraryJson?.budget_estimate?.currency || "USD",
      trip_signature: signature,
      itinerary_summary: summary.slice(0, 2000),
      itinerary_json: compactItinerary,
      embedding: `[${embedding.join(",")}]`,
      quality_score: 0,
      tenant_id: tenantId || null,
    });
    console.log("[RAG] Itinerary embedding stored successfully");
  } catch (e: any) {
    console.error(`[RAG] Failed to store embedding: ${e.message}`);
  }
}

async function retrieveSimilarTrips(sb: any, params: any): Promise<string> {
  try {
    const signature = buildTripSignature(params);
    if (!signature) return "";
    
    const embedding = await generateEmbedding(signature);
    if (!embedding) return "";
    
    const { data, error } = await sb.rpc("match_trip_itineraries", {
      query_embedding: `[${embedding.join(",")}]`,
      match_threshold: 0.65,
      match_count: 3,
    });
    
    if (error) {
      console.error(`[RAG] Similarity search error: ${error.message}`);
      return "";
    }
    
    if (!data || data.length === 0) {
      console.log("[RAG] No similar past trips found");
      return "";
    }
    
    console.log(`[RAG] Found ${data.length} similar past trips (similarities: ${data.map((d: any) => d.similarity.toFixed(2)).join(", ")})`);
    
    // Build few-shot context from similar trips
    let context = "\n\n🧠 **SIMILAR PAST TRIPS (use as reference for quality & structure — but DO NOT copy prices, use live data instead):**\n";
    
    for (let i = 0; i < data.length; i++) {
      const trip = data[i];
      context += `\n--- Past Trip ${i + 1} (${Math.round(trip.similarity * 100)}% similar) ---\n`;
      context += `${trip.itinerary_summary}\n`;
      
      // Include day structure as reference
      const itinerary = trip.itinerary_json;
      if (itinerary?.days?.length) {
        context += `Day structure: ${itinerary.days.map((d: any) => `Day ${d.day}: ${d.title} (${d.activities?.length || 0} activities)`).join(" | ")}\n`;
      }
      if (itinerary?.tips?.length) {
        context += `Tips: ${itinerary.tips.slice(0, 3).join("; ")}\n`;
      }
      if (itinerary?.selected_hotel) {
        context += `Hotel choice: ${itinerary.selected_hotel.name} (${itinerary.selected_hotel.stars}★)\n`;
      }
    }
    
    context += "\n**IMPORTANT:** Use these past trips as STRUCTURAL REFERENCE (day planning, activity ideas, tips). Do NOT copy their prices — always use the LIVE pricing data provided. Adapt the itinerary to this specific traveler's preferences.\n";
    
    // Increment usage counts (fire and forget)
    const ids = data.map((d: any) => d.id);
    sb.from("trip_itinerary_embeddings")
      .update({ usage_count: sb.rpc ? undefined : 0 })
      .in("id", ids)
      .then(() => {
        // Use raw SQL to increment
        for (const id of ids) {
          sb.rpc("increment_usage_count" as any, { row_id: id }).catch(() => {});
        }
      })
      .catch(() => {});
    
    return context;
  } catch (e: any) {
    console.error(`[RAG] Retrieval error: ${e.message}`);
    return "";
  }
}

// ── Cache helpers ──
// TTL: 30 min for flights (near dates), 1 hour for far dates; 2h hotels, 4h activities
const CACHE_TTL_MS: Record<string, number> = {
  flights: 30 * 60 * 1000,        // 30 minutes (default, overridden for far dates)
  flights_far: 60 * 60 * 1000,    // 1 hour (depart > 30 days away)
  hotels: 2 * 60 * 60 * 1000,     // 2 hours
  activities: 4 * 60 * 60 * 1000, // 4 hours
};

function buildCacheKey(type: string, params: Record<string, any>): string {
  // Create deterministic key from search params
  const parts: string[] = [type];
  if (type === "flights") {
    parts.push(params.origin_airport || "", params.destination_airport || "", params.depart_date || "", params.return_date || "", String(params.adults || 1), params.cabin_class || "Economy");
  } else if (type === "hotels") {
    parts.push(params.hotel_city_name || params.destination_city || "", params.depart_date || "", params.return_date || "", String(params.adults || 1));
  } else {
    parts.push(params.destination_city || "");
  }
  return parts.join("|").toLowerCase();
}

async function getCachedResults(sb: any, type: string, cacheKey: string): Promise<any[] | null> {
  try {
    const { data } = await sb
      .from("trip_search_cache")
      .select("results, result_count")
      .eq("cache_key", cacheKey)
      .gt("expires_at", new Date().toISOString())
      .single();
    
    if (data && data.result_count > 0) {
      console.log(`[TripPlanner] Cache HIT for ${type}: ${cacheKey} (${data.result_count} results)`);
      return data.results;
    }
    console.log(`[TripPlanner] Cache MISS for ${type}: ${cacheKey}`);
    return null;
  } catch {
    return null;
  }
}

async function setCacheResults(sb: any, type: string, cacheKey: string, params: any, results: any[], departDate?: string): Promise<void> {
  try {
    // Use longer TTL for far-out dates (>30 days)
    let ttlKey = type;
    if (type === "flights" && departDate) {
      const daysOut = Math.floor((new Date(departDate).getTime() - Date.now()) / (86400000));
      if (daysOut > 30) ttlKey = "flights_far";
    }
    const ttl = CACHE_TTL_MS[ttlKey] || CACHE_TTL_MS[type] || 30 * 60 * 1000;
    const expiresAt = new Date(Date.now() + ttl).toISOString();
    
    await sb
      .from("trip_search_cache")
      .upsert({
        cache_key: cacheKey,
        search_type: type,
        search_params: params,
        results,
        result_count: results.length,
        cached_at: new Date().toISOString(),
        expires_at: expiresAt,
      }, { onConflict: "cache_key" });
    
    console.log(`[TripPlanner] Cache SET for ${type}: ${cacheKey} (${results.length} results, TTL ${ttl / 60000}m)`);
  } catch (e: any) {
    console.error(`[TripPlanner] Cache SET error: ${e.message}`);
  }
}

// ── Lovable AI Gateway call (preferred — no API key management needed) ──
async function callLovableGateway(model: string, messages: { role: string; content: string }[], temperature: number, maxTokens: number): Promise<string | null> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return null;

  const gatewayModel = GATEWAY_MODEL_MAP[model];
  if (!gatewayModel) return null;

  const timeoutMs = model.includes("3-flash") ? 40000 : model.includes("lite") ? 25000 : 35000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const body: any = {
      model: gatewayModel,
      messages,
      max_tokens: maxTokens,
      temperature,
    };
    // Add reasoning for models that support it
    if (model === "gemini-3-flash-preview") {
      body.reasoning = { effort: "medium" };
    } else if (model === "gemini-2.5-flash") {
      body.reasoning = { effort: "low" };
    }

    console.log(`[TripPlanner] Gateway request: ${gatewayModel}, maxTokens=${maxTokens}`);
    const res = await fetch(LOVABLE_GATEWAY, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[TripPlanner] Gateway ${gatewayModel} error: ${res.status} ${errText.slice(0, 200)}`);
      return null;
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (content) {
      console.log(`[TripPlanner] Gateway ${gatewayModel} succeeded, length=${content.length}`);
    }
    return content || null;
  } catch (err: any) {
    clearTimeout(timeout);
    if (err.name === "AbortError") {
      console.warn(`[TripPlanner] Gateway ${gatewayModel} timed out`);
    } else {
      console.warn(`[TripPlanner] Gateway ${gatewayModel} error: ${err.message}`);
    }
    return null;
  }
}

// ── Direct Gemini API call (fallback when gateway fails) ──
async function callGeminiDirect(model: string, contents: any[], temperature: number, maxTokens: number, systemInstruction?: string): Promise<string | null> {
  const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
  if (!GOOGLE_AI_API_KEY) return null;

  const url = `${GEMINI_BASE}/${model}:generateContent?key=${GOOGLE_AI_API_KEY}`;
  const requestBody: any = {
    contents,
    generationConfig: { temperature, maxOutputTokens: maxTokens, topP: 0.95 },
  };
  if (systemInstruction) {
    requestBody.systemInstruction = { parts: [{ text: systemInstruction }] };
  }
  if (model === "gemini-3-flash-preview") {
    requestBody.generationConfig.thinkingConfig = { thinkingBudget: 2048 };
  } else if (model === "gemini-2.5-flash") {
    requestBody.generationConfig.thinkingConfig = { thinkingBudget: 1024 };
  } else if (model === "gemini-2.5-flash-lite") {
    requestBody.generationConfig.thinkingConfig = { thinkingBudget: 0 };
  }

  const timeoutMs = model.includes("3-flash") ? 40000 : model.includes("lite") ? 25000 : 35000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    console.log(`[TripPlanner] Direct Gemini ${model}: payload=${JSON.stringify(requestBody).length} chars`);
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`[TripPlanner] Direct Gemini ${model} error: ${response.status} ${errorText.slice(0, 200)}`);
      return null;
    }

    const data = await response.json();
    const parts = data.candidates?.[0]?.content?.parts || [];
    const textPart = parts.filter((p: any) => !p.thought).pop();
    return textPart?.text || parts[parts.length - 1]?.text || null;
  } catch (err: any) {
    clearTimeout(timeout);
    if (err.name === "AbortError") {
      console.warn(`[TripPlanner] Direct Gemini ${model} timed out`);
    } else {
      console.warn(`[TripPlanner] Direct Gemini ${model} error: ${err.message}`);
    }
    return null;
  }
}

// ── Unified AI call: Gateway first → Direct API fallback. No retries on same model. ──
async function callGemini(model: string, contents: any[], temperature: number, maxTokens: number, _maxRetries = 0, systemInstruction?: string): Promise<string | null> {
  // 1. Try gateway first
  const gatewayMessages: { role: string; content: string }[] = [];
  if (systemInstruction) {
    gatewayMessages.push({ role: "system", content: systemInstruction });
  }
  for (const c of contents) {
    const role = c.role === "model" ? "assistant" : c.role;
    const text = c.parts?.map((p: any) => p.text).join("\n") || "";
    gatewayMessages.push({ role, content: text });
  }

  const gatewayResult = await callLovableGateway(model, gatewayMessages, temperature, maxTokens);
  if (gatewayResult) return gatewayResult;

  // 2. Try direct API
  const directResult = await callGeminiDirect(model, contents, temperature, maxTokens, systemInstruction);
  if (directResult) return directResult;

  // Both failed
  console.error(`[TripPlanner] Both gateway and direct failed for ${model}`);
  return null;
}

// ── Multi-model fallback: tries models in order, gateway→direct for each, no retries ──
async function callAIWithFallback(
  models: string[],
  contents: any[],
  temperature: number,
  maxTokens: number,
  systemInstruction?: string,
): Promise<string | null> {
  for (const model of models) {
    const result = await callGemini(model, contents, temperature, maxTokens, 0, systemInstruction);
    if (result) return result;
    console.log(`[TripPlanner] Model ${model} failed, trying next...`);
  }
  return null;
}

// ── Multi-model fallback for OpenAI-style messages (no Gemini contents conversion) ──
async function callAIWithFallbackMessages(
  models: string[],
  messages: { role: string; content: string }[],
  temperature: number,
  maxTokens: number,
): Promise<string | null> {
  for (const model of models) {
    // Gateway first
    const gatewayResult = await callLovableGateway(model, messages, temperature, maxTokens);
    if (gatewayResult) return gatewayResult;
    // Direct API — convert messages to Gemini format
    const sysMsg = messages.find(m => m.role === "system");
    const contents = messages.filter(m => m.role !== "system").map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
    const directResult = await callGeminiDirect(model, contents, temperature, maxTokens, sysMsg?.content);
    if (directResult) return directResult;
    console.log(`[TripPlanner] Model ${model} failed (messages), trying next...`);
  }
  return null;
}

// Claude removed — all AI calls go through Gemini (gateway or direct)

function buildInfoGatheringFallbackReply(params: any, missingFields: string[], lastUserMessage: string): string {
  const lang = detectUserLanguage(lastUserMessage, params?.user_language);
  const priorityOrder = ["destination", "destination_cities", "destination_city", "request_type", "origin", "dates", "duration", "travel_type", "travelers"];
  const nextMissing = priorityOrder.find((item) => missingFields.includes(item)) || missingFields[0] || "dates";
  const destination = params?.destination_city || params?.destination_country || "your destination";
  const origin = params?.origin_city || params?.origin_airport;
  const departDate = params?.depart_date;

  if (lang === "Bengali") {
    switch (nextMissing) {
      case "origin":
        return `${destination} দারুণ পছন্দ! ✨ আপনি কোথা থেকে ট্রাভেল করবেন?`;
      case "dates":
        return `${origin ? `${origin} থেকে` : `${destination} এর জন্য`} খুব ভালো। ✈️ কবে ভ্রমণ করতে চান?`;
      case "duration":
        return `${departDate ? `${departDate} নোট করেছি।` : "চমৎকার।"} এই ট্রিপ কত দিনের হবে?`;
      case "travel_type":
        return `দারুণ! এটা কি সলো, কাপল, ফ্যামিলি, বন্ধুদের গ্রুপ, নাকি হানিমুন ট্রিপ?`;
      case "travelers":
        return `ঠিক আছে — কতজন adult, child (২-১১), আর infant (২ বছরের নিচে) ট্রাভেল করবে?`;
      case "travel_style":
        return `আপনি কোন ধরনের ট্রিপ চান — budget, comfortable, নাকি luxury?`;
      case "request_type":
        return `আপনি কী চান — শুধু flight, শুধু hotel, নাকি full trip plan?`;
      case "destination_city":
        return `${params?.destination_country || "সেই দেশে"} কোন শহরে যেতে চান?`;
      case "destination_cities": {
        const needsCities = (Array.isArray(params?.cities) ? params.cities : []).filter((c: any) => c.needs_city);
        const names = needsCities.map((c: any) => c.country || c.name).join(" ও ");
        return `দারুণ — ${names} এ কোন শহর/এলাকায় যেতে চান?`;
      }
      default:
        return `আপনি কোথায় যেতে চান?`;
    }
  }

  switch (nextMissing) {
    case "origin":
      return `${destination} sounds amazing${params?.travel_type === "honeymoon" ? " for a honeymoon" : ""}! ✨ Where will you be travelling from?`;
    case "dates":
      return `${origin ? `Perfect — departing from ${origin}.` : `Great choice with ${destination}.`} ✈️ When would you like to travel?`;
    case "duration":
      return `${departDate ? `Got it — ${departDate} is noted.` : "Perfect."} How many days are you planning for this trip?`;
    case "travel_type":
      return `Lovely — who’s travelling for this trip: solo, couple, family, friends, or honeymoon?`;
    case "travelers":
      return `Got it — how many adults, children (2–11), and infants (under 2) will be travelling?`;
    case "travel_style":
      return `Nice — would you like this trip to be budget-friendly, comfortable, or luxury?`;
    case "request_type":
      return `What would you like me to help with — flights, hotels, or a full trip plan?`;
    case "destination_city":
      return `Which city in ${params?.destination_country || "that country"} are you planning to visit?`;
    case "destination_cities": {
      const needsCities = (Array.isArray(params?.cities) ? params.cities : []).filter((c: any) => c.needs_city);
      const names = needsCities.map((c: any) => c.country || c.name).join(" and ");
      return `Great multi-destination trip! Which specific cities or areas would you like to visit in ${names}?`;
    }
    default:
      return `Where would you like to travel?`;
  }
}

function parseJsonBlock(text: string): any | null {
  const candidates = [
    text.match(/```json\s*([\s\S]*?)\s*```/i)?.[1],
    text.match(/```\s*([\s\S]*?)\s*```/i)?.[1],
    text,
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    const trimmed = candidate.trim();
    if (!trimmed) continue;

    try {
      return JSON.parse(trimmed);
    } catch {
      const objectStart = trimmed.indexOf("{");
      const objectEnd = trimmed.lastIndexOf("}");
      if (objectStart !== -1 && objectEnd > objectStart) {
        try {
          return JSON.parse(trimmed.slice(objectStart, objectEnd + 1));
        } catch {
          // Try next candidate
        }
      }

      const arrayStart = trimmed.indexOf("[");
      const arrayEnd = trimmed.lastIndexOf("]");
      if (arrayStart !== -1 && arrayEnd > arrayStart) {
        try {
          return JSON.parse(trimmed.slice(arrayStart, arrayEnd + 1));
        } catch {
          // Try next candidate
        }
      }
    }
  }

  return null;
}

function normalizeExtractionMessageContent(content: unknown): string {
  if (typeof content !== "string") return "";
  return content
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function isTransientExtractionAssistantMessage(content: string): boolean {
  return [
    /searching for the best options now/i,
    /i have everything i need/i,
    /your trip plan is ready/i,
    /having trouble fetching results/i,
    /let me try that again/i,
    /check the results panel/i,
    /^please wait/i,
  ].some((pattern) => pattern.test(content));
}

function buildExtractionConversationText(
  messages: Array<{ role?: string; content?: string }>,
  options: { userOnly?: boolean; maxChars?: number; maxMessages?: number } = {},
): string {
  const maxChars = options.maxChars ?? EXTRACTION_CONTEXT_MAX_CHARS;
  const maxMessages = options.maxMessages ?? EXTRACTION_CONTEXT_MAX_MESSAGES;
  const normalized = messages
    .map((message, index) => ({
      index,
      role: message?.role === "assistant" ? "assistant" : "user",
      content: normalizeExtractionMessageContent(message?.content),
    }))
    .filter((message) => message.content)
    .filter((message) => {
      if (message.role === "user") return true;
      if (options.userOnly) return false;
      if (message.content.length > 280) return false;
      return !isTransientExtractionAssistantMessage(message.content);
    });

  const deduped: typeof normalized = [];
  const seen = new Set<string>();
  for (const message of normalized) {
    const signature = `${message.role}:${message.content}`;
    if (seen.has(signature)) continue;
    seen.add(signature);
    deduped.push(message);
  }

  const firstUser = deduped.find((message) => message.role === "user");
  const tail = deduped
    .filter((message) => message !== firstUser)
    .slice(-Math.max(maxMessages - (firstUser ? 1 : 0), 0));
  const prioritized = [...(firstUser ? [firstUser] : []), ...tail].sort((a, b) => a.index - b.index);

  const selected: Array<{ index: number; block: string }> = [];
  let totalChars = 0;
  for (let i = prioritized.length - 1; i >= 0; i -= 1) {
    const message = prioritized[i];
    const label = message.role === "assistant" ? "Assistant" : "User";
    const perMessageLimit = message.role === "assistant" ? 280 : 2200;
    const clipped = message.content.length > perMessageLimit
      ? `${message.content.slice(0, perMessageLimit)}...`
      : message.content;
    const block = `${label}: ${clipped}`;

    if (totalChars + block.length > maxChars) {
      const remaining = maxChars - totalChars - label.length - 4;
      if (remaining < 120) continue;
      selected.push({ index: message.index, block: `${label}: ...${clipped.slice(-remaining)}` });
      totalChars = maxChars;
      continue;
    }

    selected.push({ index: message.index, block });
    totalChars += block.length + 1;
  }

  return selected
    .sort((a, b) => a.index - b.index)
    .map((message) => message.block)
    .join("\n")
    .trim();
}

function buildExtractionContents(conversationText: string, label = "relevant conversation") {
  return [
    { role: "user", parts: [{ text: EXTRACT_PROMPT_LEGACY }] },
    { role: "model", parts: [{ text: "Understood. I'll extract trip parameters from the conversation as JSON." }] },
    {
      role: "user",
      parts: [{ text: `Here is the ${label}. Prioritize the latest user corrections if anything conflicts.\n\n${conversationText}` }],
    },
  ];
}

async function searchFlights(supabaseUrl: string, serviceKey: string, anonKey: string, params: any): Promise<any[]> {
  try {
    if (!params.origin_airport || !params.destination_airport || !params.depart_date) {
      console.log("[TripPlanner] Skipping flight search — missing params");
      return [];
    }

    console.log(`[TripPlanner] Searching flights: ${params.origin_airport} -> ${params.destination_airport} on ${params.depart_date}`);
    
    const res = await fetch(`${supabaseUrl}/functions/v1/unified-flight-search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
        "apikey": anonKey,
      },
      body: JSON.stringify({
        from: params.origin_airport,
        to: params.destination_airport,
        departDate: params.depart_date,
        returnDate: params.return_date || undefined,
        adults: params.adults || 1,
        children: params.children || 0,
        infants: params.infants || 0,
        cabinClass: params.cabin_class || "Economy",
      }),
    });

    const data = await res.json();
    if (data?.success && data?.flights?.length > 0) {
      let filtered = [...data.flights];
      
      // If user prefers direct flights only, filter first (but keep connecting as fallback)
      if (params.prefer_direct) {
        const directOnly = filtered.filter((f: any) => f.stops === 0);
        if (directOnly.length > 0) {
          filtered = directOnly;
          console.log(`[TripPlanner] Direct flights filter: ${directOnly.length} direct flights kept`);
        } else {
          console.log(`[TripPlanner] No direct flights found, showing all ${filtered.length} options`);
        }
      }
      
      // Sort: direct flights first, then by price (best value)
      const sorted = filtered.sort((a: any, b: any) => {
        if (a.stops === 0 && b.stops !== 0) return -1;
        if (b.stops === 0 && a.stops !== 0) return 1;
        if (a.stops !== b.stops) return a.stops - b.stops;
        return (a.price || 0) - (b.price || 0);
      });
      
      const top = sorted.slice(0, 5).map((f: any) => {
        // Extract outbound and return leg details from segments or enriched fields
        let outbound: any = null;
        let returnLeg: any = null;

        if (f.outbound) {
          outbound = {
            airline: f.outbound.airline,
            flightNumber: f.outbound.flightNumber,
            from: f.outbound.from,
            to: f.outbound.to,
            departure: f.outbound.departure,
            arrival: f.outbound.arrival,
            stops: f.outbound.stops,
          };
        }

        if (f.return_leg) {
          returnLeg = {
            airline: f.return_leg.airline,
            flightNumber: f.return_leg.flightNumber,
            from: f.return_leg.from,
            to: f.return_leg.to,
            departure: f.return_leg.departure,
            arrival: f.return_leg.arrival,
            stops: f.return_leg.stops,
          };
        } else if (f.segments?.length) {
          // Fallback: extract from segments with group tags
          const outSegs = f.segments.filter((s: any) => s.group === 0);
          const retSegs = f.segments.filter((s: any) => s.group === 1);
          if (outSegs.length > 0) {
            const first = outSegs[0];
            const last = outSegs[outSegs.length - 1];
            outbound = {
              airline: first.carrier || first.airline || f.airline,
              flightNumber: first.flightNumber || f.flightNumber,
              from: first.origin || f.from_city,
              to: last.destination || f.to_city,
              departure: first.departure,
              arrival: last.arrival,
              stops: Math.max(0, outSegs.length - 1),
            };
          }
          if (retSegs.length > 0) {
            const first = retSegs[0];
            const last = retSegs[retSegs.length - 1];
            returnLeg = {
              airline: first.carrier || first.airline || f.airline,
              flightNumber: first.flightNumber || "",
              from: first.origin,
              to: last.destination,
              departure: first.departure,
              arrival: last.arrival,
              stops: Math.max(0, retSegs.length - 1),
            };
          }
        }

        return {
          airline: f.airline,
          flightNumber: f.flightNumber,
          from: f.from_city,
          to: f.to_city,
          departure: f.departure,
          arrival: f.arrival,
          duration: f.duration,
          stops: f.stops,
          isDirect: f.stops === 0,
          price: f.price,
          totalPrice: f.totalPrice,
           paxPricing: f.paxPricing,
          currency: f.currency || "BDT",
          cabinClass: f.class,
          cabinBaggage: f.cabinBaggage,
          checkinBaggage: f.checkinBaggage,
          isRefundable: f.isRefundable,
          source: f.source || "unknown",
          outbound: outbound || undefined,
          return_leg: returnLeg || undefined,
          isRoundTrip: !!(returnLeg || f.return_leg || f.returnFlight),
        };
      });
      const directCount = top.filter((f: any) => f.isDirect).length;
      console.log(`[TripPlanner] Found ${data.flights.length} flights (${directCount} direct, ${top.filter((f: any) => f.return_leg).length} with return), returning top ${top.length}`);
      return top;
    }
    console.log("[TripPlanner] No flights found");
    return [];
  } catch (e: any) {
    console.error("[TripPlanner] Flight search error:", e.message);
    return [];
  }
}

async function searchHotels(supabaseUrl: string, serviceKey: string, anonKey: string, params: any): Promise<any[]> {
  try {
    const cityName = params.hotel_city_name || params.destination_city;
    if (!cityName || !params.depart_date) {
      console.log("[TripPlanner] Skipping hotel search — missing params");
      return [];
    }

    const checkin = params.depart_date;
    const checkout = params.return_date || (() => {
      const d = new Date(params.depart_date);
      d.setDate(d.getDate() + (params.duration_days || 3));
      return d.toISOString().split("T")[0];
    })();

    console.log(`[TripPlanner] Searching hotels in "${cityName}" from ${checkin} to ${checkout}`);

    const res = await fetch(`${supabaseUrl}/functions/v1/unified-hotel-search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
        "apikey": anonKey,
      },
      body: JSON.stringify({
        cityName,
        checkinDate: checkin,
        checkoutDate: checkout,
        adults: params.adults || 1,
        children: params.children || 0,
        rooms: Math.max(1, Math.ceil((Number(params.adults || 1) + Math.floor(Number(params.children || 0) / 2)) / 2)),
      }),
    });

    const data = await res.json();
    if (data?.success && data?.hotels?.length > 0) {
      const sorted = data.hotels
        .filter((h: any) => h.price > 0)
        .sort((a: any, b: any) => a.price - b.price);
      
      const nights = Math.max(1, Math.ceil((new Date(checkout).getTime() - new Date(checkin).getTime()) / 86400000));
      
      const top = sorted.slice(0, 5).map((h: any) => ({
        name: h.name,
        stars: h.stars,
        totalPrice: h.price,
        pricePerNight: Math.round(h.price / nights),
        currency: data.displayCurrency || h.currency || "BDT",
        mealBasis: h.mealBasis,
        isRefundable: h.isRefundable,
        city: h.city,
        address: h.address,
        source: h.source || "unknown",
      }));
      console.log(`[TripPlanner] Found ${data.hotels.length} hotels, returning top ${top.length}`);
      return top;
    }
    console.log("[TripPlanner] No hotels found");
    return [];
  } catch (e: any) {
    console.error("[TripPlanner] Hotel search error:", e.message);
    return [];
  }
}

async function searchActivities(supabaseUrl: string, serviceKey: string, anonKey: string, params: any): Promise<any[]> {
  try {
    const destination = params.destination_city;
    if (!destination) {
      console.log("[TripPlanner] Skipping activity search — no destination");
      return [];
    }

    const apiHeaders = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${serviceKey}`,
      "apikey": anonKey,
    };

    console.log(`[TripPlanner] Searching activities in "${destination}" (destination-based)`);

    // Step 1: Resolve city → destinationId from Viator destinations API
    let destId: string | null = null;
    try {
      const destRes = await fetch(`${supabaseUrl}/functions/v1/unified-tour-search`, {
        method: "POST", headers: apiHeaders,
        body: JSON.stringify({ action: "destinations" }),
      });
      const destData = await destRes.json();
      const allDests = destData?.destinations || destData?.data || [];
      const cityLower = destination.toLowerCase().trim();
      const match = allDests.find((d: any) => {
        const dName = (d.destinationName || d.name || "").toLowerCase();
        return dName === cityLower || dName.includes(cityLower) || cityLower.includes(dName);
      });
      destId = match?.destinationId || match?.id || null;
      if (destId) console.log(`[TripPlanner] Resolved "${destination}" → destId ${destId}`);
    } catch (e: any) {
      console.warn(`[TripPlanner] Destination resolution failed: ${e.message}`);
    }

    let activities: any[] = [];

    if (destId) {
      // Single destination-based search — city-specific, no cross-city contamination
      const res = await fetch(`${supabaseUrl}/functions/v1/unified-tour-search`, {
        method: "POST", headers: apiHeaders,
        body: JSON.stringify({
          action: "search",
          destinationId: destId,
          targetCurrency: params.currency || "USD",
          limit: 30,
          sortOrder: "TRAVELER_RATING",
        }),
      });
      const data = await res.json();
      if (data?.success && data?.tours?.length > 0) {
        activities = data.tours.filter((p: any) => p.price > 0).slice(0, 15);
      }
    } else {
      // Fallback: freetext (rare — only when destId not found)
      console.log(`[TripPlanner] No destId for "${destination}", falling back to freetext`);
      const res = await fetch(`${supabaseUrl}/functions/v1/unified-tour-search`, {
        method: "POST", headers: apiHeaders,
        body: JSON.stringify({
          action: "freetext",
          searchText: `things to do in ${destination}`,
          targetCurrency: params.currency || "USD",
          limit: 15,
        }),
      });
      const data = await res.json();
      if (data?.success && data?.products?.length > 0) {
        activities = data.products.filter((p: any) => p.price > 0).slice(0, 10);
      }
    }

    const mapped = activities.map((p: any) => {
      // Include product options with pricing when available (for AI option-awareness)
      const rawOptions = (p.productOptions || []).filter((o: any) => o.fromPrice && o.fromPrice > 0);
      const productOptions = rawOptions.length > 1 ? rawOptions.map((o: any) => ({
        code: o.productOptionCode,
        title: o.title || o.description || o.productOptionCode,
        price: o.fromPrice,
        currency: o.currency || p.currency || "USD",
      })) : undefined;

      return {
        name: p.name,
        price: p.price,
        currency: p.currency || "USD",
        duration: p.duration || "",
        rating: p.rating || 0,
        reviewCount: p.reviewCount || 0,
        category: p.category || "Tour",
        productCode: p.productCode,
        image: p.image || "",
        highlights: (p.highlights || []).filter((h: any) => typeof h === "string" && h && isNaN(Number(h))).slice(0, 3),
        pricingType: p.pricingType || "PER_PERSON",
        shortDescription: p.shortDescription || "",
        source: "viator",
        ...(productOptions ? { productOptions } : {}),
      };
    });
    console.log(`[TripPlanner] Found ${mapped.length} activities for "${destination}" (destId=${destId || "freetext-fallback"})`);
    return mapped;
  } catch (e: any) {
    console.error("[TripPlanner] Activity search error:", e.message);
    return [];
  }
}

// Common destination → IATA code mapping for fallback
const DESTINATION_AIRPORT_MAP: Record<string, string> = {
  "bali": "DPS", "maldives": "MLE", "dubai": "DXB", "paris": "CDG", "tokyo": "NRT",
  "london": "LHR", "singapore": "SIN", "bangkok": "BKK", "kuala lumpur": "KUL",
  "istanbul": "IST", "new york": "JFK", "colombo": "CMB", "kathmandu": "KTM",
  "cox's bazar": "CXB", "chittagong": "CGP", "sylhet": "ZYL", "rome": "FCO",
  "barcelona": "BCN", "amsterdam": "AMS", "seoul": "ICN", "hong kong": "HKG",
  "phuket": "HKT", "delhi": "DEL", "mumbai": "BOM", "kolkata": "CCU",
  "jeddah": "JED", "riyadh": "RUH", "doha": "DOH", "abu dhabi": "AUH",
  "cairo": "CAI", "nairobi": "NBO", "cape town": "CPT", "sydney": "SYD",
  "melbourne": "MEL", "toronto": "YYZ", "los angeles": "LAX", "san francisco": "SFO",
  "miami": "MIA", "cancun": "CUN", "hawaii": "HNL", "santorini": "JTR",
  "athens": "ATH", "prague": "PRG", "vienna": "VIE", "zurich": "ZRH",
  "male": "MLE", "denpasar": "DPS", "langkawi": "LGK", "penang": "PEN",
  // Bangladesh cities
  "dhaka": "DAC", "barisal": "BZL", "barishal": "BZL", "jessore": "JSR", "rajshahi": "RJH",
  "saidpur": "SPD", "comilla": "CLA", "jashore": "JSR",
  // China cities
  "guangzhou": "CAN", "beijing": "PEK", "shanghai": "PVG", "shenzhen": "SZX",
  "chengdu": "CTU", "hangzhou": "HGH", "xi'an": "XIY", "xian": "XIY",
  "chongqing": "CKG", "kunming": "KMG", "nanjing": "NKG", "wuhan": "WUH",
  "xiamen": "XMN", "qingdao": "TAO", "dalian": "DLC", "haikou": "HAK",
  "sanya": "SYX", "tianjin": "TSN", "zhengzhou": "CGO", "changsha": "CSX",
  // More India cities
  "chennai": "MAA", "hyderabad": "HYD", "bangalore": "BLR", "goa": "GOI",
  "jaipur": "JAI", "ahmedabad": "AMD", "pune": "PNQ", "lucknow": "LKO",
  "varanasi": "VNS", "amritsar": "ATQ", "guwahati": "GAU", "patna": "PAT",
  "kochi": "COK", "thiruvananthapuram": "TRV",
  // Japan
  "osaka": "KIX", "kyoto": "KIX", "fukuoka": "FUK", "sapporo": "CTS", "okinawa": "OKA",
  // Southeast Asia
  "ho chi minh": "SGN", "hanoi": "HAN", "phnom penh": "PNH", "siem reap": "REP",
  "manila": "MNL", "cebu": "CEB", "jakarta": "CGK", "surabaya": "SUB",
  "yangon": "RGN", "vientiane": "VTE",
  // Europe
  "madrid": "MAD", "lisbon": "LIS", "berlin": "BER", "munich": "MUC",
  "milan": "MXP", "venice": "VCE", "dublin": "DUB", "edinburgh": "EDI",
  "brussels": "BRU", "copenhagen": "CPH", "oslo": "OSL", "stockholm": "ARN",
  "helsinki": "HEL", "warsaw": "WAW", "budapest": "BUD", "bucharest": "OTP",
  // Americas
  "chicago": "ORD", "boston": "BOS", "washington": "IAD", "dallas": "DFW",
  "seattle": "SEA", "denver": "DEN", "atlanta": "ATL", "houston": "IAH",
  "sao paulo": "GRU", "rio de janeiro": "GIG", "buenos aires": "EZE",
  "lima": "LIM", "bogota": "BOG", "mexico city": "MEX",
  // Middle East & Africa
  "muscat": "MCT", "kuwait": "KWI", "bahrain": "BAH", "amman": "AMM",
  "beirut": "BEY", "casablanca": "CMN", "marrakech": "RAK",
  "johannesburg": "JNB", "lagos": "LOS", "addis ababa": "ADD",
  // Oceania
  "auckland": "AKL", "perth": "PER", "brisbane": "BNE",
};

// ── International hub airports per country ──
const INTERNATIONAL_HUBS: Record<string, { code: string; city: string }[]> = {
  "BD": [{ code: "DAC", city: "Dhaka" }, { code: "CGP", city: "Chittagong" }],
  "IN": [{ code: "DEL", city: "Delhi" }, { code: "BOM", city: "Mumbai" }, { code: "CCU", city: "Kolkata" }, { code: "MAA", city: "Chennai" }, { code: "BLR", city: "Bangalore" }, { code: "HYD", city: "Hyderabad" }],
  "PK": [{ code: "KHI", city: "Karachi" }, { code: "ISB", city: "Islamabad" }, { code: "LHE", city: "Lahore" }],
  "NP": [{ code: "KTM", city: "Kathmandu" }],
  "LK": [{ code: "CMB", city: "Colombo" }],
  "MM": [{ code: "RGN", city: "Yangon" }],
  "TH": [{ code: "BKK", city: "Bangkok" }, { code: "HKT", city: "Phuket" }],
  "VN": [{ code: "SGN", city: "Ho Chi Minh City" }, { code: "HAN", city: "Hanoi" }],
  "KH": [{ code: "PNH", city: "Phnom Penh" }, { code: "REP", city: "Siem Reap" }],
  "ID": [{ code: "CGK", city: "Jakarta" }, { code: "DPS", city: "Bali" }],
  "MY": [{ code: "KUL", city: "Kuala Lumpur" }],
  "TR": [{ code: "IST", city: "Istanbul" }],
  "EG": [{ code: "CAI", city: "Cairo" }],
  "PE": [{ code: "LIM", city: "Lima" }, { code: "CUZ", city: "Cusco" }],
};

// Airports that are domestic-only (no/very limited international service)
const DOMESTIC_ONLY_AIRPORTS: Record<string, string> = {
  // Bangladesh
  "BZL": "BD", "JSR": "BD", "RJH": "BD", "SPD": "BD", "CLA": "BD", "ZYL": "BD",
  // India (domestic/limited international)
  "JAI": "IN", "LKO": "IN", "VNS": "IN", "PAT": "IN", "GAU": "IN", "ATQ": "IN",
  "PNQ": "IN", "COK": "IN", "TRV": "IN", "AMD": "IN", "GOI": "IN",
  // Pakistan
  "PEW": "PK", "MUX": "PK", "SKT": "PK",
  // Nepal (domestic)
  "PKR": "NP", "BWA": "NP",
};

// Cities/destinations with NO airport — map to nearest airport + ground transport info
const NO_AIRPORT_DESTINATIONS: Record<string, { nearestAirport: string; nearestCity: string; country: string; transportNote: string }> = {
  // Bangladesh
  "sundarbans": { nearestAirport: "JSR", nearestCity: "Jessore", country: "BD", transportNote: "From Jessore airport, take a bus/car to Khulna (~1.5 hrs), then boat to Sundarbans" },
  "kuakata": { nearestAirport: "BZL", nearestCity: "Barisal", country: "BD", transportNote: "From Barisal airport, take a bus/car to Kuakata (~3 hrs)" },
  "bandarban": { nearestAirport: "CGP", nearestCity: "Chittagong", country: "BD", transportNote: "From Chittagong airport, take a bus to Bandarban (~2.5 hrs)" },
  "rangamati": { nearestAirport: "CGP", nearestCity: "Chittagong", country: "BD", transportNote: "From Chittagong airport, take a bus to Rangamati (~2 hrs)" },
  "sajek": { nearestAirport: "CGP", nearestCity: "Chittagong", country: "BD", transportNote: "From Chittagong, travel to Khagrachhari then jeep to Sajek Valley (~6-7 hrs total)" },
  "sreemangal": { nearestAirport: "ZYL", nearestCity: "Sylhet", country: "BD", transportNote: "From Sylhet airport, take a bus/car to Sreemangal (~2 hrs)" },
  // India
  "darjeeling": { nearestAirport: "IXB", nearestCity: "Bagdogra", country: "IN", transportNote: "From Bagdogra airport, take a taxi/jeep to Darjeeling (~3 hrs uphill)" },
  "shimla": { nearestAirport: "SLV", nearestCity: "Shimla", country: "IN", transportNote: "Shimla has a small airport with limited flights. Alternative: fly to Chandigarh (CDG) and drive ~4 hrs" },
  "manali": { nearestAirport: "KUU", nearestCity: "Kullu", country: "IN", transportNote: "From Kullu-Manali airport (limited flights), or fly to Chandigarh and drive ~8 hrs" },
  "rishikesh": { nearestAirport: "DED", nearestCity: "Dehradun", country: "IN", transportNote: "From Dehradun airport, take a taxi to Rishikesh (~45 min)" },
  "udaipur": { nearestAirport: "UDR", nearestCity: "Udaipur", country: "IN", transportNote: "Udaipur has its own airport with domestic flights" },
  "kashmir": { nearestAirport: "SXR", nearestCity: "Srinagar", country: "IN", transportNote: "Fly to Srinagar airport (domestic flights from Delhi, Mumbai)" },
  "agra": { nearestAirport: "AGR", nearestCity: "Agra", country: "IN", transportNote: "Agra has limited flights. Better: fly to Delhi and take train/drive (~3 hrs)" },
  "ooty": { nearestAirport: "CJB", nearestCity: "Coimbatore", country: "IN", transportNote: "From Coimbatore airport, drive to Ooty (~3 hrs uphill)" },
  "munnar": { nearestAirport: "COK", nearestCity: "Kochi", country: "IN", transportNote: "From Kochi airport, drive to Munnar (~4 hrs)" },
  // Turkey
  "cappadocia": { nearestAirport: "NAV", nearestCity: "Nevsehir", country: "TR", transportNote: "Fly to Nevsehir (NAV) or Kayseri (ASR) airport, then shuttle/taxi to Göreme (~1 hr)" },
  "pamukkale": { nearestAirport: "DNZ", nearestCity: "Denizli", country: "TR", transportNote: "From Denizli airport, take a shuttle to Pamukkale (~1 hr)" },
  // Peru
  "machu picchu": { nearestAirport: "CUZ", nearestCity: "Cusco", country: "PE", transportNote: "Fly to Cusco, then train to Aguas Calientes (~3.5 hrs), then bus up to Machu Picchu" },
  // Greece
  "meteora": { nearestAirport: "ATH", nearestCity: "Athens", country: "GR", transportNote: "From Athens, take train to Kalambaka (~4 hrs) or drive (~3.5 hrs)" },
  // Morocco
  "chefchaouen": { nearestAirport: "TNG", nearestCity: "Tangier", country: "MA", transportNote: "From Tangier airport, drive or bus to Chefchaouen (~2.5 hrs)" },
  // Cambodia
  "angkor wat": { nearestAirport: "REP", nearestCity: "Siem Reap", country: "KH", transportNote: "Fly to Siem Reap airport, Angkor Wat is ~15 min by tuk-tuk" },
  // Indonesia
  "komodo": { nearestAirport: "LBJ", nearestCity: "Labuan Bajo", country: "ID", transportNote: "Fly to Labuan Bajo airport, then take a boat tour to Komodo (~2-3 hrs)" },
  "yogyakarta": { nearestAirport: "JOG", nearestCity: "Yogyakarta", country: "ID", transportNote: "Yogyakarta has its own airport with domestic flights" },
  // Vietnam
  "ha long bay": { nearestAirport: "HPH", nearestCity: "Hai Phong", country: "VN", transportNote: "Fly to Hanoi or Hai Phong, then drive/bus to Ha Long (~2-3 hrs)" },
  "hoi an": { nearestAirport: "DAD", nearestCity: "Da Nang", country: "VN", transportNote: "Fly to Da Nang airport, then taxi to Hoi An (~40 min)" },
  "sapa": { nearestAirport: "HAN", nearestCity: "Hanoi", country: "VN", transportNote: "From Hanoi, take overnight train or drive to Sapa (~5-6 hrs)" },
  // Nepal
  "pokhara": { nearestAirport: "PKR", nearestCity: "Pokhara", country: "NP", transportNote: "Pokhara has a domestic airport. Fly from Kathmandu (~25 min) or drive (~6 hrs)" },
  "chitwan": { nearestAirport: "BWA", nearestCity: "Bharatpur", country: "NP", transportNote: "Fly to Bharatpur from Kathmandu (~20 min) or drive (~4-5 hrs)" },
  // Sri Lanka
  "ella": { nearestAirport: "CMB", nearestCity: "Colombo", country: "LK", transportNote: "From Colombo, take the scenic train to Ella (~6-7 hrs) — one of the world's best train rides" },
  "sigiriya": { nearestAirport: "CMB", nearestCity: "Colombo", country: "LK", transportNote: "From Colombo, drive to Sigiriya (~4 hrs) or take a bus" },
  "galle": { nearestAirport: "CMB", nearestCity: "Colombo", country: "LK", transportNote: "From Colombo, drive or train to Galle (~2-3 hrs along the coast)" },
};

// Get nearest hub for a domestic airport
function getNearestHub(airportCode: string): { hubCode: string; hubCity: string; country: string } | null {
  const countryCode = DOMESTIC_ONLY_AIRPORTS[airportCode];
  if (!countryCode) return null;
  const hubs = INTERNATIONAL_HUBS[countryCode];
  if (!hubs || hubs.length === 0) return null;
  return { hubCode: hubs[0].code, hubCity: hubs[0].city, country: countryCode };
}

// Check if a destination has no airport and needs ground transport
function getNoAirportInfo(cityName: string): { nearestAirport: string; nearestCity: string; country: string; transportNote: string } | null {
  if (!cityName) return null;
  const key = cityName.toLowerCase().trim();
  return NO_AIRPORT_DESTINATIONS[key] || null;
}

// ── Post-extraction must-visit recovery ──
// Scans user text for attractions that the AI extraction may have missed
function recoverMustVisitFromText(params: any, lastUserMsg: string, fullConversation: string): any {
  if (!Array.isArray(params.cities) || params.cities.length === 0) return params;
  
  const userText = lastUserMsg || fullConversation;
  if (!userText) return params;
  
  // Parse bullet-pointed attractions per city from user text
  // Handles formats like:
  //   Singapore (3n4d) ▪️Marina Bay Sands ▪️Gardens By the Bay
  //   Langkawi (2n3d) ▪️Sky bridge ▪️Cenang beach
  const cityBlocks = splitTextIntoCityBlocks(userText, params.cities);
  
  let totalRecovered = 0;
  for (const city of params.cities) {
    const cityName = (city.name || "").toLowerCase();
    const block = cityBlocks.find(b => b.cityName.toLowerCase() === cityName || 
      cityName.includes(b.cityName.toLowerCase()) || 
      b.cityName.toLowerCase().includes(cityName));
    
    if (!block) continue;
    
    // Extract attractions from this city's text block
    const attractions = extractAttractionsFromBlock(block.text);
    if (attractions.length === 0) continue;
    
    // Merge with existing must_visit (don't duplicate)
    const existing = new Set((city.must_visit || []).map((v: string) => v.toLowerCase().trim()));
    const newItems: string[] = [];
    for (const attr of attractions) {
      const attrLower = attr.toLowerCase().trim();
      // Skip if already captured or if it's a generic term
      if (existing.has(attrLower)) continue;
      if (/^(breakfast|lunch|dinner|hotel|airport|check.?in|check.?out)$/i.test(attr)) continue;
      // Skip city names themselves
      if (params.cities.some((c: any) => (c.name || "").toLowerCase() === attrLower)) continue;
      newItems.push(attr);
      existing.add(attrLower);
    }
    
    if (newItems.length > 0) {
      city.must_visit = [...(city.must_visit || []), ...newItems];
      totalRecovered += newItems.length;
    }
    
    // Recover hotel area/type hints from text if not already extracted
    if (!city.preferred_hotel && !city.hotel_area) {
      // Check for "area + property type" patterns (e.g., "Batu Ferringhi resort", "KLCC hotel")
      const areaTypeMatch = block.text.match(/(?:stay\s+(?:at|in|near)\s+|hotel\s+(?:in|near|at)\s+|)([\w\s]+?)(?:\s+)(resort|hotel|villa|boutique|inn|lodge|hostel|guesthouse|apartment)s?\b/i);
      if (areaTypeMatch) {
        const possibleArea = areaTypeMatch[1].trim();
        const possibleType = areaTypeMatch[2].toLowerCase();
        // Only treat as area if it's not a known hotel brand
        const knownBrands = /^(shangri|hilton|marriott|hyatt|accor|ihg|radisson|sheraton|westin|ritz|mandarin|peninsula|four\s*seasons|st\s*regis|w\s+hotel|fairmont|sofitel|novotel|pullman|crowne|holiday\s*inn|intercontinental|kempinski|raffles|banyan|aman|anantara|como|six\s*senses)/i;
        if (!knownBrands.test(possibleArea)) {
          city.hotel_area = possibleArea;
          city.hotel_type = possibleType;
        } else {
          city.preferred_hotel = `${possibleArea} ${possibleType}`.trim();
        }
      }
    }
  }
  
  // Also rebuild user_must_visit master list
  if (totalRecovered > 0) {
    const allMustVisit = new Set<string>(params.user_must_visit || []);
    for (const city of params.cities) {
      for (const mv of (city.must_visit || [])) {
        allMustVisit.add(mv);
      }
    }
    params.user_must_visit = Array.from(allMustVisit);
    console.log(`[TripPlanner] Recovered ${totalRecovered} must-visit items from text. Total: ${params.user_must_visit.length}`);
  }
  
  // Recover special notes from text (Express pass, Cable car inclusive, etc.)
  const specialPatterns = [
    /express\s*pass/gi, /cable\s*car\s*(?:inclusive|included)?/gi,
    /guided\s*(?:day\s*)?trip/gi, /self[\s-]*managed\s*(?:accommodation)?/gi,
    /walking\s*(?:street|tour)/gi, /city\s*tour/gi,
  ];
  const existingNotes = new Set((params.user_special_notes || []).map((n: string) => n.toLowerCase()));
  const newNotes: string[] = [];
  for (const pattern of specialPatterns) {
    const matches = userText.match(pattern);
    if (matches) {
      for (const m of matches) {
        if (!existingNotes.has(m.toLowerCase())) {
          newNotes.push(m);
          existingNotes.add(m.toLowerCase());
        }
      }
    }
  }
  if (newNotes.length > 0) {
    params.user_special_notes = [...(params.user_special_notes || []), ...newNotes];
    console.log(`[TripPlanner] Recovered ${newNotes.length} special notes from text`);
  }
  
  return params;
}

function splitTextIntoCityBlocks(text: string, cities: any[]): { cityName: string; text: string }[] {
  const results: { cityName: string; text: string }[] = [];
  const cityNames = cities.map((c: any) => (c.name || "").trim()).filter(Boolean);
  
  // Find positions of each city mention in the text
  const positions: { name: string; index: number }[] = [];
  for (const name of cityNames) {
    const regex = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    const match = regex.exec(text);
    if (match) {
      positions.push({ name, index: match.index });
    }
  }
  
  // Sort by position
  positions.sort((a, b) => a.index - b.index);
  
  // Extract blocks
  for (let i = 0; i < positions.length; i++) {
    const start = positions[i].index;
    const end = i + 1 < positions.length ? positions[i + 1].index : text.length;
    results.push({ cityName: positions[i].name, text: text.slice(start, end) });
  }
  
  return results;
}

function extractAttractionsFromBlock(text: string): string[] {
  const attractions: string[] = [];
  
  // Split by bullet markers: ▪️ • - * or newlines followed by content
  const parts = text.split(/[▪️•\*]+|(?:\n\s*[-–]\s*)/);
  
  for (const part of parts) {
    let cleaned = part.trim()
      // Remove leading city name + duration pattern like "Singapore (3n4d)"
      .replace(/^[\w\s]+\(\s*\d+n\d*d\s*\)\s*/i, "")
      // Remove leading dashes/bullets
      .replace(/^[-–•\*▪️\s]+/, "")
      // Remove trailing punctuation
      .replace(/[,;.\s]+$/, "")
      .trim();
    
    // Skip empty, too short, or too long (likely sentences, not attraction names)
    if (!cleaned || cleaned.length < 3 || cleaned.length > 80) continue;
    // Skip date/pax info
    if (/^\d+\s*(adult|infant|child|pax|people|person)/i.test(cleaned)) continue;
    if (/^from\s+\d+/i.test(cleaned)) continue;
    if (/^\d+n\d*d$/i.test(cleaned)) continue;
    // Skip "starts at", "from" location references
    if (/^(from|starts?\s+at|departing)/i.test(cleaned)) continue;
    
    // Handle parenthetical notes — keep the main name and note separately
    const mainName = cleaned.replace(/\s*[-–]\s*\(.*?\)\s*$/, "").replace(/\s*\(.*?\)\s*$/, "").trim();
    if (mainName && mainName.length >= 3) {
      attractions.push(cleaned); // Keep full text including notes like "(Cable car)"
    }
  }
  
  return attractions;
}

// Check if we have enough info to search APIs
function hasSufficientInfo(params: any): boolean {
  // For multi-city: check if all cities are resolved
  if (Array.isArray(params.cities) && params.cities.length > 1) {
    const unresolved = params.cities.filter((c: any) => c.needs_city === true);
    if (unresolved.length > 0) return false;
    
    // ALWAYS validate duration_days and return_date against per-city breakdown
    // The AI sometimes miscalculates total trip length for complex multi-city trips
     const totalNights = params.cities.reduce((sum: number, c: any) => sum + (c.nights || c.days || 0), 0);
    if (totalNights > 0) {
      const correctDuration = totalNights + 1; // sum of nights + 1 (departure day)
      
      if (!params.duration_days || Math.abs(params.duration_days - correctDuration) >= 2) {
        if (params.duration_days && params.duration_days !== correctDuration) {
          console.log(`[TripPlanner] ⚠️ AI duration_days=${params.duration_days} mismatches city sum=${correctDuration} (${totalNights} nights). Overriding.`);
        }
        params.duration_days = correctDuration;
      }
      
      // Also fix return_date to match
      if (params.depart_date) {
        const d = new Date(params.depart_date);
        d.setDate(d.getDate() + totalNights);
        const correctReturn = d.toISOString().split("T")[0];
        if (params.return_date !== correctReturn) {
          console.log(`[TripPlanner] ⚠️ Correcting return_date: ${params.return_date} → ${correctReturn}`);
          params.return_date = correctReturn;
        }
      }
    }
  } else if (!params.destination_city) return false;
  if (params.destination_country && !params.destination_city && !Array.isArray(params.cities)) return false;
  // Must know what user wants before proceeding — but auto-infer for multi-dest
  const citiesArr = Array.isArray(params.cities) ? params.cities : [];
  if ((!params.request_type || params.request_type === "unknown") && citiesArr.length >= 2) {
    params.request_type = "full_trip";
  }
  if (!params.request_type || params.request_type === "unknown") return false;
  if (!params.origin_airport && !params.origin_city) return false;

  // For flight_only: just need origin, destination, date, and travelers
  if (params.request_type === "flight_only") {
    if (!params.depart_date) return false;
    // For family/group, need traveler breakdown
    if ((params.travel_type === "family" || params.travel_type === "group" || params.travel_type === "business") && !params.travelers_confirmed) {
      const hasHeadcount = params.adults && params.adults >= 1;
      if (!hasHeadcount) return false;
    }
    return true;
  }

  // For hotel_only: need destination, dates, duration
  if (params.request_type === "hotel_only") {
    if (!params.depart_date) return false; // Always need a specific date
    if (!params.duration_days && !params.return_date) return false;
    return true;
  }

  // For full_trip: need everything — including a specific travel date
  if (!params.depart_date) return false; // Duration alone is not enough — ask when
  if (!params.duration_days && !params.return_date) return false;
  // Auto-compute return_date from depart_date + duration_days if missing
  if (!params.return_date && params.depart_date && params.duration_days) {
    const d = new Date(params.depart_date);
    d.setDate(d.getDate() + params.duration_days - 1);
    params.return_date = d.toISOString().split("T")[0];
    console.log(`[TripPlanner] Auto-computed return_date=${params.return_date} from depart + ${params.duration_days} days`);
  }

  // Auto-infer travel_type from passenger breakdown
  // CRITICAL: Always force "family" when infants/children present, even if AI extracted "couple"
  {
    const a = params.adults || 0;
    const c = params.children || 0;
    const inf = params.infants || 0;
    if (c > 0 || inf > 0) {
      if (params.travel_type && params.travel_type !== "family") {
        console.log(`[TripPlanner] ⚠️ Override travel_type="${params.travel_type}" → "family" (infants=${inf}, children=${c})`);
      }
      params.travel_type = "family";
    } else if (!params.travel_type && params.travelers_confirmed) {
      if (a === 1) {
        params.travel_type = "solo";
        console.log(`[TripPlanner] Auto-inferred travel_type=solo`);
      } else if (a === 2) {
        params.travel_type = "couple";
        console.log(`[TripPlanner] Auto-inferred travel_type=couple`);
      } else if (a >= 3) {
        params.travel_type = "group";
        console.log(`[TripPlanner] Auto-inferred travel_type=group (${a} adults)`);
      }
    }
  }

  if (!params.travel_type) return false;
  if ((params.travel_type === "family" || params.travel_type === "group" || params.travel_type === "business") && !params.travelers_confirmed) {
    const hasHeadcount = params.adults && params.adults >= 1;
    if (!hasHeadcount) return false;
  }
  // Default travel_style instead of blocking — "comfortable" is a safe default
  if (!params.travel_style) {
    params.travel_style = "comfortable";
    params.selection_priority = params.selection_priority || "best_value";
    console.log(`[TripPlanner] Auto-defaulting travel_style=comfortable`);
  }
  return true;
}

// Apply smart defaults for missing non-critical info
function applySmartDefaults(params: any): any {
  const p = { ...params };
  
  // ── Step 1: Resolve airport codes from city names ──
  if (!p.origin_airport && p.origin_city) {
    const originKey = p.origin_city.toLowerCase().trim();
    p.origin_airport = DESTINATION_AIRPORT_MAP[originKey] || null;
    if (p.origin_airport) {
      console.log(`[TripPlanner] Resolved origin airport: ${p.origin_city} -> ${p.origin_airport}`);
    } else {
      // Origin city has no known airport — check no-airport list
      const noAirportInfo = getNoAirportInfo(p.origin_city);
      if (noAirportInfo) {
        p.origin_airport = noAirportInfo.nearestAirport;
        p._origin_no_airport = true;
        p._origin_nearest_city = noAirportInfo.nearestCity;
        p._origin_transport_note = noAirportInfo.transportNote;
        console.log(`[TripPlanner] Origin "${p.origin_city}" has no airport. Using nearest: ${noAirportInfo.nearestAirport} (${noAirportInfo.nearestCity})`);
      }
    }
  }
  
  if (!p.destination_airport && p.destination_city) {
    const key = p.destination_city.toLowerCase().trim();
    p.destination_airport = DESTINATION_AIRPORT_MAP[key] || null;
    if (p.destination_airport) {
      console.log(`[TripPlanner] Resolved destination airport: ${p.destination_city} -> ${p.destination_airport}`);
    } else {
      // Destination has no known airport — check no-airport list
      const noAirportInfo = getNoAirportInfo(p.destination_city);
      if (noAirportInfo) {
        p.destination_airport = noAirportInfo.nearestAirport;
        p._dest_no_airport = true;
        p._dest_nearest_city = noAirportInfo.nearestCity;
        p._dest_transport_note = noAirportInfo.transportNote;
        p.hotel_city_name = p.destination_city; // Search hotels in actual destination, not airport city
        console.log(`[TripPlanner] Destination "${p.destination_city}" has no airport. Using nearest: ${noAirportInfo.nearestAirport} (${noAirportInfo.nearestCity})`);
      } else {
        // Unknown city with no airport mapping — let the AI figure it out
        p._dest_unknown_airport = true;
        console.log(`[TripPlanner] Destination "${p.destination_city}" has no known airport mapping. AI will handle transport planning.`);
      }
    }
  }
  
  // ── Step 2: Domestic airport detection for international trips ──
  if (p.origin_airport && p.destination_airport) {
    const hubInfo = getNearestHub(p.origin_airport);
    if (hubInfo) {
      const destCountry = DOMESTIC_ONLY_AIRPORTS[p.destination_airport];
      const isInternational = !destCountry || destCountry !== hubInfo.country;
      
      if (isInternational) {
        p._domestic_origin_airport = p.origin_airport;
        p._domestic_origin_city = p.origin_city;
        p._hub_airport = hubInfo.hubCode;
        p._hub_city = hubInfo.hubCity;
        p._needs_connecting_flight = true;
        console.log(`[TripPlanner] Domestic airport detected: ${p.origin_airport} is domestic-only. Swapping to hub: ${hubInfo.hubCode} (${hubInfo.hubCity}) for international flight search.`);
        p.origin_airport = hubInfo.hubCode;
      }
    }
    
    // Also check if destination airport is domestic-only and origin is international
    const destHubInfo = getNearestHub(p.destination_airport);
    if (destHubInfo) {
      const originCountry = DOMESTIC_ONLY_AIRPORTS[p.origin_airport];
      const isInternational = !originCountry || originCountry !== destHubInfo.country;
      
      if (isInternational) {
        p._domestic_dest_airport = p.destination_airport;
        p._dest_hub_airport = destHubInfo.hubCode;
        p._dest_hub_city = destHubInfo.hubCity;
        p._needs_dest_connecting_flight = true;
        console.log(`[TripPlanner] Destination ${p.destination_airport} is domestic-only. Swapping to hub: ${destHubInfo.hubCode} (${destHubInfo.hubCity}) for international flight search.`);
        p.destination_airport = destHubInfo.hubCode;
      }
    }
  }
  
  if (!p.adults || p.adults < 1) {
    switch (p.travel_type) {
      case "solo": p.adults = 1; break;
      case "couple": case "honeymoon": p.adults = 2; break;
      default: p.adults = p.adults || 1; break;
    }
  }
  if (!p.children) p.children = 0;
  if (!p.infants) p.infants = 0;
  
  // ── Step 3b: Validate dates are not in the past ──
  const today = new Date().toISOString().split("T")[0];
  if (p.depart_date && p.depart_date < today) {
    console.log(`[TripPlanner] Depart date ${p.depart_date} is in the past. Clearing  -  will ask user for valid dates.`);
    p.depart_date = null;
    p.return_date = null;
  }

  // If return_date is in the past or before depart, clear it
  if (p.return_date && (p.return_date < today || (p.depart_date && p.return_date < p.depart_date))) {
    p.return_date = null;
  }

  // If we have depart_date but no return, calculate from duration
  if (p.depart_date && !p.return_date && p.duration_days) {
    const d = new Date(p.depart_date);
    d.setDate(d.getDate() + p.duration_days);
    p.return_date = d.toISOString().split("T")[0];
  }

  // If we have duration but NO depart_date, default to ~2 weeks from now
  if (!p.depart_date && p.duration_days) {
    const defaultDepart = new Date();
    defaultDepart.setDate(defaultDepart.getDate() + 14);
    p.depart_date = defaultDepart.toISOString().split("T")[0];
    const ret = new Date(defaultDepart);
    ret.setDate(ret.getDate() + p.duration_days);
    p.return_date = ret.toISOString().split("T")[0];
    console.log(`[TripPlanner] No depart_date provided  -  defaulting to ${p.depart_date} (2 weeks out)`);
  }
  
  // Default duration if we have dates
  if (p.depart_date && p.return_date && !p.duration_days) {
    p.duration_days = Math.max(1, Math.ceil((new Date(p.return_date).getTime() - new Date(p.depart_date).getTime()) / 86400000));
  }
  
  if (!p.cabin_class) p.cabin_class = "Economy";
  if (!p.cabin_class) p.cabin_class = "Economy";

  // ── Step 3c: Validate destination_city is not a country name ──
  const countryNames = new Set([
    "maldives", "thailand", "indonesia", "greece", "japan", "south korea", "china",
    "india", "bangladesh", "pakistan", "nepal", "sri lanka", "bhutan", "myanmar",
    "vietnam", "cambodia", "laos", "philippines", "malaysia", "singapore",
    "turkey", "egypt", "morocco", "kenya", "tanzania", "south africa",
    "uae", "united arab emirates", "qatar", "saudi arabia", "oman", "bahrain", "jordan", "lebanon",
    "france", "italy", "spain", "uk", "united kingdom", "germany", "switzerland", "austria",
    "netherlands", "portugal", "croatia", "czech republic", "hungary", "poland",
    "australia", "new zealand", "fiji", "mauritius", "seychelles",
    "usa", "united states", "canada", "mexico", "brazil", "colombia", "peru", "argentina",
    "cuba", "costa rica", "panama", "jamaica",
  ]);
  if (p.destination_city && countryNames.has(p.destination_city.toLowerCase())) {
    console.log(`[TripPlanner] destination_city "${p.destination_city}" is a country  -  moving to destination_country, clearing city`);
    if (!p.destination_country) p.destination_country = p.destination_city;
    p.destination_city = null;
    p.hotel_city_name = null;
  }

  if (!p.hotel_city_name) p.hotel_city_name = p.destination_city;
  
  // Map honeymoon travel_style from travel_type
  if (p.travel_type === "honeymoon" && !p.travel_style) {
    p.travel_style = "comfortable";
    p.selection_priority = "best_value";
  }
  
  // ── Step 4: Auto-resolve multi-destination cities ──
  if (Array.isArray(p.cities) && p.cities.length > 0) {
    p.cities = p.cities.map((c: any) => {
      // Check if city name is actually a country name — resolve it regardless of needs_city
      const nameIsCountry = c.name && countryNames.has(c.name.toLowerCase());
      
      // If needs_city is true but the name is NOT a country, it's already a specific city
      // (e.g., "Langkawi", "Penang", "Kuala Lumpur") — just clear the flag
      if (c.needs_city && !nameIsCountry) {
        console.log(`[TripPlanner] "${c.name}" is already a city, clearing needs_city`);
        return { ...c, needs_city: false };
      }
      
      if (!c.needs_city && !nameIsCountry) return c;
      // Auto-resolve country to best city based on travel context
      const lookupKey = c.country || c.name;
      const resolved = autoResolveCity(lookupKey, p.travel_type, p.travel_style);
      if (resolved) {
        console.log(`[TripPlanner] Auto-resolved ${lookupKey} -> ${resolved}`);
        return { ...c, name: resolved, needs_city: false, auto_resolved: true };
      }
      return c;
    });
    // Update destination_city from first resolved city if not set
    const firstResolved = p.cities.find((c: any) => !c.needs_city);
    if (firstResolved && !p.destination_city) {
      p.destination_city = firstResolved.name;
      p.hotel_city_name = firstResolved.name;
    }
  }

  // ── Step 5: AI-weighted day allocation for multi-city ──
  if (Array.isArray(p.cities) && p.cities.length > 1) {
    const totalDays = p.duration_days || 5;
    const citiesWithoutDays = p.cities.filter((c: any) => !c.days);
    if (citiesWithoutDays.length > 0) {
      // Use weighted allocation based on destination importance
      const weights = p.cities.map((c: any) => {
        if (c.days) return 0; // already allocated
        return getCityWeight(c.name, c.country);
      });
      const totalWeight = weights.reduce((a: number, b: number) => a + b, 0);
      const alreadyAllocated = p.cities.reduce((sum: number, c: any) => sum + (c.days || 0), 0);
      const remaining = Math.max(totalDays - alreadyAllocated, citiesWithoutDays.length);
      
      p.cities = p.cities.map((c: any, i: number) => {
        if (c.days) return c;
        const share = totalWeight > 0 ? Math.max(1, Math.round((weights[i] / totalWeight) * remaining)) : Math.max(1, Math.round(remaining / citiesWithoutDays.length));
        return { ...c, days: share };
      });
      
      // Ensure total doesn't exceed duration
      const totalAllocated = p.cities.reduce((sum: number, c: any) => sum + (c.days || 0), 0);
      if (totalAllocated > totalDays) {
        const excess = totalAllocated - totalDays;
        // Reduce from the city with the most days
        const maxIdx = p.cities.reduce((mi: number, c: any, i: number) => (c.days || 0) > (p.cities[mi].days || 0) ? i : mi, 0);
        p.cities[maxIdx].days = Math.max(1, (p.cities[maxIdx].days || 1) - excess);
      }
      
      console.log(`[TripPlanner] Day allocation: ${p.cities.map((c: any) => `${c.name}(${c.days}d)`).join(' -> ')}`);
    }
  }
  
  return p;
}

// Auto-resolve a country to the best city based on travel context
function autoResolveCity(country: string, travelType?: string, travelStyle?: string): string | null {
  const key = country?.toLowerCase();
  if (!key) return null;
  
  const resolutionMap: Record<string, Record<string, string>> = {
    "maldives": {
      "honeymoon": "South Ari Atoll",
      "luxury": "North Malé Atoll",
      "comfortable": "South Malé Atoll",
      "budget": "Maafushi",
      "default": "South Malé Atoll",
    },
    "sri lanka": {
      "honeymoon": "Galle",
      "luxury": "Galle",
      "budget": "Colombo",
      "default": "Colombo",
    },
    "thailand": {
      "honeymoon": "Phuket",
      "luxury": "Phuket",
      "budget": "Bangkok",
      "family": "Phuket",
      "default": "Bangkok",
    },
    "indonesia": {
      "honeymoon": "Bali",
      "luxury": "Bali",
      "default": "Bali",
    },
    "japan": {
      "honeymoon": "Tokyo",
      "default": "Tokyo",
    },
    "greece": {
      "honeymoon": "Santorini",
      "luxury": "Santorini",
      "default": "Athens",
    },
    "india": {
      "honeymoon": "Goa",
      "luxury": "Jaipur",
      "budget": "Delhi",
      "default": "Delhi",
    },
    "turkey": {
      "honeymoon": "Istanbul",
      "default": "Istanbul",
    },
    "egypt": {
      "default": "Cairo",
    },
    "malaysia": {
      "honeymoon": "Langkawi",
      "default": "Kuala Lumpur",
    },
    "vietnam": {
      "default": "Hanoi",
    },
    "south korea": {
      "default": "Seoul",
    },
    "uae": {
      "default": "Dubai",
    },
    "saudi arabia": {
      "default": "Jeddah",
    },
    "nepal": {
      "default": "Kathmandu",
    },
    "cambodia": {
      "default": "Siem Reap",
    },
    "morocco": {
      "default": "Marrakech",
    },
    "france": {
      "default": "Paris",
    },
    "italy": {
      "honeymoon": "Venice",
      "default": "Rome",
    },
    "spain": {
      "default": "Barcelona",
    },
    "uk": {
      "default": "London",
    },
    "usa": {
      "default": "New York",
    },
    "australia": {
      "default": "Sydney",
    },
    "mexico": {
      "honeymoon": "Cancun",
      "default": "Cancun",
    },
    "singapore": {
      "default": "Singapore",
    },
    "fiji": {
      "default": "Nadi",
    },
    "mauritius": {
      "default": "Port Louis",
    },
    "seychelles": {
      "default": "Mahé",
    },
    "philippines": {
      "honeymoon": "Palawan",
      "default": "Manila",
    },
    "croatia": {
      "default": "Dubrovnik",
    },
    "jordan": {
      "default": "Amman",
    },
    "bangladesh": {
      "default": "Dhaka",
    },
    "pakistan": {
      "default": "Lahore",
    },
    "brazil": {
      "default": "Rio de Janeiro",
    },
    "peru": {
      "default": "Cusco",
    },
    "kenya": {
      "default": "Nairobi",
    },
    "south africa": {
      "default": "Cape Town",
    },
  };
  
  const countryMap = resolutionMap[key];
  if (!countryMap) return null;
  
  const styleKey = travelType === "honeymoon" ? "honeymoon" 
    : travelType === "family" ? "family"
    : travelStyle || "default";
  
  return countryMap[styleKey] || countryMap["default"] || null;
}

// Get city importance weight for day allocation (higher = more days)
function getCityWeight(cityName: string, country?: string): number {
  const key = (cityName || "").toLowerCase();
  // Major destinations get more days
  const heavyweights: Record<string, number> = {
    "tokyo": 4, "bangkok": 3, "istanbul": 3, "paris": 4, "rome": 3,
    "new york": 4, "london": 3, "dubai": 2, "singapore": 2,
    "bali": 3, "phuket": 3, "sydney": 3, "barcelona": 3,
    "seoul": 3, "delhi": 2, "mumbai": 2, "cairo": 2,
    "cusco": 3, "kyoto": 2, "osaka": 2, "venice": 2,
    "santorini": 2, "marrakech": 2, "galle": 2, "kandy": 2,
    "colombo": 2, "malé": 2, "maafushi": 3,
  };
  return heavyweights[key] || 2; // default weight = 2
}

// Generate a friendly info-gathering response — ask ONE missing thing at a time
function generateInfoGatheringPrompt(params: any): { prompt: string; missingFields: string[] } {
  const missing: string[] = [];
  
  // Smart inference: multi-destination or travel verbs → auto-set full_trip
  const citiesArr = Array.isArray(params.cities) ? params.cities : [];
  const hasMultiDest = citiesArr.length >= 2;
  if ((!params.request_type || params.request_type === "unknown") && hasMultiDest) {
    params.request_type = "full_trip"; // multi-destination = obviously a full trip
  }
  
  // Only ask request_type if we truly can't infer it
  if (!params.request_type || params.request_type === "unknown") {
    missing.push("request_type");
  }
  
  // Multi-destination: check if any city in the cities array needs a specific city
  const citiesNeedingCity = citiesArr.filter((c: any) => c.needs_city === true);
  
  // Country given but no specific city — need to ask which city
  if (citiesNeedingCity.length > 0) {
    missing.push("destination_cities");
  } else if (!params.destination_city && params.destination_country) {
    missing.push("destination_city");
  } else if (!params.destination_city && !params.destination_country) {
    missing.push("destination");
  }
  if (!params.origin_city && !params.origin_airport) missing.push("origin");
  
  // For flight_only, we need less info
  const isFlightOnly = params.request_type === "flight_only";
  const isHotelOnly = params.request_type === "hotel_only";
  
  if (!params.depart_date && !params.duration_days) missing.push("dates");
  if (!isFlightOnly && params.depart_date && !params.duration_days && !params.return_date) missing.push("duration");
  
  // Auto-infer travel_type from passenger breakdown before checking
  if (!params.travel_type && params.travelers_confirmed) {
    const a = params.adults || 0, c = params.children || 0, inf = params.infants || 0;
    if (c > 0 || inf > 0) params.travel_type = "family";
    else if (a === 1) params.travel_type = "solo";
    else if (a === 2) params.travel_type = "couple";
    else if (a >= 3) params.travel_type = "group";
    if (params.travel_type) console.log(`[TripPlanner] Info-gather: auto-inferred travel_type=${params.travel_type}`);
  }
  // Also infer family if infants/children mentioned even without full confirmation
  if (!params.travel_type && (Number(params.infants || 0) > 0 || Number(params.children || 0) > 0)) {
    params.travel_type = "family";
    console.log(`[TripPlanner] Info-gather: auto-inferred travel_type=family from infant/child presence`);
  }
  
  if (!isFlightOnly && !isHotelOnly && !params.travel_type) missing.push("travel_type");
  if (!isFlightOnly && !isHotelOnly && params.travel_type && ["family", "group", "business"].includes(params.travel_type) && !params.travelers_confirmed) missing.push("travelers");
  if (isFlightOnly && params.travel_type && ["family", "group", "business"].includes(params.travel_type) && !params.travelers_confirmed) missing.push("travelers");
  // Don't ask for travel_style — it auto-defaults to "comfortable"
  
  // Build context of what we already know
  const known: string[] = [];
  if (params.request_type && params.request_type !== "unknown") known.push(`looking for: ${params.request_type.replace("_", " ")}`);
  if (params.destination_country && !params.destination_city) known.push(`country: ${params.destination_country} (but no specific city yet)`);
  if (params.destination_city) known.push(`destination: ${params.destination_city}`);
  if (citiesArr.length > 1) known.push(`multi-destination: ${citiesArr.map((c: any) => `${c.name}${c.needs_city ? ' (needs specific city)' : ''}`).join(' → ')}`);
  if (params.origin_city) known.push(`origin: ${params.origin_city}`);
  if (params.depart_date) known.push(`dates: ${params.depart_date}${params.return_date ? ` to ${params.return_date}` : ""}`);
  if (params.duration_days) known.push(`duration: ${params.duration_days} days`);
  if (params.travel_type) known.push(`travel_type: ${params.travel_type}`);
  if (params.adults) known.push(`adults: ${params.adults}`);
  if (params.travel_style) known.push(`style: ${params.travel_style}`);
  
  // Pick the NEXT missing item in priority order
  const priorityOrder = ["destination", "destination_cities", "destination_city", "request_type", "origin", "dates", "duration", "travel_type", "travelers", "travel_style"];
  const nextMissing = priorityOrder.find(item => missing.includes(item)) || missing[0];

  let prompt = `**CONTEXT — What we already know:** ${known.length > 0 ? known.join(", ") : "nothing yet"}`;
  prompt += `\n**Still needed:** ${missing.join(", ")}`;
  prompt += `\n\n**YOUR TASK:** Ask ONLY about "${nextMissing}" in 1-2 friendly lines.`;
  prompt += `\n\n**CRITICAL RULES:**`;
  prompt += `\n- Acknowledge in ONE short line (max 10 words) with emoji. NO apologies, NO filler, NO recaps.`;
  prompt += `\n- Then ask ONE question about the next missing item`;
  prompt += `\n- NEVER ask about something already in the "known" list above`;
  prompt += `\n- NEVER re-ask for destination, origin, dates, or travelers if already known`;
  prompt += `\n- SCAN full conversation history — treat mentioned details as known`;
  prompt += `\n- Ask ONLY ONE thing. No combined questions.`;

  prompt += `\n\n**FORMATTING — MANDATORY:**`;
  prompt += `\n- Keep acknowledgment to ONE short line — NO paragraph recaps`;
  prompt += `\n- When confirming known details, use a COMPACT summary block:`;
  prompt += `\n  📍 Singapore → Langkawi → Penang → KL`;
  prompt += `\n  📅 Apr 22 · 2A+1I · Budget`;
  prompt += `\n- When listing cities/options, EACH on its own line with emoji:`;
  prompt += `\n  🏝️ **Langkawi** — Pantai Cenang or Kuah Town?`;
  prompt += `\n  🏛️ **Penang** — Georgetown or Batu Ferringhi?`;
  prompt += `\n- NEVER cram city details into a paragraph with commas`;
  prompt += `\n- NEVER list attractions inline after city names`;
  prompt += `\n- Use line breaks between sections (summary → question → options)`;
  prompt += `\n- Max response: 6-8 lines total. Shorter is better.`;
  prompt += `\n- BAD: "You're absolutely right! My apologies. I'm still getting the hang... So, we've got: Singapore (3N4D): Marina Bay Sands, SkyPark..."`;
  prompt += `\n- GOOD: "Got it! ✨\\n\\n📍 Singapore (3N) → Langkawi (2N) → Penang (2N) → KL (6N)\\n📅 Apr 22 · Budget · 2A+1I\\n\\nWhen do you return?"`;

  // Build destination_cities prompt for multi-destination
  const citiesNeedingCityForPrompt = citiesArr.filter((c: any) => c.needs_city === true);
  const destCitiesPrompt = citiesNeedingCityForPrompt.map((c: any) => {
    const suggestions = getSuggestedCities(c.country || c.name, params.travel_type, params.travel_style);
    return `**${c.country || c.name}:** ${suggestions || 'Which city/area?'}`;
  }).join('\n');

  prompt += `\n\n**Question templates by type:**`;
  prompt += `\n- "destination": "Where would you like to travel to?"`;
  prompt += `\n- "destination_cities": "Which areas interest you?\\n${destCitiesPrompt}\\n\\nOr say **'you pick'** 🗺️"`;
  prompt += `\n- "destination_city": "Which area in ${params.destination_country || 'that country'}?\\n${getSuggestedCities(params.destination_country, params.travel_type, params.travel_style)}\\nOr tell me your vibe! 🗺️"`;
  prompt += `\n- "request_type": "What are you looking for?\\n✈️ **Flights** · 🏨 **Hotels** · 🗺️ **Full Trip**"`;
  prompt += `\n- "origin": "Where will you be travelling from?"`;
  prompt += `\n- "dates": "When are you planning to travel?"`;
  prompt += `\n- "duration": "How many days/nights?"`;
  prompt += `\n- "travel_type": "Who's traveling? Solo, couple, family, group, or honeymoon?"`;
  prompt += `\n- "travelers": "How many adults, children (2-11), and infants (<2)?"`;
  prompt += `\n- "travel_style": "Budget 💰, comfortable ✨, or luxury 👑?"`;
  prompt += `\n\nDo NOT generate an itinerary. Keep it warm and SHORT.`;
  prompt += `\n\n**LANGUAGE — ABSOLUTE LOCK:** You MUST reply in the EXACT SAME language as the user's LATEST message. English input = English reply. NEVER switch languages. If unsure, use English.`;
  
  return { prompt, missingFields: missing };
}

// Suggest popular cities for a country
function getSuggestedCities(country: string | null, travelType?: string | null, travelStyle?: string | null): string {
  if (!country) return "";
  const key = country.toLowerCase();
  
  // Context-aware suggestions: different recommendations based on travel type/style
  const contextSuggestions: Record<string, Record<string, string>> = {
    "maldives": {
      "honeymoon": "🏝️ **Maafushi** (budget-friendly local island) • **Hulhumalé** (modern, near airport) • **Resort Islands** (luxury overwater villas) • **Addu City** (secluded southern atoll)",
      "luxury": "🏝️ **North Malé Atoll** (premium resorts) • **Baa Atoll** (UNESCO biosphere) • **Ari Atoll** (world-class diving) • **Resort Islands** (overwater villas)",
      "budget": "🏝️ **Maafushi** (best budget island) • **Hulhumalé** (city-style, affordable) • **Thulusdhoo** (surfing & budget stays) • **Dhigurah** (whale shark island)",
      "default": "🏝️ **Malé** (capital city) • **Maafushi** (popular local island) • **Hulhumalé** (modern island) • **Resort Islands** (luxury experience)",
    },
    "thailand": {
      "honeymoon": "🏖️ **Phuket** (romantic beaches) • **Koh Samui** (island luxury) • **Krabi** (dramatic scenery) • **Chiang Mai** (mountain romance)",
      "family": "🏖️ **Phuket** (family-friendly beaches) • **Bangkok** (culture & fun) • **Chiang Mai** (elephant sanctuaries) • **Hua Hin** (quiet beach town)",
      "default": "🏖️ **Bangkok** (capital, culture) • **Phuket** (beaches) • **Chiang Mai** (mountains) • **Pattaya** (nightlife) • **Krabi** (nature)",
    },
    "indonesia": {
      "honeymoon": "🌴 **Bali** (romantic) • **Lombok** (quieter alternative) • **Gili Islands** (secluded) • **Raja Ampat** (paradise diving)",
      "default": "🌴 **Bali** (most popular) • **Jakarta** (capital) • **Yogyakarta** (culture) • **Lombok** (beaches) • **Komodo** (adventure)",
    },
    "greece": {
      "honeymoon": "🏛️ **Santorini** (iconic sunsets) • **Mykonos** (vibrant) • **Crete** (largest island) • **Rhodes** (historical)",
      "default": "🏛️ **Athens** (capital) • **Santorini** (sunsets) • **Mykonos** (island life) • **Crete** (diverse island)",
    },
  };

  // Check if we have context-aware suggestions
  if (contextSuggestions[key]) {
    const styleKey = travelType === "honeymoon" ? "honeymoon" : travelStyle || "default";
    return contextSuggestions[key][styleKey] || contextSuggestions[key]["default"] || "";
  }

  // Fallback to simple list
  const suggestions: Record<string, string> = {
    "bangladesh": "Dhaka, Cox's Bazar, Sylhet, Chittagong, Sundarbans",
    "india": "Delhi, Mumbai, Kolkata, Goa, Jaipur, Kerala, Varanasi",
    "japan": "Tokyo, Osaka, Kyoto, Hiroshima, Sapporo",
    "malaysia": "Kuala Lumpur, Langkawi, Penang, Kota Kinabalu",
    "turkey": "Istanbul, Cappadocia, Antalya, Bodrum",
    "egypt": "Cairo, Luxor, Sharm El Sheikh, Alexandria",
    "saudi arabia": "Jeddah, Riyadh, Makkah, Madinah",
    "uae": "Dubai, Abu Dhabi, Sharjah",
    "singapore": "Singapore",
    "nepal": "Kathmandu, Pokhara, Chitwan",
    "sri lanka": "Colombo, Kandy, Ella, Galle, Sigiriya",
    "vietnam": "Hanoi, Ho Chi Minh City, Da Nang, Hoi An, Ha Long Bay",
    "south korea": "Seoul, Busan, Jeju Island",
    "france": "Paris, Nice, Lyon, Marseille",
    "italy": "Rome, Venice, Florence, Milan, Amalfi Coast",
    "spain": "Barcelona, Madrid, Seville, Malaga",
    "uk": "London, Edinburgh, Manchester, Oxford",
    "usa": "New York, Los Angeles, Miami, San Francisco, Las Vegas",
    "australia": "Sydney, Melbourne, Gold Coast, Perth",
    "morocco": "Marrakech, Casablanca, Fes, Chefchaouen",
    "kenya": "Nairobi, Mombasa, Maasai Mara",
    "mexico": "Cancun, Mexico City, Playa del Carmen, Tulum",
    "cambodia": "Siem Reap, Phnom Penh",
    "philippines": "Manila, Cebu, Boracay, Palawan",
    "china": "Beijing, Shanghai, Guangzhou, Chengdu",
    "pakistan": "Lahore, Islamabad, Karachi, Hunza",
    "switzerland": "Zurich, Geneva, Interlaken, Lucerne",
    "germany": "Berlin, Munich, Frankfurt, Hamburg",
    "portugal": "Lisbon, Porto, Faro, Madeira",
    "netherlands": "Amsterdam, Rotterdam, The Hague",
    "canada": "Toronto, Vancouver, Montreal, Banff",
    "brazil": "Rio de Janeiro, São Paulo, Salvador",
    "colombia": "Bogotá, Cartagena, Medellín",
    "peru": "Lima, Cusco, Machu Picchu",
    "argentina": "Buenos Aires, Mendoza, Patagonia",
    "south africa": "Cape Town, Johannesburg, Kruger National Park",
    "fiji": "Nadi, Suva, Coral Coast, Mamanuca Islands",
    "mauritius": "Port Louis, Grand Baie, Flic en Flac, Le Morne",
    "seychelles": "Mahé, Praslin, La Digue",
    "croatia": "Dubrovnik, Split, Zagreb, Hvar",
    "jordan": "Amman, Petra, Aqaba, Dead Sea",
  };
  return suggestions[key] || "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const totalTimer = timer();

    // ── Read body FIRST to avoid BadResource if client disconnects during later async work ──
    const { messages, currency: requestCurrency, refinements, languageSession: incomingLangSession, hasItinerary: clientHasItinerary, itinerarySummary } = await req.json();

    // ── ULTRA-FAST greeting shortcut — no DB, no AI, instant response ──
    const lastMsg = (messages?.[messages.length - 1]?.content || "").trim();
    if (/^(hi|hello|hey|thanks|thank you|ok|okay|bye|good morning|good evening|sup|yo|howdy|hola|bonjour|namaste|salam|assalamu)[\s!.?]*$/i.test(lastMsg)) {
      console.log("[TripPlanner] Greeting shortcut — instant reply, zero DB/AI calls");
      const greetReply = clientHasItinerary
        ? "Hey! 👋 Need any tweaks to your trip? I can swap hotels, adjust activities, find better flights — just say the word!"
        : "Hey! I'm Vela ✈️ — your personal travel planner. Where's your next adventure? Tell me the destination and I'll find you the best deals on flights, hotels & experiences! 🌍";
      return new Response(
        JSON.stringify({ reply: greetReply, languageSession: incomingLangSession }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Always require authentication ──
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "LOGIN_REQUIRED", message: "Please log in to use the AI Trip Planner." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "LOGIN_REQUIRED", message: "Your session has expired. Please log in again." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Rate limit by IP as secondary control ──
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const now = Date.now();
    const windowMs = 60_000;
    const maxRequests = 20;
    
    const g = globalThis as any;
    if (!g.__tripPlannerRateLimit) g.__tripPlannerRateLimit = new Map();
    const rl = g.__tripPlannerRateLimit as Map<string, number[]>;
    const timestamps = (rl.get(clientIp) || []).filter(t => now - t < windowMs);
    if (timestamps.length >= maxRequests) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Please wait a moment." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    timestamps.push(now);
    rl.set(clientIp, timestamps);
    if (rl.size > 500) {
      for (const [ip, ts] of rl) { if (ts.every(t => now - t > windowMs)) rl.delete(ip); }
    }
    const displayCurrency = requestCurrency || "USD";
    if (refinements) {
      console.log("[TripPlanner] Received refinement overrides:", JSON.stringify(refinements));
    }
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "messages array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let lastUserMessage = [...messages].reverse().find((m: any) => m.role === "user")?.content || "";
    
    console.log(`[TripPlanner] Received ${messages.length} messages, last user: "${lastUserMessage.slice(0, 80)}"`);
    
    // ── AI Intent Classification ──
    const hasExistingItinerary = clientHasItinerary === true;
    
    // ── OPTIMIZATION: Skip AI intent call for obvious new trips ──
    // When no itinerary exists and message is dense (long text, bullet points, dates),
    // it's always "new_trip" — skip the ~900ms Gemini Flash Lite call entirely.
    let intent: IntentType;
    const hasTripSignals = lastUserMessage.length > 100 || 
      /\d+n\d*d|\d+\s*nights?/i.test(lastUserMessage) ||
      /[▪️•\-\*]/.test(lastUserMessage) ||
      (/\b(from|to|visit|trip|travel|fly|book)\b/i.test(lastUserMessage) && /\d/.test(lastUserMessage));
    
    if (!hasExistingItinerary && hasTripSignals) {
      intent = "new_trip";
      console.log(`[TripPlanner] Intent=new_trip (fast-path: no itinerary + trip signals, skipped AI classifier)`);
    } else {
      const recentMessages = messages.slice(-4).map((m: any) => `${m.role}: ${(m.content || "").slice(0, 150)}`).join("\n");
      intent = await classifyIntent(lastUserMessage, hasExistingItinerary, recentMessages);
      console.log(`[TripPlanner] Intent=${intent}, hasItinerary=${hasExistingItinerary}`);
    }
    
    // ── Context-aware affirmation override ──
    // When user says "ok do it", "go ahead", "yes" after a budget/preference discussion,
    // override chat → modify_trip so it triggers preference update instead of generic chat
    if (intent === "chat" && hasExistingItinerary) {
      const isAffirmation = /^(ok|okay|yes|yep|yeah|sure|go\s*ahead|do\s*it|ok\s*do\s*it|let'?s?\s*do\s*it|alright|fine|proceed|please|yea|ya|absolutely|definitely|for\s*sure|sounds?\s*good|let'?s\s*go)[\s!.?]*$/i.test(lastUserMessage.trim());
      if (isAffirmation) {
        const recentBotMessages = messages.slice(-4).filter((m: any) => m.role === "assistant").map((m: any) => (m.content || "").toLowerCase()).join(" ");
        const hasBudgetContext = /budget[\s-]*friend|free\s*attract|save\s*money|cheaper|lower\s*cost|affordable|budget\s*opt|local\s*experience|free\s*activit/i.test(recentBotMessages);
        const hasLuxuryContext = /luxury|premium|upscale|5[\s-]*star|five[\s-]*star|high[\s-]*end/i.test(recentBotMessages);
        const hasDirectFlightContext = /direct\s*flight|non[\s-]*stop|nonstop/i.test(recentBotMessages);
        const hasBreakfastContext = /breakfast\s*includ|with\s*breakfast/i.test(recentBotMessages);
        
        if (hasBudgetContext || hasLuxuryContext || hasDirectFlightContext || hasBreakfastContext) {
          intent = "modify_trip";
          console.log(`[TripPlanner] Affirmation override: chat → modify_trip (budget=${hasBudgetContext}, luxury=${hasLuxuryContext}, direct=${hasDirectFlightContext}, breakfast=${hasBreakfastContext})`);
          // Rewrite message for detectPreferenceUpdate to catch
          if (hasBudgetContext) lastUserMessage = "make it budget-friendly";
          else if (hasLuxuryContext) lastUserMessage = "make it luxury";
          else if (hasDirectFlightContext) lastUserMessage = "direct flights only";
          else if (hasBreakfastContext) lastUserMessage = "include breakfast";
        }
      }
    }

    // ── Context-aware visa/travel follow-up override ──
    // When user replies with just a country name after the bot asked "what passport do you hold?",
    // re-classify as travel_query and inject visa context
    if (intent === "chat" || intent === "new_trip") {
      const recentBotMsgs = messages.slice(-3).filter((m: any) => m.role === "assistant").map((m: any) => (m.content || "").toLowerCase()).join(" ");
      const botAskedPassport = /passport|nationality|which country|what country|citizen/i.test(recentBotMsgs);
      const botAskedVisa = /visa\s*require|visa\s*depend|embassy/i.test(recentBotMsgs);
      if (botAskedPassport || botAskedVisa) {
        // Check if user's reply is a country name
        const countryFollowUp: Record<string, string> = {
          bangladesh: "BD", india: "IN", pakistan: "PK", nepal: "NP", "sri lanka": "LK",
          china: "CN", japan: "JP", "south korea": "KR", thailand: "TH", vietnam: "VN",
          philippines: "PH", malaysia: "MY", singapore: "SG", indonesia: "ID", myanmar: "MM",
          usa: "US", "united states": "US", uk: "GB", "united kingdom": "GB",
          canada: "CA", australia: "AU", germany: "DE", france: "FR", italy: "IT",
          spain: "ES", turkey: "TR", egypt: "EG", "saudi arabia": "SA", uae: "AE",
          qatar: "QA", oman: "OM", bahrain: "BH", jordan: "JO", brazil: "BR",
          nigeria: "NG", "south africa": "ZA", kenya: "KE", ghana: "GH", mexico: "MX",
          russia: "RU", ukraine: "UA", iran: "IR", iraq: "IQ", afghanistan: "AF",
          bangladeshi: "BD", indian: "IN", pakistani: "PK", nepali: "NP", chinese: "CN",
          japanese: "JP", korean: "KR", thai: "TH", vietnamese: "VN", filipino: "PH",
          malaysian: "MY", singaporean: "SG", indonesian: "ID", american: "US", british: "GB",
          canadian: "CA", australian: "AU", german: "DE", french: "FR", italian: "IT",
          spanish: "ES", turkish: "TR", egyptian: "EG", saudi: "SA", emirati: "AE", qatari: "QA",
          brazilian: "BR", nigerian: "NG", mexican: "MX", russian: "RU",
        };
        const userLower = lastUserMessage.toLowerCase().trim();
        const matchedCode = countryFollowUp[userLower] || countryFollowUp[userLower.replace(/[.!?]/g, "")];
        if (matchedCode) {
          intent = "travel_query";
          // Reconstruct the visa question from conversation context
          const prevUserMsgs = messages.slice(-6).filter((m: any) => m.role === "user").map((m: any) => (m.content || "").toLowerCase());
          const destCountryFromContext = prevUserMsgs.find((msg: string) => /visa|passport|need.*for|travel.*to/i.test(msg));
          if (destCountryFromContext) {
            lastUserMessage = `${destCountryFromContext} — my passport is from ${lastUserMessage}`;
          } else {
            lastUserMessage = `visa requirements for ${lastUserMessage} passport`;
          }
          console.log(`[TripPlanner] Visa follow-up override: chat → travel_query, reconstructed: "${lastUserMessage.slice(0, 80)}"`);
        }
      }
    }

    // ── travel_query: Handle flight status and visa requirement lookups ──
    if (intent === "travel_query") {
      console.log("[TripPlanner] Travel query detected, checking for flight status or visa");
      const detection = detectLanguageRich(lastUserMessage, undefined);
      const langSession = resolveSessionLanguage(lastUserMessage, detection, incomingLangSession || null);
      const langDirective = buildLanguageLock(langSession);

      let apiContext = "";

      // ── Flight status detection ──
      const flightMatch = lastUserMessage.match(/\b([A-Z]{2})\s*(\d{1,4})\b/i);
      if (flightMatch && /\b(status|on\s*time|delay|cancel|gate|terminal|track|check|land|depart|arriv|flight|how|is|where|when|what|update)\b/i.test(lastUserMessage.toLowerCase())) {
        const flightNum = (flightMatch[1] + flightMatch[2]).toUpperCase();
        // Extract date or use today
        const dateMatch = lastUserMessage.match(/(\d{4}[-\/]\d{1,2}[-\/]\d{1,2})|(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})/);
        const today = new Date().toISOString().split("T")[0];
        const flightDate = dateMatch ? dateMatch[0].replace(/\//g, "-") : today;
        
        console.log(`[TripPlanner] Calling flight-status API: ${flightNum} on ${flightDate}`);
        try {
          const sbAdmin = getSupabaseAdmin();
          const { data: fsData, error: fsError } = await sbAdmin.functions.invoke("flight-status", {
            body: { flight_number: flightNum, date: flightDate },
          });
          if (fsData && fsData.success && fsData.flights?.length > 0) {
            // Strip UTC fields — only keep local times for display
            const cleanFlights = fsData.flights.map((fl: any) => {
              const clean = { ...fl };
              if (clean.departure) {
                const { scheduled_utc, actual_utc, predicted_utc, ...depRest } = clean.departure;
                clean.departure = depRest;
              }
              if (clean.arrival) {
                const { scheduled_utc, actual_utc, predicted_utc, ...arrRest } = clean.arrival;
                clean.arrival = arrRest;
              }
              delete clean.last_updated_utc;
              return clean;
            });
            apiContext += `\n\n**FLIGHT STATUS API DATA** (live data — present this to the user):\nIMPORTANT: All times shown are LOCAL TIMES at the respective airport. Always say "(Local Time)" when presenting times. Format: "Landed in [City] at [HH:MM] (Local Time)" or "Departed from [City] at [HH:MM] (Local Time)".\n${JSON.stringify(cleanFlights, null, 1)}`;
            apiContext += `\nSources used: ${fsData.source || "unknown"}`;
            console.log(`[TripPlanner] Flight status API returned ${fsData.flights.length} flights from ${fsData.source}`);
          } else {
            apiContext += `\n\n**FLIGHT STATUS API**: No data found for flight ${flightNum} on ${flightDate}. ${fsError ? `Error: ${fsError.message}` : "The flight may not exist or data is unavailable."}`;
            console.log(`[TripPlanner] Flight status API: no data. Error: ${fsError?.message || "none"}`);
          }
        } catch (fsErr: any) {
          console.error(`[TripPlanner] Flight status API call failed: ${fsErr.message}`);
          apiContext += `\n\n**FLIGHT STATUS API**: Unable to check flight status at this time. Suggest the user try the Flight Status page directly.`;
        }
      }

      // ── Visa requirement detection ──
      const visaLower = lastUserMessage.toLowerCase();
      if (/\b(visa|passport)\b/.test(visaLower)) {
        // Try to extract passport country code (2-letter ISO)
        const countryCodeMatch = lastUserMessage.match(/\b([A-Z]{2})\b\s*(passport|citizen|national)/i) ||
          lastUserMessage.match(/(passport|citizen|national)\s*(?:of|from)?\s*\b([A-Z]{2})\b/i);
        
        // Common country name to code mapping for visa queries
        const countryNameToCode: Record<string, string> = {
          bangladesh: "BD", india: "IN", pakistan: "PK", nepal: "NP", "sri lanka": "LK",
          china: "CN", japan: "JP", "south korea": "KR", thailand: "TH", vietnam: "VN",
          philippines: "PH", malaysia: "MY", singapore: "SG", indonesia: "ID", myanmar: "MM",
          usa: "US", "united states": "US", uk: "GB", "united kingdom": "GB",
          canada: "CA", australia: "AU", germany: "DE", france: "FR", italy: "IT",
          spain: "ES", turkey: "TR", egypt: "EG", "saudi arabia": "SA", uae: "AE",
          qatar: "QA", oman: "OM", bahrain: "BH", jordan: "JO", brazil: "BR",
          nigeria: "NG", "south africa": "ZA", kenya: "KE", ghana: "GH", mexico: "MX",
          russia: "RU", ukraine: "UA", iran: "IR", iraq: "IQ", afghanistan: "AF",
        };
        
        let passportCode = countryCodeMatch ? (countryCodeMatch[1]?.length === 2 ? countryCodeMatch[1] : countryCodeMatch[2]) : null;
        
        // Try to find country name in the message
        if (!passportCode) {
          for (const [name, code] of Object.entries(countryNameToCode)) {
            if (visaLower.includes(name) && /\b(passport|from|citizen|national|holder)\b/.test(visaLower)) {
              passportCode = code;
              break;
            }
          }
        }

        if (passportCode) {
          passportCode = passportCode.toUpperCase();
          console.log(`[TripPlanner] Calling visa-requirements API for passport: ${passportCode}`);
          try {
            const sbAdmin = getSupabaseAdmin();
            const { data: visaData, error: visaError } = await sbAdmin.functions.invoke("visa-requirements", {
              body: { passport_country: passportCode },
            });
            if (visaData && visaData.requirements?.length > 0) {
              // Filter to relevant destinations if mentioned in the message
              let relevantReqs = visaData.requirements;
              const destCountries = Object.entries(countryNameToCode)
                .filter(([name]) => visaLower.includes(name) && name !== Object.entries(countryNameToCode).find(([, c]) => c === passportCode)?.[0])
                .map(([, code]) => code);
              
              if (destCountries.length > 0) {
                relevantReqs = visaData.requirements.filter((r: any) => destCountries.includes(r.destination_country));
                if (relevantReqs.length === 0) relevantReqs = visaData.requirements.slice(0, 10); // fallback
              } else {
                relevantReqs = relevantReqs.slice(0, 15); // limit for context size
              }
              
              apiContext += `\n\n**VISA REQUIREMENTS API DATA** (passport: ${passportCode}):\n${JSON.stringify(relevantReqs, null, 1)}`;
              console.log(`[TripPlanner] Visa API returned ${visaData.requirements.length} entries, showing ${relevantReqs.length}`);
            } else {
              apiContext += `\n\n**VISA API**: No visa data available for passport country ${passportCode}. ${visaError ? `Error: ${visaError.message}` : ""}`;
            }
          } catch (visaErr: any) {
            console.error(`[TripPlanner] Visa API call failed: ${visaErr.message}`);
            apiContext += `\n\n**VISA API**: Unable to check visa requirements at this time.`;
          }
        } else {
          apiContext += `\n\n**VISA**: User asked about visas but no passport nationality was specified. Ask the user which passport/nationality they hold.`;
        }
      }

      // ── Holiday / festival detection ──
      const holidayLower = lastUserMessage.toLowerCase();
      if (/\b(holiday|holidays|public\s*holiday|festival|festivals|eid|diwali|christmas|new\s*year|puja|durga|navratri|holi|vesak|songkran|chuseok|lunar\s*new\s*year)\b/i.test(holidayLower)) {
        const holidayCountryMap: Record<string, string> = {
          bangladesh: "BD", india: "IN", pakistan: "PK", nepal: "NP", "sri lanka": "LK",
          china: "CN", japan: "JP", "south korea": "KR", korea: "KR", thailand: "TH", vietnam: "VN",
          philippines: "PH", malaysia: "MY", singapore: "SG", indonesia: "ID", myanmar: "MM",
          usa: "US", "united states": "US", uk: "GB", "united kingdom": "GB",
          canada: "CA", australia: "AU", germany: "DE", france: "FR", italy: "IT",
          spain: "ES", turkey: "TR", "türkiye": "TR", egypt: "EG", "saudi arabia": "SA",
          uae: "AE", "united arab emirates": "AE", qatar: "QA", oman: "OM", bahrain: "BH",
          jordan: "JO", brazil: "BR", nigeria: "NG", "south africa": "ZA", kenya: "KE",
          ghana: "GH", mexico: "MX", russia: "RU", ukraine: "UA", iran: "IR", iraq: "IQ",
          afghanistan: "AF", morocco: "MA", tunisia: "TN", algeria: "DZ", ethiopia: "ET",
          tanzania: "TZ", uganda: "UG", cambodia: "KH", laos: "LA", maldives: "MV",
          bhutan: "BT", mongolia: "MN", peru: "PE", colombia: "CO", argentina: "AR",
          chile: "CL", ecuador: "EC", cuba: "CU", jamaica: "JM", "costa rica": "CR",
          portugal: "PT", netherlands: "NL", belgium: "BE", austria: "AT", switzerland: "CH",
          sweden: "SE", norway: "NO", denmark: "DK", finland: "FI", ireland: "IE",
          greece: "GR", croatia: "HR", hungary: "HU", poland: "PL", "czech republic": "CZ",
          czechia: "CZ", romania: "RO", serbia: "RS", bulgaria: "BG",
          "new zealand": "NZ", fiji: "FJ", kuwait: "KW", lebanon: "LB",
        };

        let holidayCountryCode: string | null = null;
        // Check 2-letter codes in message
        const twoLetterMatch = lastUserMessage.match(/\b([A-Z]{2})\b/);
        if (twoLetterMatch) holidayCountryCode = twoLetterMatch[1];
        // Try country name lookup
        if (!holidayCountryCode) {
          for (const [name, code] of Object.entries(holidayCountryMap)) {
            if (holidayLower.includes(name)) {
              holidayCountryCode = code;
              break;
            }
          }
        }

        if (holidayCountryCode) {
          holidayCountryCode = holidayCountryCode.toUpperCase();
          const todayStr = new Date().toISOString().split("T")[0];
          console.log(`[TripPlanner] Looking up holidays for country: ${holidayCountryCode}`);
          try {
            const sbAdmin = getSupabaseAdmin();
            const { data: holidays } = await sbAdmin
              .from("high_demand_dates")
              .select("date, label")
              .eq("country", holidayCountryCode)
              .gte("date", todayStr)
              .order("date", { ascending: true })
              .limit(20);

            if (holidays && holidays.length > 0) {
              const formatted = holidays.map((h: any) => `${h.label} — ${h.date}`).join("\n");
              apiContext += `\n\n**UPCOMING HOLIDAYS** (country: ${holidayCountryCode}, live database data):\n${formatted}`;
              console.log(`[TripPlanner] Found ${holidays.length} upcoming holidays for ${holidayCountryCode}`);
            } else {
              apiContext += `\n\n**HOLIDAYS**: No upcoming holiday data found for country code ${holidayCountryCode}. The holiday database may not have been synced for this country yet. Provide general knowledge about major holidays in this country.`;
              console.log(`[TripPlanner] No holiday data for ${holidayCountryCode}`);
            }
          } catch (holErr: any) {
            console.error(`[TripPlanner] Holiday lookup failed: ${holErr.message}`);
            apiContext += `\n\n**HOLIDAYS**: Unable to look up holidays right now. Use general knowledge to answer.`;
          }
        } else {
          apiContext += `\n\n**HOLIDAYS**: User asked about holidays but no specific country was identified. Ask them which country they want holiday information for.`;
        }
      }

      // Generate AI response with API data context — use a FOCUSED prompt (no itinerary rules)
      const travelQuerySystemPrompt = `You are Vela AI — TravelVela's personal travel concierge. You're warm, knowledgeable, and conversational — like a helpful friend who works in travel.

The user asked a travel question and we've fetched REAL DATA from our systems. Use this data to give a clear, helpful answer.

RULES:
- Use the API data below to answer. NEVER say you can't access data when it's provided.
- Be natural and conversational — not robotic. Sound like a knowledgeable travel agent, not a search engine.
- For flight status: present times with city names, use "(Local Time)" labels. Example: "BS325 has landed safely in Dhaka at 22:13 (Local Time) ✈️"
- For visa info: present requirements clearly and helpfully. If you have data, share it confidently.
- For holidays: present as a clean list with dates and names.
- Keep responses concise but warm — 2-4 sentences max for simple queries.
- After answering, you can naturally ask if they need help planning a trip there.
- NEVER mention UTC times. All flight times are local.
- Reply in the EXACT language of the user's latest message.

${apiContext}
${langDirective}`;

      let tqReply: string | null = null;
      const tqContents = messages.slice(-6).map((m: { role: string; content: string }) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content.slice(0, 500) }],
      }));
      tqReply = await callAIWithFallback(
        ["gemini-2.5-flash", "gemini-3-flash-preview", "gemini-2.5-flash-lite"],
        tqContents, 0.7, 600, travelQuerySystemPrompt
      );

      return new Response(
        JSON.stringify({
          reply: tqReply || "I wasn't able to look that up right now. You can try the Flight Status page or check visa requirements on your embassy's website.",
          languageSession: langSession,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── modify_trip: Check if it's a preference-only change that can be applied locally ──
    if (intent === "modify_trip" && hasExistingItinerary) {
      const prefUpdate = detectPreferenceUpdate(lastUserMessage);
      if (prefUpdate && Object.keys(prefUpdate.refinements).length > 0 && !prefUpdate.refinements._needs_regeneration) {
        console.log(`[TripPlanner] Preference-only modification detected:`, JSON.stringify(prefUpdate));
        
        // Generate a short conversational acknowledgment
        const detection = detectLanguageRich(lastUserMessage, undefined);
        const langSession = resolveSessionLanguage(lastUserMessage, detection, incomingLangSession || null);
        
        let ackReply: string | null = null;
        const ackPrompt = `You are a travel planning assistant. The user asked to modify their existing trip plan. Their request: "${lastUserMessage}". The following preference changes will be applied automatically: ${JSON.stringify(prefUpdate.refinements)}. Respond with a SHORT (1-2 sentence) friendly acknowledgment that the change is being applied. Do NOT regenerate or describe the itinerary. Just confirm.` + CORE_RULES + buildLanguageLock(langSession);
        const ackContents = [{ role: "user", parts: [{ text: ackPrompt + "\n\nUser: " + lastUserMessage }] }];
        ackReply = await callAIWithFallback(
          ["gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-3-flash-preview"],
          ackContents, 0.7, 200
        );
        if (!ackReply) {
          ackReply = prefUpdate.defaultAck || "✅ Got it! Applying your changes now...";
        }
        
        return new Response(
          JSON.stringify({
            reply: ackReply,
            refinement_update: prefUpdate.refinements,
            languageSession: langSession || incomingLangSession,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ── modify_trip: Check if it's a minor fix (day-specific or general itinerary tweak) ──
    if (intent === "modify_trip" && hasExistingItinerary && itinerarySummary) {
      const minorFix = detectMinorFix(lastUserMessage);
      if (minorFix) {
        console.log(`[TripPlanner] Minor fix detected: day=${minorFix.dayIndex}, action="${minorFix.action}"`);
        const detection = detectLanguageRich(lastUserMessage, undefined);
        const langSession = resolveSessionLanguage(lastUserMessage, detection, incomingLangSession || null);

        // itinerarySummary is now structured JSON: { days: [{ day, title, city, activities: [...] }] }
        const summaryDays = typeof itinerarySummary === "string" ? null : (itinerarySummary?.days || (Array.isArray(itinerarySummary) ? itinerarySummary : null));
        const isWholeItinerary = minorFix.dayIndex === null;
        const targetData = isWholeItinerary
          ? (summaryDays || itinerarySummary)
          : (Array.isArray(summaryDays) ? summaryDays[minorFix.dayIndex!] : null);
        console.log(`[TripPlanner] Minor fix target: isWhole=${isWholeItinerary}, hasData=${!!targetData}, daysCount=${Array.isArray(summaryDays) ? summaryDays.length : 'N/A'}`);

        if (targetData) {
          try {
            const scope = isWholeItinerary ? "the ENTIRE itinerary" : `Day ${minorFix.dayIndex! + 1}`;
            const fixPrompt = `You are a travel itinerary optimizer. The user wants a minor fix to ${scope} of their trip.

CURRENT ${isWholeItinerary ? "ITINERARY" : `DAY ${minorFix.dayIndex! + 1}`} PLAN:
${JSON.stringify(targetData, null, 1)}

USER REQUEST: "${lastUserMessage}"
ACTION TYPE: ${minorFix.action}

${isWholeItinerary ? `Return a JSON object: { "day_patches": [ { "dayIndex": 0, "activities": [...] }, ... ], "explanation": "short summary" }
Only include days that ACTUALLY CHANGED. Do NOT include unchanged days.` : `Return a JSON object: { "activities": [...], "explanation": "short summary of changes" }`}

Each activity: { "time": "HH:MM", "activity": "Name", "description": "1 sentence", "cost_estimate": number, "category": "activity|food|transport|flight|hotel", "source": "keep_original_value", "product_code": "keep_original_value" }

RULES:
- For REMOVE: Remove the specified activity. If user also says "add X", add X in a logical time slot on the same day.
- For DUPLICATE fixes: Remove the duplicate/overlapping activity. Keep the better/more specific one.
- For SWAP: Replace the specified activity with a better alternative.
- For ADD: Add the requested activity in a logical time slot.
- For REORDER: Optimize geographic clustering and chronological flow.
- For TIMING: Adjust the time of the specified activity.
- Preserve flight, hotel, and transport activities exactly as-is (include them in your response unchanged).
- CRITICAL: Return ALL activities for each changed day (both unchanged AND changed). Only OMIT activities you want to DELETE.
- CRITICAL: When keeping an existing activity, you MUST preserve its EXACT "activity" name, "product_code", "source", "cost_estimate", and all other fields UNCHANGED. Do NOT rephrase or rewrite activity names. Copy them VERBATIM from the current plan.
- Only NEW activities (that you are adding) should have source="day-fix" and product_code=null.
- Times must be chronological. No duplicates of the same venue.
- Do NOT regenerate the whole plan. Make the MINIMUM changes needed.
${SHARED_RULES}`;

            console.log(`[TripPlanner] Minor fix prompt length: ${fixPrompt.length}`);
            let aiReply: string | null = null;
            const fixContents = [{ role: "user", parts: [{ text: fixPrompt + "\n\nUser: " + lastUserMessage }] }];
            aiReply = await callAIWithFallback(
              ["gemini-2.5-flash", "gemini-3-flash-preview", "gemini-2.5-flash-lite"],
              fixContents, 0.3, isWholeItinerary ? 4000 : 2000
            );

            if (aiReply) {
              console.log(`[TripPlanner] Minor fix AI reply length: ${aiReply.length}, preview: ${aiReply.substring(0, 200)}`);
              // Try to extract JSON - use greedy match for the outermost object
              const jsonMatch = aiReply.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/) || aiReply.match(/(\{[\s\S]*(?:"activities"|"day_patches")[\s\S]*\})/);
              if (jsonMatch) {
                try {
                  const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);

                  // Server-side merge: restore metadata from original activities
                  // that the AI might have dropped or renamed
                  const mergeActivitiesWithOriginal = (aiActs: any[], originalActs: any[]) => {
                    if (!originalActs?.length) return aiActs;
                    const origMap = new Map<string, any>();
                    for (const o of originalActs) {
                      const key = (o.activity || o.name || "").toLowerCase().trim();
                      if (key) origMap.set(key, o);
                    }
                    return aiActs.map((a: any) => {
                      const aiName = (a.activity || a.name || "").toLowerCase().trim();
                      // Exact match
                      let orig = origMap.get(aiName);
                      // Fuzzy match: check if original name is contained in AI name or vice versa
                      if (!orig) {
                        for (const [key, val] of origMap) {
                          if (key.length >= 5 && aiName.length >= 5 && (aiName.includes(key) || key.includes(aiName))) {
                            orig = val;
                            break;
                          }
                          // Word overlap: ≥60% of shorter's words
                          const aWords = aiName.split(/\s+/).filter((w: string) => w.length > 2);
                          const oWords = key.split(/\s+/).filter((w: string) => w.length > 2);
                          if (aWords.length >= 2 && oWords.length >= 2) {
                            const overlap = aWords.filter((w: string) => oWords.some((ow: string) => ow.includes(w) || w.includes(ow))).length;
                            if (overlap / Math.min(aWords.length, oWords.length) >= 0.6 && overlap >= 2) {
                              orig = val;
                              break;
                            }
                          }
                        }
                      }
                      if (orig) {
                        // Restore original metadata — use original name to prevent title drift
                        return {
                          ...a,
                          activity: orig.activity || orig.name || a.activity,
                          product_code: a.product_code || orig.product_code || null,
                          source: (a.source && a.source !== "day-fix") ? a.source : (orig.source || a.source),
                          cost_estimate: (a.cost_estimate > 0 ? a.cost_estimate : orig.cost_estimate) || 0,
                          description: a.description || orig.description || "",
                          highlights: a.highlights || orig.highlights,
                          places_covered: a.places_covered || orig.places_covered,
                          booking_url: a.booking_url || orig.booking_url,
                          product_name: a.product_name || orig.product_name,
                          is_live_price: orig.is_live_price ?? a.is_live_price,
                          vela_id: a.vela_id || orig.vela_id,
                          slug: a.slug || orig.slug,
                        };
                      }
                      return a;
                    });
                  };

                  // Whole-itinerary patches
                  if (isWholeItinerary && Array.isArray(parsed.day_patches) && parsed.day_patches.length > 0) {
                    console.log(`[TripPlanner] Minor fix (whole): ${parsed.day_patches.length} days patched`);
                    const mergedPatches = parsed.day_patches.map((p: any) => {
                      const di = p.dayIndex ?? p.day_index ?? (p.day ? p.day - 1 : 0);
                      const origDay = Array.isArray(summaryDays) ? summaryDays[di] : null;
                      return {
                        dayIndex: di,
                        activities: mergeActivitiesWithOriginal(p.activities, origDay?.activities || []),
                      };
                    });
                    return new Response(
                      JSON.stringify({
                        reply: parsed.explanation || "✅ Fixed! Check the updated itinerary.",
                        day_fix_multi: mergedPatches,
                        languageSession: langSession || incomingLangSession,
                      }),
                      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                    );
                  }

                  // Single-day fix
                  if (Array.isArray(parsed.activities) && parsed.activities.length > 0) {
                    if (isWholeItinerary) {
                      console.log(`[TripPlanner] Minor fix (whole→flat): ${parsed.activities.length} activities, treating as day_fix_multi for all days`);
                    }
                    const fixDayIndex = minorFix.dayIndex ?? 0;
                    const origDay = Array.isArray(summaryDays) ? summaryDays[fixDayIndex] : null;
                    const mergedActivities = mergeActivitiesWithOriginal(parsed.activities, origDay?.activities || []);
                    console.log(`[TripPlanner] Minor fix (day ${fixDayIndex + 1}): ${mergedActivities.length} activities (${mergedActivities.filter((a: any) => a.product_code).length} with product_code)`);
                    return new Response(
                      JSON.stringify({
                        reply: parsed.explanation || `✅ Fixed Day ${fixDayIndex + 1}!`,
                        day_fix: {
                          dayIndex: fixDayIndex,
                          activities: mergedActivities,
                        },
                        languageSession: langSession || incomingLangSession,
                      }),
                      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                    );
                  }
                  console.warn(`[TripPlanner] Minor fix: parsed JSON but no activities/day_patches found. Keys: ${Object.keys(parsed).join(', ')}`);
                } catch (parseErr: any) {
                  console.error(`[TripPlanner] Minor fix JSON parse failed: ${parseErr.message}`);
                }
              } else {
                console.warn(`[TripPlanner] Minor fix: no JSON found in AI reply`);
              }
            }
          } catch (err: any) {
            console.error(`[TripPlanner] Minor fix AI failed: ${err.message}, falling through`);
          }
        }
        console.log("[TripPlanner] Minor fix could not resolve, falling through to full regeneration");
      }
    }

    // Map intent to trip request flow
    const isTripRequest = intent === "new_trip" || intent === "modify_trip" || 
      (!hasExistingItinerary && isConversationTripRelated(messages) && intent !== "chat");
    
    let tripParams: any = null;
    if (isTripRequest) {
      // ── Phase 1: Extract trip parameters from FULL conversation ──
      const extractTimer = timer();
      
      // Use stronger model for dense multi-city prompts with many mandatory activities
      const mustVisitSignalCount =
        (lastUserMessage.match(/[▪️•\-\*]/g)?.length || 0) +
        (lastUserMessage.match(/\b(?:must\s+visit|want\s+to\s+visit|include|guided\s+trip|express\s+pass|cable\s+car|city\s+tour)\b/gi)?.length || 0);
      const isComplexMessage = lastUserMessage.length > 200 ||
        mustVisitSignalCount >= 4 ||
        (lastUserMessage.match(/\d+n\d*d|\d+\s*nights?/gi)?.length || 0) >= 2;
      console.log(`[TripPlanner] Phase 1: Extracting (complex=${isComplexMessage}, mustVisitSignals=${mustVisitSignalCount}, msgLen=${lastUserMessage.length})`);
      
      // Build compact conversation text for extraction to avoid oversized/noisy LM requests
      let conversationText = buildExtractionConversationText(messages);
      if (!conversationText) {
        conversationText = `User: ${lastUserMessage}`;
      }

      let extractResult: string | null = null;
      const extractUserMsg = "Here is the relevant conversation. Prioritize the latest user corrections if anything conflicts.\n\n" + conversationText;
      
      // 🟢 Extraction: 2.5 Flash → 3.0 Flash → 2.5 Lite (gateway→direct for each, no retries)
      // Simple messages can start with 2.5 Lite for speed
      const extractModels = isComplexMessage
        ? ["gemini-2.5-flash", "gemini-3-flash-preview", "gemini-2.5-flash-lite"]
        : ["gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-3-flash-preview"];
      console.log(`[TripPlanner] Extraction → ${extractModels[0]} (complex=${isComplexMessage})`);
      const contents = buildExtractionContents(conversationText);
      extractResult = await callAIWithFallback(extractModels, contents, 0.2, 3072);

      if (!extractResult) {
        console.error("[TripPlanner] Extraction returned null from all providers");
      }

      extractTimer.log("Phase 1 - Parameter extraction");
      tripParams = extractResult ? parseJsonBlock(extractResult) : null;
      if (!tripParams && extractResult) {
        console.warn("[TripPlanner] Extraction returned no parsable JSON. Raw (first 800 chars):", extractResult.slice(0, 800));
        
        // 🔧 JSON repair: try to extract JSON from thinking-heavy responses
        // Gemini sometimes wraps JSON in markdown or adds preamble text
        const jsonRepairPatterns = [
          // Match JSON object after any preamble text  
          /\{[\s\S]*"origin_city"[\s\S]*\}/,
          /\{[\s\S]*"cities"[\s\S]*\}/,
          /\{[\s\S]*"destination_city"[\s\S]*\}/,
        ];
        for (const pattern of jsonRepairPatterns) {
          const match = extractResult.match(pattern);
          if (match) {
            try {
              tripParams = JSON.parse(match[0]);
              console.log("[TripPlanner] JSON repair succeeded via pattern match");
              break;
            } catch {
              // Try finding balanced braces
              const raw = match[0];
              let depth = 0, start = -1;
              for (let i = 0; i < raw.length; i++) {
                if (raw[i] === '{') { if (depth === 0) start = i; depth++; }
                else if (raw[i] === '}') { depth--; if (depth === 0 && start >= 0) {
                  try { tripParams = JSON.parse(raw.slice(start, i + 1)); console.log("[TripPlanner] JSON repair succeeded via brace balancing"); } catch {}
                  if (tripParams) break;
                }}
              }
              if (tripParams) break;
            }
          }
        }
        
        // Last resort: retry extraction with a tighter prompt if we got text but no JSON
        if (!tripParams) {
          console.log("[TripPlanner] JSON repair failed, retrying extraction with strict prompt...");
          try {
            const strictContents = [
              { role: "user", parts: [{ text: `Extract trip parameters from this text as a SINGLE JSON object. Output ONLY the JSON, no markdown, no explanation.\n\n${conversationText}\n\nJSON schema: ${EXTRACT_PROMPT_LEGACY.split("```json")[1]?.split("```")[0] || ""}` }] },
            ];
            const strictResult = await callGemini("gemini-2.5-flash-lite", strictContents, 0.1, 2048, 0);
            if (strictResult) {
              tripParams = parseJsonBlock(strictResult);
              if (tripParams) console.log("[TripPlanner] Strict retry extraction succeeded");
              else console.warn("[TripPlanner] Strict retry also failed to parse");
            }
          } catch (strictErr: any) {
            console.error("[TripPlanner] Strict retry failed:", strictErr.message);
          }
        }
      } else if (!tripParams) {
        console.warn("[TripPlanner] Extraction returned null from all providers");
      }
      
      // ── Post-extraction passenger count validation ──
      // Regex-check ONLY USER messages for explicit "N adult(s)" / "N child(ren)" / "N infant(s)" to catch AI mis-extractions
      // CRITICAL: Do NOT scan assistant messages — they may echo wrong counts
      if (tripParams) {
        const userOnlyText = messages
          .filter((m: any) => m.role === "user")
          .map((m: any) => m.content)
          .join(" ")
          .toLowerCase();
        const adultMatch = userOnlyText.match(/(\d+)\s*adult/);
        const childMatch = userOnlyText.match(/(\d+)\s*child/);
        const infantMatch = userOnlyText.match(/(\d+)\s*infant/);
        if (adultMatch) {
          const parsedAdults = parseInt(adultMatch[1], 10);
          if (parsedAdults > 0 && tripParams.adults !== parsedAdults) {
            console.log(`[TripPlanner] Passenger correction: AI extracted adults=${tripParams.adults}, but user said ${parsedAdults}. Fixing.`);
            tripParams.adults = parsedAdults;
          }
        }
        if (childMatch) {
          const parsedChildren = parseInt(childMatch[1], 10);
          if (tripParams.children !== parsedChildren) {
            console.log(`[TripPlanner] Passenger correction: AI extracted children=${tripParams.children}, but user said ${parsedChildren}. Fixing.`);
            tripParams.children = parsedChildren;
          }
        }
        if (infantMatch) {
          const parsedInfants = parseInt(infantMatch[1], 10);
          if (tripParams.infants !== parsedInfants) {
            console.log(`[TripPlanner] Passenger correction: AI extracted infants=${tripParams.infants}, but user said ${parsedInfants}. Fixing.`);
            tripParams.infants = parsedInfants;
          }
        }
      }

      // ── Deterministic duration normalization ──
      // RULE: city.nights = NIGHTS, city.days = nights + 1
      // duration_days = sum of all city nights + 1 (departure day)
      if (tripParams && Array.isArray(tripParams.cities) && tripParams.cities.length > 0) {
        const userText = lastUserMessage || conversationText || "";
        const userLower = userText.toLowerCase();
        
        // Strategy: find city sections and extract NnMd notation ONLY (most reliable)
        const cityPositions: { name: string; idx: number; city: any }[] = [];
        for (const city of tripParams.cities) {
          const cName = (city.name || "").toLowerCase();
          const pos = userLower.indexOf(cName);
          if (pos >= 0) cityPositions.push({ name: cName, idx: pos, city });
        }
        cityPositions.sort((a, b) => a.idx - b.idx);
        
        let anyOverride = false;
        
        for (let ci = 0; ci < cityPositions.length; ci++) {
          const cp = cityPositions[ci];
          const nextPos = ci < cityPositions.length - 1 ? cityPositions[ci + 1].idx : userLower.length;
          const section = userText.substring(cp.idx, nextPos);
          
          // Priority 1: NnMd notation (e.g., "3n4d", "2N3D") — most reliable
          const nmdMatch = section.match(/(\d+)\s*[nN]\s*(\d+)\s*[dD]/);
          if (nmdMatch) {
            const nights = parseInt(nmdMatch[1]);
            const days = parseInt(nmdMatch[2]);
            if (nights > 0) {
              cp.city.nights = nights;
              cp.city.days = days > nights ? days : nights + 1;
              console.log(`[TripPlanner] Duration override (NnMd): ${cp.city.name} → nights=${cp.city.nights}, days=${cp.city.days}`);
              anyOverride = true;
            }
            continue;
          }
          
          // Priority 2: Sum all "X nights" in this city's section
          const allNightMentions = [...section.matchAll(/(\d+)\s*nights?\b/gi)];
          if (allNightMentions.length > 0) {
            const sumNights = allNightMentions.reduce((sum, m) => sum + parseInt(m[1]), 0);
            if (sumNights > 0) {
              cp.city.nights = sumNights;
              cp.city.days = sumNights + 1;
              console.log(`[TripPlanner] Duration override (sum nights): ${cp.city.name} → nights=${sumNights}, days=${sumNights + 1}`);
              anyOverride = true;
            }
          }
          
          // Priority 3: If AI only gave days (old schema), derive nights
          if (!cp.city.nights && cp.city.days) {
            cp.city.nights = cp.city.days; // old schema: days = nights
            cp.city.days = cp.city.nights + 1;
            console.log(`[TripPlanner] Backward compat: ${cp.city.name} days(old) → nights=${cp.city.nights}, days=${cp.city.days}`);
            anyOverride = true;
          }
        }
        
        // ── Normalize ALL cities: ensure nights + days fields exist ──
        for (const city of tripParams.cities) {
          if (!city.nights && city.days) {
            // Backward compat: old schema where days = nights
            city.nights = city.days;
            city.days = city.nights + 1;
          } else if (city.nights && !city.days) {
            city.days = city.nights + 1;
          } else if (!city.nights && !city.days) {
            city.nights = 2;
            city.days = 3;
          }
          // Ensure days >= nights + 1
          if (city.days <= city.nights) {
            city.days = city.nights + 1;
          }
        }

        // ── Preferred hotel rescue: move hotel/resort names from special_notes ──
        const hotelKeywords = /\b(hotel|resort|suites?|lodge|inn|villa|hostel|motel|mansion|palace|château|boutique\s+stay|serviced\s+apartment)/i;
        if (Array.isArray(tripParams.user_special_notes)) {
          const rescued: string[] = [];
          tripParams.user_special_notes = tripParams.user_special_notes.filter((note: string) => {
            if (hotelKeywords.test(note)) {
              rescued.push(note);
              return false;
            }
            return true;
          });
          if (rescued.length > 0) {
            // Try to assign rescued hotels to cities
            if (!tripParams.user_preferred_hotels) tripParams.user_preferred_hotels = {};
            for (const hotelNote of rescued) {
              // Find which city this hotel belongs to
              let assigned = false;
              for (const city of tripParams.cities) {
                const cName = (city.name || "").toLowerCase();
                if (hotelNote.toLowerCase().includes(cName) || (city.preferred_hotel == null)) {
                  if (!city.preferred_hotel) {
                    city.preferred_hotel = hotelNote;
                    console.log(`[TripPlanner] Hotel rescue: "${hotelNote}" → city ${city.name}`);
                    assigned = true;
                    break;
                  }
                }
              }
              if (!assigned) {
                (tripParams.user_preferred_hotels as any)["_unassigned"] = hotelNote;
                console.log(`[TripPlanner] Hotel rescue: "${hotelNote}" → unassigned (user_preferred_hotels)`);
              }
            }
          }
        }

        // ── Validate preferred_hotel: reject if it contains another city's name ──
        const cityNames = tripParams.cities.map((c: any) => (c.name || "").toLowerCase());
        for (const city of tripParams.cities) {
          if (city.preferred_hotel) {
            const hLower = city.preferred_hotel.toLowerCase();
            const ownName = (city.name || "").toLowerCase();
            // If preferred_hotel text contains a DIFFERENT city name, it's misassigned
            const wrongCity = cityNames.find((cn: string) => cn !== ownName && cn.length > 3 && hLower.includes(cn));
            if (wrongCity) {
              console.log(`[TripPlanner] Rejected preferred_hotel "${city.preferred_hotel}" for ${city.name} — contains other city "${wrongCity}"`);
              // Try to reassign to the correct city
              const targetCity = tripParams.cities.find((c: any) => (c.name || "").toLowerCase() === wrongCity);
              if (targetCity && !targetCity.preferred_hotel) {
                // Extract just the hotel name from the misassigned string
                const hotelMatch = city.preferred_hotel.match(/([^(]+)/);
                const cleanHotel = hotelMatch ? hotelMatch[1].replace(new RegExp(wrongCity, "gi"), "").replace(/^\s*\(\s*|\s*\)\s*$/g, "").replace(/^\s+|\s+$/g, "").replace(/\d+\s*nights?\s*(and\s*)?/gi, "").replace(/self\s*managed\s*accommodation/gi, "").trim() : "";
                if (cleanHotel.length > 2) {
                  targetCity.preferred_hotel = cleanHotel;
                  console.log(`[TripPlanner] Reassigned hotel "${cleanHotel}" → ${targetCity.name}`);
                }
              }
              city.preferred_hotel = null;
            }
          }
        }

        // ── Fix self_managed_nights from text ──
        const fullText = lastUserMessage || conversationText || "";
        for (const city of tripParams.cities) {
          const cName = (city.name || "").toLowerCase();
          // Look for "X nights self managed" near city name
          const selfManagedRx = new RegExp(`${cName.replace(/\s+/g, "\\s+")}[^.]*?(\\d+)\\s*nights?\\s*(self[\\s-]*managed|own\\s*accommodation|airbnb|staying\\s*with)`, "i");
          const smMatch = fullText.match(selfManagedRx);
          if (smMatch) {
            const smNights = parseInt(smMatch[1]);
            if (smNights > 0 && smNights <= (city.nights || 99)) {
              if (city.self_managed_nights !== smNights) {
                console.log(`[TripPlanner] self_managed_nights fix: ${city.name} → ${smNights} (was ${city.self_managed_nights})`);
                city.self_managed_nights = smNights;
              }
            }
          }
        }

        // ── Clean instruction-like preferred_hotel values ──
        const NON_HOTEL_PHRASES = /\b(pick|choose|your choice|any hotel|best hotel|suggest|at your|recommend)\b/i;
        for (const city of tripParams.cities) {
          if (city.preferred_hotel) {
            // Strip leading/trailing noise (colons, "Stay/", trailing prepositions)
            city.preferred_hotel = city.preferred_hotel
              .replace(/^[:\s]+/, '')
              .replace(/^Stay\/?/i, '')
              .replace(/\s+(for|in|at|the|and)\s*$/i, '')
              .trim();
            // If it's an instruction, not a hotel name, clear it
            if (NON_HOTEL_PHRASES.test(city.preferred_hotel)) {
              console.log(`[TripPlanner] Cleared instruction-like preferred_hotel for ${city.name}: "${city.preferred_hotel}"`);
              city.preferred_hotel = null;
            }
          }
        }

        // ── Recover Penang-style hotel prefs from original text ──
        const fullTextForHotel = lastUserMessage || conversationText || "";
        for (const city of tripParams.cities) {
          if (!city.preferred_hotel) {
            const cName = (city.name || "").toLowerCase();
            // Match patterns like "Pick a Resorts in Batu Ferringi area" near the city context
            const areaResortRx = new RegExp(`(?:resorts?|hotel|stay|lodge|villa)\\s+(?:in|at|near)\\s+([A-Za-z\\s]+?)\\s*(?:area|beach|zone)?(?=[,\\.]|$)`, "gi");
            let m;
            while ((m = areaResortRx.exec(fullTextForHotel)) !== null) {
              const areaName = m[1].trim();
              // Check if this area belongs to this city's must_visit
              const mustVisitLower = (city.must_visit || []).map((mv: string) => mv.toLowerCase());
              if (mustVisitLower.some((mv: string) => mv.includes(areaName.toLowerCase()) || areaName.toLowerCase().includes(mv))) {
                city.preferred_hotel = `Resort in ${areaName} area`;
                console.log(`[TripPlanner] Recovered hotel preference for ${city.name}: "${city.preferred_hotel}"`);
                break;
              }
            }
          }
        }

        // ── Bi-directional sync: user_preferred_hotels ↔ city.preferred_hotel ──
        if (!tripParams.user_preferred_hotels || Object.keys(tripParams.user_preferred_hotels).length === 0) {
          tripParams.user_preferred_hotels = {};
        }
        // Sync city → map
        for (const city of tripParams.cities) {
          if (city.preferred_hotel && !(tripParams.user_preferred_hotels as any)[city.name]) {
            (tripParams.user_preferred_hotels as any)[city.name] = city.preferred_hotel;
            console.log(`[TripPlanner] Synced user_preferred_hotels: ${city.name} → "${city.preferred_hotel}"`);
          }
        }
        // Reverse sync map → city (when AI put it in the map but not city-level)
        for (const city of tripParams.cities) {
          if (!city.preferred_hotel && (tripParams.user_preferred_hotels as any)[city.name]) {
            const mapVal = (tripParams.user_preferred_hotels as any)[city.name];
            // Also clean map values
            const cleanMapVal = mapVal.replace(/\s+(for|in|at|the|and)\s*$/i, '').trim();
            if (!NON_HOTEL_PHRASES.test(cleanMapVal) && cleanMapVal.length > 2) {
              city.preferred_hotel = cleanMapVal;
              console.log(`[TripPlanner] Reverse-synced preferred_hotel: ${city.name} → "${city.preferred_hotel}"`);
            } else {
              delete (tripParams.user_preferred_hotels as any)[city.name];
              console.log(`[TripPlanner] Cleaned instruction from user_preferred_hotels: ${city.name}`);
            }
          }
        }
        // Clean map entries that are instructions
        for (const [k, v] of Object.entries(tripParams.user_preferred_hotels || {})) {
          if (typeof v === 'string' && NON_HOTEL_PHRASES.test(v)) {
            delete (tripParams.user_preferred_hotels as any)[k];
          }
        }

        // ── Auto-detect country for known cities ──
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
        for (const city of tripParams.cities) {
          if (!city.country) {
            const found = KNOWN_COUNTRIES[(city.name || "").toLowerCase()];
            if (found) {
              city.country = found;
              console.log(`[TripPlanner] Auto-detected country: ${city.name} → ${found}`);
            }
          }
        }
        
        // ── Recalculate total from city nights ──
        let totalNights = 0;
        for (const city of tripParams.cities) {
          totalNights += Number(city.nights || 1);
        }
        
        // Total trip days = total nights + 1
        const correctDuration = totalNights + 1;
        if (tripParams.duration_days !== correctDuration) {
          console.log(`[TripPlanner] Duration override: duration_days ${tripParams.duration_days} → ${correctDuration} (total_nights=${totalNights} + 1)`);
          tripParams.duration_days = correctDuration;
          anyOverride = true;
        }
        
        // Fix return_date
        if (anyOverride && tripParams.depart_date) {
          try {
            const dep = new Date(tripParams.depart_date);
            dep.setDate(dep.getDate() + totalNights);
            tripParams.return_date = dep.toISOString().split("T")[0];
            console.log(`[TripPlanner] Return date recalculated: ${tripParams.return_date}`);
          } catch {}
        }
      }

      // ── Post-extraction "direct flight" detection ──
      // Deterministic regex check: if user says "direct flight", "nonstop", "non-stop", "no layover", "no transit"
      if (tripParams) {
        const directText = (conversationText || lastUserMessage || "").toLowerCase();
        if (/\b(direct\s*flight|nonstop|non[\s-]stop|no\s*layover|no\s*transit|no\s*connecting)\b/.test(directText)) {
          if (!tripParams.prefer_direct) {
            console.log(`[TripPlanner] Direct flight preference detected from user text. Setting prefer_direct=true.`);
            tripParams.prefer_direct = true;
          }
        }
      }


      // If the AI model missed must_visit items, recover them from user text
      if (tripParams && Array.isArray(tripParams.cities) && tripParams.cities.length > 0) {
        tripParams = recoverMustVisitFromText(tripParams, lastUserMessage, conversationText);
        
        // ── OPTIMIZATION: Deduplicate must-visit items (normalize parenthetical/spacing variants) ──
        // Two normalization levels:
        // 1. baseKey: strips ALL parenthetical content + separators → catches "Universal studio" vs "Universal studio- (Express pass)"
        // 2. fullKey: keeps parenthetical content → catches exact string duplicates
        const baseKeyMV = (s: string) => s.toLowerCase().replace(/\s*[-–]\s*\(.*?\)\s*$/g, "").replace(/\s*\(.*?\)\s*/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
        const fullKeyMV = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s()]/g, " ").replace(/\s+/g, " ").trim();
        
        for (const city of tripParams.cities) {
          if (!Array.isArray(city.must_visit)) continue;
          
          // FIRST: Split concatenated entries like "Sky Bridge, Cenang Beach, City Tour"
          const expanded: string[] = [];
          for (const item of city.must_visit) {
            if (item.includes(",") && item.length > 20) {
              const stripped = item.replace(/\([^)]*\)/g, "");
              const commasOutside = stripped.split(",").length - 1;
              if (commasOutside >= 2) {
                const parts = item.split(/,\s*(?![^(]*\))/).map((p: string) => p.trim()).filter((p: string) => p.length >= 3);
                if (parts.length >= 2) {
                  expanded.push(...parts);
                  console.log(`[TripPlanner] Split concatenated must_visit: "${item}" → ${parts.length} items`);
                  continue;
                }
              }
            }
            expanded.push(item);
          }
          
          // THEN: Deduplicate — when two entries share the same BASE name (e.g., "Universal studio" and
          // "Universal studio- (Express pass)"), keep the one WITH parenthetical notes (more info).
          // Also remove entries that match the preferred_hotel name.
          const seen = new Map<string, string>(); // baseKey → best original
          for (const item of expanded) {
            const bk = baseKeyMV(item);
            // Skip items that are actually the preferred hotel name
            if (city.preferred_hotel && baseKeyMV(city.preferred_hotel) === bk) {
              console.log(`[TripPlanner] Removed "${item}" from must_visit (matches preferred_hotel "${city.preferred_hotel}")`);
              continue;
            }
            const existing = seen.get(bk);
            if (!existing) {
              seen.set(bk, item);
            } else {
              // Keep the one with parenthetical notes (more info)
              const existingHasParen = /\(/.test(existing);
              const itemHasParen = /\(/.test(item);
              if (itemHasParen && !existingHasParen) {
                console.log(`[TripPlanner] Dedup: "${existing}" → "${item}" (keeping parenthetical version)`);
                seen.set(bk, item);
              } else if (item.length > existing.length && !existingHasParen) {
                seen.set(bk, item); // Keep longer name if neither has parens
              }
            }
          }
          const before = city.must_visit.length;
          city.must_visit = Array.from(seen.values());
          if (before !== city.must_visit.length) {
            console.log(`[TripPlanner] Deduped ${city.name} must_visit: ${before} → ${city.must_visit.length}`);
          }
        }
        {
          // Collect all preferred hotel names for filtering
          const hotelNames = new Set<string>();
          for (const city of tripParams.cities) {
            if (city.preferred_hotel) hotelNames.add(baseKeyMV(city.preferred_hotel));
          }
          
          const masterSeen = new Map<string, string>();
          for (const city of tripParams.cities) {
            for (const mv of (city.must_visit || [])) {
              const key = baseKeyMV(mv);
              // Also filter hotel preferences from master list
              if (hotelNames.has(key)) continue;
              if (!masterSeen.has(key)) masterSeen.set(key, mv);
            }
          }
          if (Array.isArray(tripParams.user_must_visit)) {
            for (const item of tripParams.user_must_visit) {
              if (item.includes(",")) {
                const stripped = item.replace(/\([^)]*\)/g, "");
                const commasOutside = stripped.split(",").length - 1;
                if (commasOutside >= 2) {
                  const parts = item.split(/,\s*(?![^(]*\))/).map((p: string) => p.trim()).filter((p: string) => p.length >= 3);
                  for (const part of parts) {
                    const key = baseKeyMV(part);
                    if (!hotelNames.has(key) && !masterSeen.has(key)) masterSeen.set(key, part);
                  }
                  continue;
                }
              }
              const key = baseKeyMV(item);
              if (hotelNames.has(key)) continue;
              const existing = masterSeen.get(key);
              if (!existing) {
                masterSeen.set(key, item);
              } else if (/\(/.test(item) && !/\(/.test(existing)) {
                masterSeen.set(key, item);
              }
            }
          }
          // Clean trailing dashes/punctuation from all entries
          tripParams.user_must_visit = Array.from(masterSeen.values()).map(
            (s: string) => s.replace(/[-–—\s]+$/, "").trim()
          );
          // Also clean per-city must_visit
          for (const city of tripParams.cities) {
            if (Array.isArray(city.must_visit)) {
              city.must_visit = city.must_visit.map((s: string) => s.replace(/[-–—\s]+$/, "").trim());
            }
          }
        }
      }
      
      // ── Merge UI refinement overrides into extracted params ──
      if (tripParams && refinements) {
        if (refinements.adults != null) tripParams.adults = refinements.adults;
        if (refinements.children != null) tripParams.children = refinements.children;
        if (refinements.infants != null) tripParams.infants = refinements.infants;
        if (refinements.cabin_class) tripParams.cabin_class = refinements.cabin_class;
        if (refinements.hotel_stars) tripParams.hotel_stars_preference = refinements.hotel_stars;
        if (refinements.travel_style) tripParams.travel_style = refinements.travel_style;
        if (refinements.prefer_direct) tripParams.prefer_direct = true;
        if (refinements.budget_min != null || refinements.budget_max != null) {
          tripParams.budget_usd = refinements.budget_max || tripParams.budget_usd;
          tripParams._budget_range = [refinements.budget_min || 0, refinements.budget_max || 10000];
        }
        if (refinements.flexible_dates === false) tripParams._flexible_dates = false;
        // If we got explicit adult counts from UI, mark travelers as confirmed
        if (refinements.adults != null) tripParams.travelers_confirmed = true;
        console.log("[TripPlanner] Params after refinement merge:", JSON.stringify(tripParams));
      }
      
      // ── Post-extraction universal city recovery: catch ANY city the AI may have dropped ──
      if (tripParams && Array.isArray(tripParams.cities) && tripParams.cities.length > 0) {
        const extractedCityNames = new Set(tripParams.cities.map((c: any) => c.name?.toLowerCase()));
        const userText = lastUserMessage || "";
        
        // Universal regex: find all "CityName ( XnYd)" or "CityName (Xn)" patterns in user text
        const cityNightPatterns = [...userText.matchAll(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s*\(\s*(\d+)\s*n\s*\d*\s*d?\s*\)/gi)];
        
        for (const pMatch of cityNightPatterns) {
          const rawName = pMatch[1].trim();
          const nights = parseInt(pMatch[2], 10);
          if (!rawName || nights <= 0 || nights > 30) continue;
          if (extractedCityNames.has(rawName.toLowerCase())) continue;
          
          // Also skip if it's already extracted under a different casing/variant
          const isAlreadyExtracted = tripParams.cities.some((c: any) => 
            c.name?.toLowerCase().includes(rawName.toLowerCase()) || rawName.toLowerCase().includes(c.name?.toLowerCase())
          );
          if (isAlreadyExtracted) continue;

          // Find the section of text belonging to this city (until next city pattern)
          const cityIdx = userText.indexOf(pMatch[0]);
          const allCityPositions = cityNightPatterns
            .map(m => ({ pos: userText.indexOf(m[0]), name: m[1] }))
            .concat(tripParams.cities.map((c: any) => ({ pos: userText.toLowerCase().indexOf(c.name?.toLowerCase()), name: c.name })))
            .filter(p => p.pos > cityIdx)
            .sort((a, b) => a.pos - b.pos);
          const nextCityPos = allCityPositions.length > 0 ? allCityPositions[0].pos : userText.length;
          const citySection = userText.slice(cityIdx, nextCityPos);
          const mustVisit = [...citySection.matchAll(/▪️\s*([^\n▪️]+)/g)].map(m => m[1].trim()).filter(Boolean);
          
          // Resolve country from known city map
          const CITY_COUNTRY_MAP: Record<string, string> = {
            "singapore": "Singapore", "hong kong": "Hong Kong", "macau": "Macau",
            "dubai": "UAE", "doha": "Qatar", "bangkok": "Thailand", "phuket": "Thailand",
            "chiang mai": "Thailand", "tokyo": "Japan", "osaka": "Japan", "kyoto": "Japan",
            "seoul": "South Korea", "istanbul": "Turkey", "bali": "Indonesia",
            "jakarta": "Indonesia", "hanoi": "Vietnam", "ho chi minh": "Vietnam",
            "phnom penh": "Cambodia", "siem reap": "Cambodia", "manila": "Philippines",
            "cebu": "Philippines", "langkawi": "Malaysia", "penang": "Malaysia",
            "kuala lumpur": "Malaysia", "malacca": "Malaysia", "kota kinabalu": "Malaysia",
            "colombo": "Sri Lanka", "galle": "Sri Lanka", "kathmandu": "Nepal",
            "dhaka": "Bangladesh", "delhi": "India", "mumbai": "India", "goa": "India",
            "jaipur": "India", "kolkata": "India", "chennai": "India",
            "paris": "France", "london": "UK", "rome": "Italy", "barcelona": "Spain",
            "athens": "Greece", "santorini": "Greece", "amsterdam": "Netherlands",
            "zurich": "Switzerland", "vienna": "Austria", "prague": "Czech Republic",
            "cairo": "Egypt", "marrakech": "Morocco", "nairobi": "Kenya",
            "sydney": "Australia", "melbourne": "Australia", "auckland": "New Zealand",
            "new york": "USA", "los angeles": "USA", "cancun": "Mexico",
            "male": "Maldives", "maafushi": "Maldives",
          };
          const country = CITY_COUNTRY_MAP[rawName.toLowerCase()] || null;
          
          console.log(`[TripPlanner] 🔧 Recovery: Adding dropped city "${rawName}" (${nights}n) with ${mustVisit.length} must-visits, country=${country}`);
          const recoveredCity = {
            name: rawName,
            nights,
            days: nights + 1,
            country,
            needs_city: false,
            must_visit: mustVisit,
            preferred_hotel: null,
            self_managed_nights: 0,
            free_days: 0,
            _recovered: true,
          };
          // Find correct insertion position based on text order
          let insertIdx = 0;
          for (let i = 0; i < tripParams.cities.length; i++) {
            const existingIdx = userText.toLowerCase().indexOf(tripParams.cities[i].name?.toLowerCase());
            if (existingIdx >= 0 && existingIdx < cityIdx) insertIdx = i + 1;
          }
          tripParams.cities.splice(insertIdx, 0, recoveredCity);
          extractedCityNames.add(rawName.toLowerCase());
        }
        
        // Recalculate duration if any cities were recovered
        if (tripParams.cities.some((c: any) => c._recovered)) {
          const totalNights = tripParams.cities.reduce((s: number, c: any) => s + (c.nights || 0), 0);
          tripParams.duration_days = totalNights + 1;
          if (tripParams.depart_date) {
            const d = new Date(tripParams.depart_date);
            d.setDate(d.getDate() + tripParams.duration_days);
            tripParams.return_date = d.toISOString().split("T")[0];
          }
          console.log(`[TripPlanner] 🔧 Recovery: Recovered ${tripParams.cities.filter((c: any) => c._recovered).length} cities, updated duration to ${tripParams.duration_days}d (${totalNights}n)`);
        }
      }
      
      console.log("[TripPlanner] Extracted params:", JSON.stringify(tripParams));
    } else {
      console.log("[TripPlanner] Simple chat detected, skipping extraction");
    }

    // If not a trip request, respond conversationally
    if (!tripParams || tripParams.is_trip_request === false) {
      // Detect if it's a trivial greeting — return INSTANTLY without any AI call
      const isGreeting = /^(hi|hello|hey|thanks|thank you|ok|okay|bye|good morning|good evening|sup|yo|howdy|hola|bonjour|namaste|salam|assalamu)[\s!.?]*$/i.test(lastUserMessage.trim());

      if (isGreeting) {
        console.log("[TripPlanner] Greeting detected — returning instant deterministic reply");
        const detection = detectLanguageRich(lastUserMessage, tripParams?.user_language);
        const langSession = resolveSessionLanguage(lastUserMessage, detection, incomingLangSession || null);
        const greetingReply = clientHasItinerary
          ? "Hey! 👋 Need any tweaks to your trip? I can swap hotels, adjust activities, find better flights — just say the word!"
          : "Hey! I'm Vela ✈️ — your personal travel planner. Where's your next adventure? Tell me the destination and I'll find you the best deals on flights, hotels & experiences! 🌍";
        return new Response(
          JSON.stringify({ reply: greetingReply, languageSession: langSession }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("[TripPlanner] Not a trip request, responding conversationally");

      const detection = detectLanguageRich(lastUserMessage, tripParams?.user_language);
      const langSession = resolveSessionLanguage(lastUserMessage, detection, incomingLangSession || null);
      const langDirective = buildLanguageLock(langSession);

      // For greetings: skip DB context entirely for maximum speed
      let chatSystemPrompt = CHAT_PROMPT_EN;
      if (!isGreeting) {
        try {
          // Race DB queries with a 3s timeout so they don't block the response
          const dbTimeout = new Promise<[string, string]>((resolve) => setTimeout(() => resolve(["", ""]), 3000));
          const dbFetch = Promise.all([
            getAirlineContext(lastUserMessage).catch(() => ""),
            fetchTripInsights(getSupabaseAdmin()).catch(() => ""),
          ]);
          const [airlineContext, insightsContext] = await Promise.race([dbFetch, dbTimeout]);
          chatSystemPrompt += airlineContext + insightsContext;
        } catch { /* use base prompt */ }
      }

      // Inject itinerary context so AI can answer questions about the generated plan
      if (itinerarySummary && clientHasItinerary) {
        chatSystemPrompt += `\n\n**CURRENT ITINERARY CONTEXT** (the user has a generated trip plan — answer questions about it, do NOT regenerate):\n${typeof itinerarySummary === 'string' ? itinerarySummary : JSON.stringify(itinerarySummary)}`;
      }

      const chatSystemPromptWithLang = chatSystemPrompt + langDirective;

      // Deterministic fallback for when AI is unavailable
      const FALLBACK_REPLIES: Record<string, string> = {
        greeting: "Hey! I'm Vela ✈️ — your personal travel planner. Where's your next adventure? Tell me the destination and I'll find you the best deals! 🌍",
        default: "I'd love to help plan your next trip! Just tell me where you want to go and when ✈️",
      };

      // Race AI call against a hard 10s timeout to guarantee response
      let chatReply: string | null = null;
      const aiCallPromise = (async () => {
        const chatContentsForGemini = messages.slice(-6).map((m: { role: string; content: string }) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content.slice(0, 500) }],
        }));
        return await callAIWithFallback(
          ["gemini-2.5-flash-lite", "gemini-2.5-flash"],
          chatContentsForGemini, 0.7, 256, chatSystemPromptWithLang
        );
      })();

      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => {
        console.warn("[TripPlanner] Chat AI timed out (10s), using deterministic fallback");
        resolve(null);
      }, 10000));

      chatReply = await Promise.race([aiCallPromise, timeoutPromise]);

      return new Response(
        JSON.stringify({
          reply: chatReply || (isGreeting ? FALLBACK_REPLIES.greeting : FALLBACK_REPLIES.default),
          languageSession: langSession,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Validate destination_city is not a country name (before sufficiency check) ──
    const countryNamesSet = new Set([
      "maldives", "thailand", "indonesia", "greece", "japan", "south korea", "china",
      "india", "bangladesh", "pakistan", "nepal", "sri lanka", "bhutan", "myanmar",
      "vietnam", "cambodia", "laos", "philippines", "malaysia", "singapore",
      "turkey", "egypt", "morocco", "kenya", "tanzania", "south africa",
      "uae", "united arab emirates", "qatar", "saudi arabia", "oman", "bahrain", "jordan", "lebanon",
      "france", "italy", "spain", "uk", "united kingdom", "germany", "switzerland", "austria",
      "netherlands", "portugal", "croatia", "czech republic", "hungary", "poland",
      "australia", "new zealand", "fiji", "mauritius", "seychelles",
      "usa", "united states", "canada", "mexico", "brazil", "colombia", "peru", "argentina",
      "cuba", "costa rica", "panama", "jamaica",
    ]);
    if (tripParams.destination_city && countryNamesSet.has(tripParams.destination_city.toLowerCase())) {
      console.log("[TripPlanner] destination_city is a country, moving to destination_country and asking for city", tripParams.destination_city);
      if (!tripParams.destination_country) tripParams.destination_country = tripParams.destination_city;
      tripParams.destination_city = null;
      tripParams.hotel_city_name = null;
    }

    // ── Auto-resolve multi-destination cities BEFORE sufficiency check ──
    if (Array.isArray(tripParams.cities) && tripParams.cities.length > 0) {
      tripParams.cities = tripParams.cities.map((c: any) => {
        const nameIsCountry = c.name && countryNamesSet.has(c.name.toLowerCase());
        // If needs_city but name is NOT a country, it's already a specific city — clear the flag
        if (c.needs_city && !nameIsCountry) {
          console.log(`[TripPlanner] Early: "${c.name}" is already a city, clearing needs_city`);
          return { ...c, needs_city: false };
        }
        if (!c.needs_city && !nameIsCountry) return c;
        const lookupKey = c.country || c.name;
        const resolved = autoResolveCity(lookupKey, tripParams.travel_type, tripParams.travel_style);
        if (resolved) {
          console.log(`[TripPlanner] Early auto-resolved ${lookupKey} -> ${resolved}`);
          return { ...c, name: resolved, needs_city: false, auto_resolved: true };
        }
        return c;
      });
      // Update destination_city from first resolved city if not set
      const firstResolved = tripParams.cities.find((c: any) => !c.needs_city);
      if (firstResolved && !tripParams.destination_city) {
        tripParams.destination_city = firstResolved.name;
        tripParams.hotel_city_name = firstResolved.name;
      }
    }
    // Also auto-resolve single-destination country
    if (!tripParams.destination_city && tripParams.destination_country) {
      const resolved = autoResolveCity(tripParams.destination_country, tripParams.travel_type, tripParams.travel_style);
      if (resolved) {
        console.log(`[TripPlanner] Early auto-resolved single dest ${tripParams.destination_country} -> ${resolved}`);
        tripParams.destination_city = resolved;
        tripParams.hotel_city_name = resolved;
      }
    }

    // ── HYBRID MODE DETECTION ──
    // Classify: inspiration (too vague), hybrid_preview (destination + intent, missing booking fields), search_ready (full)
    const hasDestination = !!(tripParams.destination_city || tripParams.destination_country || (Array.isArray(tripParams.cities) && tripParams.cities.length > 0));
    const missingDates = !tripParams.depart_date;
    const missingOrigin = !tripParams.origin_city && !tripParams.origin_airport;
    const missingDuration = !tripParams.duration_days && !tripParams.return_date;
    const hasTripIntent = !!(tripParams.travel_type || tripParams.travel_style || /honeymoon|romantic|family|adventure|budget|luxury|trip|travel|holiday|vacation/i.test(lastUserMessage));

    // Pure inspiration: even destination is too vague (e.g. "somewhere romantic in asia")
    const isPureInspiration = !hasDestination && hasTripIntent;
    // Hybrid preview: destination known + intent exists, but missing booking details
    const isHybridCandidate = hasDestination && hasTripIntent && (missingDates || missingOrigin);

    if (!hasSufficientInfo(tripParams) && (isPureInspiration || isHybridCandidate)) {
      const destName = tripParams.destination_city || tripParams.destination_country || (tripParams.cities?.[0]?.name) || "your destination";
      const travelType = tripParams.travel_type || "leisure";
      const travelStyle = tripParams.travel_style || "comfortable";

      // Build clarification prompts based on what's actually missing
      const clarificationPrompts: string[] = [];
      const missingForExact: string[] = [];
      // If duration is known, we only need a start date — label it accordingly
      const hasDuration = !missingDuration;
      if (missingDates && hasDuration) {
        clarificationPrompts.push("Your departure date");
        missingForExact.push("Travel dates");
      } else if (missingDates && missingDuration) {
        // Need both — but asking for dates (with return) covers duration, so skip separate duration ask
        clarificationPrompts.push("Your travel dates");
        missingForExact.push("Travel dates");
      }
      if (missingOrigin) { clarificationPrompts.push("Your departure city"); missingForExact.push("Departure city"); }
      // Only ask for duration separately if dates aren't being asked (dates with return imply duration)
      if (missingDuration && !missingDates) { clarificationPrompts.push("How many days/nights"); missingForExact.push("Trip duration"); }
      if (!tripParams.travelers_confirmed) missingForExact.push("Number of travelers");

      // Detect resort/honeymoon context
      const isResortDest = /maldives?|seychelles?|bora\s*bora|fiji|zanzibar|palawan|siargao|turks|bali|phuket|langkawi|mauritius|koh\s*samui|krabi|boracay|santorini|mykonos/i.test(destName);
      const isHoneymoon = /honeymoon|romantic|anniversary|couple/i.test(`${travelType} ${travelStyle}`);

      // ── AUTO-FILL ENGINE ──
      const assumptions: { key: string; value: string; source: string; confidence: number; booking_safe: boolean }[] = [];
      const autoFilled: any = {};

      // Travelers
      if (!tripParams.travelers_confirmed) {
        if (isHoneymoon || travelType === "couple") {
          autoFilled.adults = 2; autoFilled.children = 0; autoFilled.infants = 0;
          assumptions.push({ key: "Travelers", value: "2 Adults", source: "inferred", confidence: 0.85, booking_safe: false });
        } else {
          autoFilled.adults = 2; autoFilled.children = 0; autoFilled.infants = 0;
          assumptions.push({ key: "Travelers", value: "2 Adults", source: "default", confidence: 0.5, booking_safe: false });
        }
      } else {
        autoFilled.adults = tripParams.adults || 2;
        autoFilled.children = tripParams.children || 0;
        autoFilled.infants = tripParams.infants || 0;
      }

      // Duration
      if (missingDuration) {
        const defaultNights = isResortDest ? (isHoneymoon ? 5 : 4) : 4;
        autoFilled.duration_nights = defaultNights;
        assumptions.push({ key: "Duration", value: `${defaultNights} nights`, source: "inferred", confidence: 0.6, booking_safe: false });
      } else {
        autoFilled.duration_nights = (tripParams.duration_days || 5) - 1;
      }

      // Budget tier
      const budgetTier = travelStyle === "luxury" ? "premium" : travelStyle === "budget" ? "budget" : isHoneymoon ? "mid-premium" : "mid-range";
      assumptions.push({ key: "Budget tier", value: budgetTier, source: travelStyle ? "user" : "inferred", confidence: travelStyle ? 0.9 : 0.6, booking_safe: false });

      // Cabin class
      const cabinClass = tripParams.cabin_class || (travelStyle === "luxury" ? "Business" : "Economy");
      if (!tripParams.cabin_class) {
        assumptions.push({ key: "Cabin", value: cabinClass, source: "inferred", confidence: 0.7, booking_safe: false });
      }

      // ── AI PROMPT: Generate inspiration + preview packages together ──
      const resortContext = isResortDest ? `This is a RESORT/ISLAND destination. Focus on resort experience.${isHoneymoon ? " HONEYMOON trip — romantic, private, premium." : ""}` : "";

      // Build budget constraint — use the user's display currency directly
      const userBudgetMax = tripParams.budget_max ?? tripParams._budget_range?.[1] ?? null;
      const userBudgetCurrency = tripParams.budget_currency || displayCurrency;
      const currencySymbols: Record<string, string> = {
        USD: "$", EUR: "€", GBP: "£", BDT: "৳", INR: "₹", MYR: "RM", SGD: "S$",
        AED: "د.إ", SAR: "﷼", THB: "฿", IDR: "Rp", PHP: "₱", LKR: "Rs",
        PKR: "₨", NPR: "Rs", KRW: "₩", JPY: "¥", CNY: "¥", AUD: "A$", CAD: "C$",
        NZD: "NZ$", ZAR: "R", TRY: "₺", EGP: "E£", BRL: "R$", MXN: "MX$",
      };
      const userSymbol = currencySymbols[displayCurrency] || displayCurrency;
      const budgetConstraint = userBudgetMax
        ? `\nIMPORTANT BUDGET CONSTRAINT: The user's maximum budget is ${userSymbol}${userBudgetMax.toLocaleString()} ${displayCurrency} total. ALL packages MUST be within this budget. If the destination is too expensive, suggest realistic alternatives (e.g., guesthouses, shorter stays).`
        : "";

      const hybridPrompt = `Generate trip preview for: "${destName}" as a "${travelType}" trip, style: "${travelStyle}".
${resortContext}
Travelers: ${autoFilled.adults} adults${autoFilled.children ? `, ${autoFilled.children} children` : ""}${autoFilled.infants ? `, ${autoFilled.infants} infants` : ""}
Duration: ~${autoFilled.duration_nights} nights
Budget tier: ${budgetTier}${budgetConstraint}

IMPORTANT: ALL prices in your response MUST be in ${displayCurrency} using the "${userSymbol}" symbol. Do NOT use USD unless the user's currency IS USD.

Return ONLY a JSON code block:
\`\`\`json
{
  "archetype": "string",
  "ai_summary": "1-2 sentence exciting summary",
  "destination_summary": "short headline like 'Honeymoon in the Maldives'",
  "experience_clusters": [
    { "name": "string", "priority": "essential|recommended|optional", "typical_duration": "string" }
  ],
  "trip_frames": [
    { "label": "string", "duration": "string", "pacing": "relaxed|balanced|active", "ideal_for": "string", "rough_budget_range": "string in ${displayCurrency} per person", "sample_flow": ["Day 1: ...", "Day 2: ..."] }
  ],
  "preview_packages": [
    {
      "package_type": "budget|best_value|premium",
      "title": "string (e.g. 'Classic Water Villa Honeymoon')",
      "nights": ${autoFilled.duration_nights},
      "hotel_or_resort": "string (real resort/hotel name for this destination)",
      "room_type": "string or null",
      "meal_plan": "string or null (e.g. 'Half Board', 'All Inclusive')",
      "flight_summary": "string (e.g. 'Return flights from major hub, ~5h')",
      "transfer_summary": "string or null (e.g. 'Speedboat transfer 45min')",
      "experience_summary": "string (1-2 top experiences)",
      "estimated_total_price_range": "string in ${displayCurrency} (e.g. '${userSymbol}800 - ${userSymbol}1,200 per person')",
      "price_status": "estimated",
      "confidence_score": 0.0-1.0
    }
  ]
}
\`\`\`
Rules:
- ALL prices MUST be in ${displayCurrency} (${userSymbol}) — the user's selected currency
- 3-5 experience clusters
- 2-3 trip frames (short/medium/long)
- EXACTLY 3 preview_packages: budget, best_value, premium
- Use REAL hotel/resort names that exist in ${destName}
- Price ranges should be realistic per-person estimates in ${displayCurrency}${userBudgetMax ? `\n- ALL packages must be within the user's budget of ${userSymbol}${userBudgetMax.toLocaleString()} ${displayCurrency} total` : ""}
- confidence_score: 0.3-0.5 for estimated, higher if well-known destination`;

      let hybridResult: any = null;
      try {
        const contents = [{ role: "user", parts: [{ text: hybridPrompt }] }];
        const raw = await callGemini("gemini-2.5-flash", contents, 0.7, 3072, 1);
        if (raw) hybridResult = parseJsonBlock(raw);
      } catch (e: any) {
        console.warn(`[TripPlanner] Hybrid preview AI failed: ${e.message}`);
      }

      // ── SOFT SEARCH: Cache-first data enrichment ──
      const sb = getSupabaseAdmin();
      const softSearchData: any = {};
      
      if (hasDestination && destName !== "your destination") {
        const softPromises: Promise<void>[] = [];
        
        // Cached flight prices
        const resolvedDest = tripParams.destination_city || destName;
        const destCode = DESTINATION_AIRPORT_MAP[(resolvedDest).toLowerCase()];
        const originCode = tripParams.origin_airport || (tripParams.origin_city ? DESTINATION_AIRPORT_MAP[tripParams.origin_city.toLowerCase()] : null);
        
        if (destCode && originCode) {
          softPromises.push((async () => {
            try {
              const { data: cached } = await sb
                .from("flight_price_cache")
                .select("lowest_price, currency, source, travel_date, cabin_class")
                .eq("from_code", originCode)
                .eq("to_code", destCode)
                .order("cached_at", { ascending: false })
                .limit(3);
              if (cached?.length) softSearchData.cachedFlights = cached;
            } catch {}
          })());
        }

        // Popular routes
        softPromises.push((async () => {
          try {
            const { data: routes } = await sb
              .from("popular_routes")
              .select("from_city, from_code, to_city, to_code, lowest_price, currency, airline, duration, stops")
              .or(`to_city.ilike.%${resolvedDest}%`)
              .order("search_count", { ascending: false })
              .limit(5);
            if (routes?.length) softSearchData.popularRoutes = routes;
          } catch {}
        })());

        // Hotel estimates
        softPromises.push((async () => {
          try {
            const { data: estimates } = await sb
              .from("hotel_city_estimates")
              .select("city, avg_per_night_usd, min_per_night_usd, source")
              .ilike("city", `%${resolvedDest}%`)
              .limit(1);
            if (estimates?.length) softSearchData.hotelEstimates = estimates[0];
          } catch {}
        })());

        // Top hotels from catalogue
        softPromises.push((async () => {
          try {
            const { data: hotels } = await sb
              .from("tripjack_hotels")
              .select("name, city_name, rating, hero_image_url, property_type")
              .ilike("city_name", `%${resolvedDest}%`)
              .eq("is_deleted", false)
              .order("rating", { ascending: false })
              .limit(5);
            if (hotels?.length) softSearchData.topHotels = hotels;
          } catch {}
        })());

        await Promise.all(softPromises);
        console.log(`[TripPlanner] Soft search data: ${Object.keys(softSearchData).join(", ") || "none"}`);
      }

      // ── Enrich preview packages with soft search data ──
      if (hybridResult?.preview_packages && softSearchData.cachedFlights?.length) {
        const cheapestFlight = softSearchData.cachedFlights[0];
        for (const pkg of hybridResult.preview_packages) {
          if (cheapestFlight.lowest_price) {
            pkg.flight_summary = `${pkg.flight_summary} (from ${cheapestFlight.currency} ${cheapestFlight.lowest_price.toLocaleString()})`;
            pkg.price_status = "recent_cache";
            pkg.confidence_score = Math.min(1, (pkg.confidence_score || 0.4) + 0.15);
          }
        }
      }

      const detection = detectLanguageRich(lastUserMessage, tripParams?.user_language);
      const langSession = resolveSessionLanguage(lastUserMessage, detection, incomingLangSession || null);

      if (hybridResult && isHybridCandidate) {
        // ── Return HYBRID PREVIEW ──
        const hybridPreview = {
          mode: "hybrid_preview" as const,
          destination: destName,
          destination_summary: hybridResult.destination_summary || `Trip to ${destName}`,
          trip_type: travelType,
          traveler_type: tripParams.travel_type || "couple",
          trip_frames: hybridResult.trip_frames || [],
          preview_packages: hybridResult.preview_packages || [],
          assumptions,
          missing_for_exact_pricing: missingForExact,
          experience_clusters: hybridResult.experience_clusters || [],
          ai_summary: hybridResult.ai_summary || `Exploring ${destName} sounds amazing!`,
        };

        const pkgCount = hybridPreview.preview_packages.length;
        const replyText = `✨ ${hybridPreview.ai_summary}\n\nI've found ${pkgCount} estimated package options for you — from budget to premium! 👇\n\nThese are indicative prices. Share your dates and departure city for exact fares.`;

        console.log(`[TripPlanner] HYBRID PREVIEW: ${pkgCount} packages, ${assumptions.length} assumptions, ${missingForExact.length} missing for exact`);

        return new Response(
          JSON.stringify({
            hybrid_preview: hybridPreview,
            reply: replyText,
            extractedParams: tripParams,
            languageSession: langSession,
            previewData: Object.keys(softSearchData).length > 0 ? softSearchData : undefined,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ── Fallback: pure inspiration (destination too vague) ──
      if (hybridResult) {
        const inspiration = {
          mode: "inspiration" as const,
          destination: destName,
          trip_type: travelType,
          traveler_type: tripParams.travel_type || "couple",
          archetype: hybridResult.archetype || travelType,
          experience_clusters: hybridResult.experience_clusters || [],
          trip_frames: hybridResult.trip_frames || [],
          preview_itinerary: hybridResult.preview_itinerary || [],
          clarification_prompts: clarificationPrompts,
          ai_summary: hybridResult.ai_summary || `Exploring ${destName} sounds amazing!`,
        };

        const replyText = `✨ ${inspiration.ai_summary}\n\nI've prepared ${inspiration.trip_frames.length} trip options — check them out! 👇\n\nTell me your destination and I'll show estimated packages too.`;

        console.log(`[TripPlanner] INSPIRATION MODE: ${inspiration.experience_clusters.length} clusters, ${inspiration.trip_frames.length} frames`);

        return new Response(
          JSON.stringify({
            inspiration,
            reply: replyText,
            extractedParams: tripParams,
            languageSession: langSession,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.log("[TripPlanner] Hybrid/Inspiration generation failed, falling back to standard info-gathering");
    }

    // ── Trip request detected but missing critical info → ask for it ──
    if (!hasSufficientInfo(tripParams)) {
      console.log("[TripPlanner] Missing critical info, asking user:", tripParams.missing_critical);
      
      const { prompt: infoPrompt, missingFields } = generateInfoGatheringPrompt(tripParams);
      const basePrompt = CHAT_PROMPT_EN;
      
      // ── Fetch preview/cached data in parallel while gathering info ──
      const previewData: any = {};
      const dest = tripParams.destination_city || tripParams.destination_country;
      const origin = tripParams.origin_city;
      
      if (dest || origin) {
        const sb = getSupabaseAdmin();
        const previewPromises: Promise<void>[] = [];

        // Fetch popular routes for this destination
        if (dest) {
          previewPromises.push((async () => {
            try {
              const { data: routes } = await sb
                .from("popular_routes")
                .select("from_city, from_code, to_city, to_code, lowest_price, currency, airline, duration, stops")
                .or(`to_city.ilike.%${dest}%,from_city.ilike.%${dest}%`)
                .order("search_count", { ascending: false })
                .limit(5);
              if (routes?.length) previewData.popularRoutes = routes;
            } catch {}
          })());
        }

        // Fetch cached flight prices
        if (dest && origin) {
          previewPromises.push((async () => {
            try {
              const originCode = DESTINATION_AIRPORT_MAP[origin.toLowerCase()] || tripParams.origin_airport;
              const destCode = DESTINATION_AIRPORT_MAP[(tripParams.destination_city || "").toLowerCase()] || tripParams.destination_airport;
              if (originCode && destCode) {
                const { data: cached } = await sb
                  .from("flight_price_cache")
                  .select("lowest_price, currency, source, travel_date, cabin_class")
                  .eq("from_code", originCode)
                  .eq("to_code", destCode)
                  .order("cached_at", { ascending: false })
                  .limit(3);
                if (cached?.length) previewData.cachedFlightPrices = cached;
              }
            } catch {}
          })());
        }

        // Fetch hotel previews from DB
        if (tripParams.destination_city) {
          previewPromises.push((async () => {
            try {
              const { data: hotels } = await sb
                .from("hotels")
                .select("name, city, stars, rating, price, image")
                .ilike("city", `%${tripParams.destination_city}%`)
                .eq("is_active", true)
                .order("rating", { ascending: false })
                .limit(3);
              if (hotels?.length) previewData.hotelPreviews = hotels;
            } catch {}
          })());
          
          // Fetch from tripjack_hotels too for broader coverage
          previewPromises.push((async () => {
            try {
              const { data: tjHotels } = await sb
                .from("tripjack_hotels")
                .select("name, city_name, rating, hero_image_url, property_type")
                .ilike("city_name", `%${tripParams.destination_city}%`)
                .eq("is_deleted", false)
                .order("rating", { ascending: false })
                .limit(3);
              if (tjHotels?.length) previewData.tjHotelPreviews = tjHotels;
            } catch {}
          })());
        }

        // Fetch destination info
        if (tripParams.destination_city) {
          previewPromises.push((async () => {
            try {
              const { data: dests } = await sb
                .from("destinations")
                .select("name, country, image_url, rating, price")
                .ilike("name", `%${tripParams.destination_city}%`)
                .eq("is_active", true)
                .limit(1);
              if (dests?.length) previewData.destinationInfo = dests[0];
            } catch {}
          })());
        }

        await Promise.all(previewPromises);
        console.log(`[TripPlanner] Preview data: ${Object.keys(previewData).join(", ") || "none"}`);
      }
      
      const detection2 = detectLanguageRich(lastUserMessage, tripParams?.user_language);
      const langSession2 = resolveSessionLanguage(lastUserMessage, detection2, incomingLangSession || null);
      const langDirective2 = buildLanguageLock(langSession2);
      
      const sysPrompt = basePrompt + langDirective2 + "\n\n" + infoPrompt;
      const chatContents = messages.map((m: { role: string; content: string }) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));
      const deterministicReply = buildInfoGatheringFallbackReply(tripParams, missingFields, lastUserMessage);
      
      let chatReply: string | null = null;
      const t0Chat = Date.now();
      // 🟢 Info-gathering: 2.5 Lite → 2.5 Flash → 3.0 Flash (gateway→direct for each)
      const infoSysPrompt = basePrompt + langDirective2 + "\n\n" + infoPrompt;
      const infoContentsForGemini = messages.map((m: { role: string; content: string }) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));
      chatReply = await callAIWithFallback(
        ["gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-3-flash-preview"],
        infoContentsForGemini, 0.7, 1024, infoSysPrompt
      );
      console.log(`[TripPlanner] Info-gathering reply in ${Date.now() - t0Chat}ms, length=${chatReply?.length || 0}`);
      
      return new Response(
        JSON.stringify({ 
          reply: chatReply?.trim() || deterministicReply,
          needsMoreInfo: true,
          extractedParams: tripParams,
          missingFields,
          previewData: Object.keys(previewData).length > 0 ? previewData : undefined,
          languageSession: langSession2,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Apply smart defaults before searching ──
    tripParams = applySmartDefaults(tripParams);
    console.log("[TripPlanner] Params with defaults:", JSON.stringify(tripParams));

    // ── PROGRESSIVE MODE: Return resolved params to frontend for parallel search ──
    const requestType = tripParams.request_type || "full_trip";
    const needFlights = requestType !== "hotel_only";
    const needHotels = requestType !== "flight_only";
    const needActivities = requestType === "full_trip";

    const detection3 = detectLanguageRich(lastUserMessage, tripParams?.user_language);
    const langSession3 = resolveSessionLanguage(lastUserMessage, detection3, incomingLangSession || null);

    totalTimer.log("TOTAL extract + defaults time");
    return new Response(
      JSON.stringify({
        readyToSearch: true,
        languageSession: langSession3,
        searchParams: {
          origin_airport: tripParams.origin_airport,
          destination_airport: tripParams.destination_airport,
          origin_city: tripParams.origin_city,
          destination_city: tripParams.destination_city,
          destination_country: tripParams.destination_country,
          hotel_city_name: tripParams.hotel_city_name,
          cities: Array.isArray(tripParams.cities) && tripParams.cities.length > 1 ? tripParams.cities : null,
          depart_date: tripParams.depart_date,
          return_date: tripParams.return_date,
          duration_days: tripParams.duration_days,
          adults: tripParams.adults,
          children: tripParams.children,
          infants: tripParams.infants,
          cabin_class: tripParams.cabin_class,
          travel_type: tripParams.travel_type,
          travel_style: tripParams.travel_style,
          selection_priority: tripParams.selection_priority,
          prefer_direct: tripParams.prefer_direct,
          request_type: requestType,
          budget_usd: tripParams.budget_usd,
          budget_max: tripParams.budget_max ?? tripParams._budget_range?.[1] ?? null,
          budget_min: tripParams.budget_min ?? tripParams._budget_range?.[0] ?? null,
          budget_currency: tripParams.budget_currency || null,
          // Routing context for AI generation
          _needs_connecting_flight: tripParams._needs_connecting_flight,
          _domestic_origin_airport: tripParams._domestic_origin_airport,
          _domestic_origin_city: tripParams._domestic_origin_city,
          _hub_airport: tripParams._hub_airport,
          _hub_city: tripParams._hub_city,
          _needs_dest_connecting_flight: tripParams._needs_dest_connecting_flight,
          _domestic_dest_airport: tripParams._domestic_dest_airport,
          _dest_hub_airport: tripParams._dest_hub_airport,
          _dest_hub_city: tripParams._dest_hub_city,
          _dest_no_airport: tripParams._dest_no_airport,
          _dest_nearest_city: tripParams._dest_nearest_city,
          _dest_transport_note: tripParams._dest_transport_note,
          _dest_unknown_airport: tripParams._dest_unknown_airport,
          _origin_no_airport: tripParams._origin_no_airport,
          _origin_nearest_city: tripParams._origin_nearest_city,
          _origin_transport_note: tripParams._origin_transport_note,
          // User-specified must-visit activities and preferences
          user_must_visit: tripParams.user_must_visit || null,
          user_preferred_hotels: tripParams.user_preferred_hotels || null,
          user_special_notes: tripParams.user_special_notes || null,
        },
        needFlights,
        needHotels,
        needActivities,
        extractedParams: tripParams,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Trip planner error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});