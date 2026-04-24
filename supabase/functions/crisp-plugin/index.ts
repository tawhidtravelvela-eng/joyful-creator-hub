/**
 * Crisp Marketplace Plugin — AI Chatbot (Vela AI Agent) v3.0
 * 
 * Full-featured travel assistant with Gemini function-calling:
 * - Real-time flight search (unified-flight-search)
 * - Hotel search (unified-hotel-search)
 * - Activity/tour search (unified-tour-search)
 * - Trip planning (ai-trip-planner)
 * - Fare rules & baggage inquiry (travelport-fare-rules, airline_settings)
 * 
 * Required secrets:
 * - CRISP_PLUGIN_IDENTIFIER & CRISP_PLUGIN_KEY (Crisp REST API auth)
 * - GOOGLE_AI_API_KEY (Gemini)
 * - SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY (internal edge function calls)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CRISP_API = "https://api.crisp.chat/v1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-crisp-signature",
};

// ── Crisp REST API helper ──
function crispAuth(): string {
  const id = Deno.env.get("CRISP_PLUGIN_IDENTIFIER");
  const key = Deno.env.get("CRISP_PLUGIN_KEY");
  if (!id || !key) throw new Error("CRISP_PLUGIN_IDENTIFIER / CRISP_PLUGIN_KEY not set");
  return btoa(`${id}:${key}`);
}

function getPluginId(): string {
  const id = Deno.env.get("CRISP_PLUGIN_IDENTIFIER");
  if (!id) throw new Error("CRISP_PLUGIN_IDENTIFIER not set");
  return id;
}

async function crispApi(method: string, path: string, body?: any) {
  const res = await fetch(`${CRISP_API}${path}`, {
    method,
    headers: {
      Authorization: `Basic ${crispAuth()}`,
      "Content-Type": "application/json",
      "X-Crisp-Tier": "plugin",
    },
    ...(body && method !== "GET" ? { body: JSON.stringify(body) } : {}),
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

// ── Per-website plugin settings ──
interface PluginSettings {
  bot_name?: string;
  system_prompt?: string;
  language?: string;
  response_style?: string;
  max_tokens?: number;
  enabled?: boolean;
}

const settingsCache = new Map<string, { settings: PluginSettings; ts: number }>();
const CACHE_TTL_MS = 60_000;

async function getPluginSettings(websiteId: string): Promise<PluginSettings> {
  const cached = settingsCache.get(websiteId);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.settings;

  try {
    const pluginId = getPluginId();
    const { status, data } = await crispApi("GET", `/plugin/${pluginId}/subscription/${websiteId}/settings`);
    if (status >= 400 || !data?.data) return {};
    const settings: PluginSettings = data.data || {};
    settingsCache.set(websiteId, { settings, ts: Date.now() });
    return settings;
  } catch (err: any) {
    console.warn(`[crisp-plugin] Failed to fetch settings: ${err.message}`);
    return {};
  }
}

// ── Conversation history ──
async function getConversationMessages(websiteId: string, sessionId: string): Promise<Array<{ role: string; content: string }>> {
  const { status, data } = await crispApi("GET", `/website/${websiteId}/conversation/${sessionId}/messages`);
  if (status >= 400 || !data?.data) return [];
  const messages: Array<{ role: string; content: string }> = [];
  for (const msg of data.data) {
    if (msg.type !== "text" || !msg.content) continue;
    messages.push({ role: msg.from === "user" ? "user" : "assistant", content: msg.content });
  }
  return messages.slice(-20);
}

// ── Visitor meta ──
interface VisitorMeta {
  nickname?: string;
  email?: string;
  phone?: string;
  locale?: string;
  country?: string;
  device?: { geolocation?: { country?: string } };
  data?: Record<string, any>;
  segments?: string[];
}

async function getVisitorMeta(websiteId: string, sessionId: string): Promise<VisitorMeta> {
  const { data } = await crispApi("GET", `/website/${websiteId}/conversation/${sessionId}/meta`);
  return data?.data || {};
}

async function mergeConversationData(websiteId: string, sessionId: string, patch: Record<string, any>) {
  try {
    const meta = await getVisitorMeta(websiteId, sessionId);
    const merged = { ...(meta.data || {}), ...patch };
    await crispApi("PATCH", `/website/${websiteId}/conversation/${sessionId}/meta`, { data: merged });
    return merged;
  } catch (err: any) {
    console.warn(`[crisp-plugin] Failed to merge conversation data: ${err.message}`);
    return patch;
  }
}

function extractBookingReference(text: string): string {
  const trimmed = String(text || "").trim();
  if (!trimmed) return "";

  const words = trimmed.split(/\s+/);
  const candidates = (trimmed.match(/[A-Za-z0-9-]{4,20}/g) || []).filter((token) =>
    !/^(please|share|your|ticket|copy|booking|reference|refund|cancel|change|date|help|need|with|this|issue|other|screen|shot)$/i.test(token)
  );

  if (words.length > 6 && candidates.length <= 1) return "";

  const reversed = [...candidates].reverse();
  const picked = reversed.find((token) => /\d/.test(token)) || reversed[0] || "";
  return picked ? picked.toUpperCase() : "";
}

function getManageBookingIssueLabel(issue: string): string {
  switch (issue) {
    case "date_change":
      return "Date change";
    case "cancel_refund":
      return "Cancel / Refund";
    case "name_change":
      return "Name change";
    default:
      return "Other booking support";
  }
}

async function sendManageBookingIssuePicker(websiteId: string, sessionId: string, botName: string) {
  await sendReply(websiteId, sessionId, "How may we assist with this booking?", botName);
  await new Promise((resolve) => setTimeout(resolve, 250));
  await sendPicker(websiteId, sessionId, [
    { label: "📅 Date Change", value: "date_change" },
    { label: "❌ Cancel/Refund", value: "cancel_refund" },
    { label: "❓ Other", value: "other_issue" },
  ], botName);
}

async function beginManageBookingHandoff(
  websiteId: string,
  sessionId: string,
  botName: string,
  metaData: Record<string, any>,
) {
  const reference = String(metaData.manage_booking_reference || "").trim();
  const issue = String(metaData.manage_booking_issue || "other_issue").trim();
  const detail = String(metaData.manage_booking_issue_detail || "").trim();
  const ticketReceived = String(metaData.manage_booking_ticket_received || "") === "true";
  const issueLabel = getManageBookingIssueLabel(issue);

  const summaryLines = [
    "Thank you. I have noted your booking support request.",
    `Reference: ${reference || (ticketReceived ? "Ticket copy received" : "Not provided")}`,
    `Issue: ${issueLabel}${detail ? ` — ${detail}` : ""}`,
    "I am connecting you with our support team now.",
  ];
  const summary = summaryLines.join("\n");

  await mergeConversationData(websiteId, sessionId, {
    ...metaData,
    active_flow: "",
    manage_booking_stage: "",
    manage_booking_summary: summary,
    handoff_at: Date.now().toString(),
  });

  await sendReply(websiteId, sessionId, summary, botName);
  try {
    await crispApi("PATCH", `/website/${websiteId}/conversation/${sessionId}/routing`, { assign: { unassign: true } });
  } catch {}
  scheduleHandoffFollowup(websiteId, sessionId, botName);
  await setComposing(websiteId, sessionId, "stop");
}

// ══════════════════════════════════════════════
// ── Smart Multi-Signal Currency Detection ──
// ══════════════════════════════════════════════

type CurrencyCode = "BDT" | "USD" | "EUR" | "GBP" | "CNY" | "INR" | "SAR" | "AED" | "SGD" | "THB" | "MYR" | "JPY" | "KRW" | "AUD";

const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  BDT: "৳", USD: "$", EUR: "€", GBP: "£", CNY: "¥", INR: "₹",
  SAR: "﷼", AED: "د.إ", SGD: "S$", THB: "฿", MYR: "RM", JPY: "¥",
  KRW: "₩", AUD: "A$",
};

const COUNTRY_TO_CURRENCY: Record<string, CurrencyCode> = {
  BD: "BDT", US: "USD", GB: "GBP", CA: "USD",
  DE: "EUR", FR: "EUR", IT: "EUR", ES: "EUR", NL: "EUR", BE: "EUR",
  AT: "EUR", PT: "EUR", IE: "EUR", FI: "EUR", GR: "EUR",
  CN: "CNY", HK: "CNY", TW: "CNY",
  IN: "INR", PK: "INR",
  SA: "SAR", AE: "AED", QA: "SAR", KW: "SAR", BH: "SAR", OM: "SAR",
  SG: "SGD", TH: "THB", MY: "MYR", JP: "JPY", KR: "KRW",
  AU: "AUD", NZ: "AUD",
};

// Phone dial code → country code (longest prefix match)
const DIAL_CODE_TO_COUNTRY: Array<[string, string]> = ([
  ["+880", "BD"], ["+86", "CN"], ["+91", "IN"], ["+92", "PK"],
  ["+44", "GB"], ["+49", "DE"], ["+33", "FR"], ["+39", "IT"], ["+34", "ES"],
  ["+1", "US"], ["+61", "AU"], ["+64", "NZ"],
  ["+966", "SA"], ["+971", "AE"], ["+974", "QA"], ["+965", "KW"],
  ["+65", "SG"], ["+66", "TH"], ["+60", "MY"], ["+81", "JP"], ["+82", "KR"],
  ["+62", "ID"], ["+63", "PH"], ["+84", "VN"],
  ["+90", "TR"], ["+7", "RU"],
] as Array<[string, string]>).sort((a, b) => b[0].length - a[0].length); // longest prefix first

// Locale → country (e.g. "bn_BD" → "BD", "zh_CN" → "CN")
function countryFromLocale(locale: string): string | null {
  if (!locale) return null;
  const parts = locale.replace("-", "_").split("_");
  if (parts.length >= 2 && parts[1].length === 2) return parts[1].toUpperCase();
  return null;
}

// Language script detection
function detectLanguageScript(text: string): string | null {
  if (!text) return null;
  // Bengali / Bangla script: U+0980–U+09FF
  if (/[\u0980-\u09FF]{2,}/.test(text)) return "BD";
  // Chinese characters: CJK Unified Ideographs
  if (/[\u4E00-\u9FFF]{2,}/.test(text)) return "CN";
  // Devanagari (Hindi): U+0900–U+097F
  if (/[\u0900-\u097F]{2,}/.test(text)) return "IN";
  // Arabic script
  if (/[\u0600-\u06FF]{2,}/.test(text)) return "SA";
  // Thai script
  if (/[\u0E00-\u0E7F]{2,}/.test(text)) return "TH";
  // Japanese (Hiragana + Katakana)
  if (/[\u3040-\u309F\u30A0-\u30FF]{2,}/.test(text)) return "JP";
  // Korean (Hangul)
  if (/[\uAC00-\uD7AF]{2,}/.test(text)) return "KR";
  return null;
}

// Currency keyword detection in message text
function detectCurrencyKeyword(text: string): CurrencyCode | null {
  if (!text) return null;
  const lower = text.toLowerCase();
  if (/\b(taka|টাকা|bdt)\b/i.test(lower)) return "BDT";
  if (/\b(dollar|usd|\$\s?\d)/i.test(lower)) return "USD";
  if (/\b(euro|eur|€\s?\d)/i.test(lower)) return "EUR";
  if (/\b(pound|gbp|£\s?\d)/i.test(lower)) return "GBP";
  if (/\b(yuan|rmb|cny|¥\s?\d|人民币)/i.test(lower)) return "CNY";
  if (/\b(rupee|inr|₹\s?\d)/i.test(lower)) return "INR";
  if (/\b(riyal|sar|﷼)/i.test(lower)) return "SAR";
  if (/\b(dirham|aed)/i.test(lower)) return "AED";
  if (/\b(baht|thb|฿\s?\d)/i.test(lower)) return "THB";
  return null;
}

// Name pattern → country (boost only, never standalone)
const NAME_PATTERNS: Array<{ regex: RegExp; country: string }> = [
  { regex: /\b(md|mohammad|mohammed|habib|tanvir|rahim|karim|hasan|hussain|islam|mia|begum|akhtar|uddin|iqbal|noor|nur|banu|sultana|khatun|chowdhury|ahmed)\b/i, country: "BD" },
  { regex: /\b(wei|zhang|wang|li|liu|chen|yang|huang|zhao|zhou|wu|xu|sun|zhu)\b/i, country: "CN" },
  { regex: /\b(kumar|sharma|patel|gupta|singh|verma|joshi|reddy|nair|iyer|rao|das|chatterjee|mukherjee)\b/i, country: "IN" },
];

// Origin city → country mapping
const ORIGIN_CITY_TO_COUNTRY: Record<string, string> = {
  dhaka: "BD", chittagong: "BD", sylhet: "BD", "cox's bazar": "BD", barishal: "BD",
  dac: "BD", cgp: "BD", zyl: "BD", cxb: "BD", bzl: "BD",
  delhi: "IN", mumbai: "IN", kolkata: "IN", bangalore: "IN", chennai: "IN",
  del: "IN", bom: "IN", ccu: "IN", blr: "IN", maa: "IN",
  guangzhou: "CN", beijing: "CN", shanghai: "CN", chongqing: "CN", shenzhen: "CN",
  can: "CN", pek: "CN", pvg: "CN", ckg: "CN", szx: "CN",
  london: "GB", manchester: "GB", birmingham: "GB", lhr: "GB", lgw: "GB",
  dubai: "AE", "abu dhabi": "AE", dxb: "AE", auh: "AE",
  jeddah: "SA", riyadh: "SA", medina: "SA", jed: "SA", ruh: "SA", med: "SA",
  singapore: "SG", sin: "SG",
  bangkok: "TH", bkk: "TH",
  "kuala lumpur": "MY", kul: "MY",
  tokyo: "JP", nrt: "JP", hnd: "JP",
  seoul: "KR", icn: "KR",
  sydney: "AU", syd: "AU", mel: "AU",
  "new york": "US", jfk: "US", lax: "US", sfo: "US",
};

// Currency correction detection in user messages
function detectCurrencyCorrection(text: string): CurrencyCode | null {
  if (!text) return null;
  const lower = text.toLowerCase();
  // "show in taka", "use BDT", "prices in dollars", "switch to EUR"
  const correctionMatch = lower.match(/(?:show|use|prices?|switch|convert|display)\s+(?:in|to)\s+(\w+)/i);
  if (correctionMatch) {
    const target = correctionMatch[1].toLowerCase();
    const map: Record<string, CurrencyCode> = {
      taka: "BDT", bdt: "BDT", "টাকা": "BDT",
      dollar: "USD", dollars: "USD", usd: "USD",
      euro: "EUR", euros: "EUR", eur: "EUR",
      pound: "GBP", pounds: "GBP", gbp: "GBP",
      yuan: "CNY", rmb: "CNY", cny: "CNY",
      rupee: "INR", rupees: "INR", inr: "INR",
      riyal: "SAR", sar: "SAR",
      dirham: "AED", aed: "AED",
      baht: "THB", thb: "THB",
      ringgit: "MYR", myr: "MYR",
    };
    if (map[target]) return map[target];
  }
  return null;
}

interface CurrencyDetectionResult {
  currency: CurrencyCode;
  confidence: number;
  signals: string[];
  country: string | null;
}

/**
 * Smart multi-signal currency detection.
 * Priority-weighted scoring across all available signals.
 * Returns the detected currency with confidence score and signal breakdown.
 */
function detectCurrency(
  meta: VisitorMeta,
  conversationHistory: Array<{ role: string; content: string }>,
  currentMessage: string,
  channel?: string,
): CurrencyDetectionResult {
  let scores: Record<CurrencyCode, number> = {} as any;
  let signals: string[] = [];
  let detectedCountry: string | null = null;

  const addScore = (currency: CurrencyCode, points: number, signal: string) => {
    scores[currency] = (scores[currency] || 0) + points;
    signals.push(`${signal}→${currency}(+${points})`);
  };

  // 1. Cached currency in conversation data (highest priority — already resolved)
  const cachedCurrency = meta.data?.currency as CurrencyCode;
  if (cachedCurrency && CURRENCY_SYMBOLS[cachedCurrency]) {
    return { currency: cachedCurrency, confidence: 100, signals: ["cached"], country: meta.data?.detected_country || null };
  }

  // 2. Currency correction in current message (user override)
  const correction = detectCurrencyCorrection(currentMessage);
  if (correction) {
    return { currency: correction, confidence: 100, signals: ["user_correction"], country: null };
  }

  // 3. Origin city from conversation history (+50)
  const allText = [...conversationHistory.map(m => m.content), currentMessage].join(" ").toLowerCase();
  const originMatch = allText.match(/(?:from|flying from|departing from|origin)\s+([a-z'\s]+?)(?:\s+(?:to|on|for|,|\.|!|\?)|$)/i);
  if (originMatch) {
    const originCity = originMatch[1].trim().toLowerCase();
    const country = ORIGIN_CITY_TO_COUNTRY[originCity];
    if (country) {
      const curr = COUNTRY_TO_CURRENCY[country];
      if (curr) { addScore(curr, 50, `origin:${originCity}`); detectedCountry = country; }
    }
  }
  // Also check IATA codes directly in context
  for (const [city, country] of Object.entries(ORIGIN_CITY_TO_COUNTRY)) {
    if (city.length === 3 && allText.includes(city)) {
      const curr = COUNTRY_TO_CURRENCY[country];
      if (curr && !(scores[curr] && scores[curr] >= 50)) {
        addScore(curr, 30, `iata:${city}`);
        if (!detectedCountry) detectedCountry = country;
      }
    }
  }

  // 4. Phone prefix (+50)
  const phone = meta.phone || "";
  if (phone) {
    const cleanPhone = phone.replace(/[\s\-()]/g, "");
    for (const [prefix, country] of DIAL_CODE_TO_COUNTRY) {
      if (cleanPhone.startsWith(prefix)) {
        const curr = COUNTRY_TO_CURRENCY[country];
        if (curr) { addScore(curr, 50, `phone:${prefix}`); if (!detectedCountry) detectedCountry = country; }
        break;
      }
    }
  }

  // 5. Currency keyword in messages (+40)
  const keywordCurrency = detectCurrencyKeyword(currentMessage) || detectCurrencyKeyword(allText);
  if (keywordCurrency) addScore(keywordCurrency, 40, "keyword");

  // 6. Language script detection (+35)
  const scriptCountry = detectLanguageScript(currentMessage);
  if (scriptCountry) {
    const curr = COUNTRY_TO_CURRENCY[scriptCountry];
    if (curr) { addScore(curr, 35, `script:${scriptCountry}`); if (!detectedCountry) detectedCountry = scriptCountry; }
  }

  // 7. Geolocation — website channel only (+30)
  const geoCountry = meta.device?.geolocation?.country?.toUpperCase();
  if (geoCountry && (!channel || channel === "website" || channel === "chat")) {
    const curr = COUNTRY_TO_CURRENCY[geoCountry];
    if (curr) { addScore(curr, 30, `geo:${geoCountry}`); if (!detectedCountry) detectedCountry = geoCountry; }
  }

  // 8. Locale from Messenger/platform (+20)
  const localeCountry = countryFromLocale(meta.locale || "");
  if (localeCountry && localeCountry !== "US") {
    // Ignore US locale for non-website (Messenger routes through US)
    const curr = COUNTRY_TO_CURRENCY[localeCountry];
    if (curr) { addScore(curr, 20, `locale:${meta.locale}`); if (!detectedCountry) detectedCountry = localeCountry; }
  }

  // 9. Name pattern boost (+15, never standalone)
  const name = (meta.nickname || "").toLowerCase();
  if (name) {
    for (const { regex, country } of NAME_PATTERNS) {
      if (regex.test(name)) {
        const curr = COUNTRY_TO_CURRENCY[country];
        if (curr) { addScore(curr, 15, `name:${country}`); if (!detectedCountry) detectedCountry = country; }
        break;
      }
    }
  }

  // Find the top-scoring currency
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) {
    return { currency: "BDT", confidence: 0, signals: ["default"], country: null };
  }

  const [topCurrency, topScore] = sorted[0] as [CurrencyCode, number];
  // Normalize confidence: 50+ = high confidence
  const confidence = Math.min(topScore, 100);

  return { currency: topCurrency, confidence, signals, country: detectedCountry };
}

/**
 * Detect currency and cache it in Crisp conversation metadata.
 * Returns the detected currency code.
 */
async function detectAndCacheCurrency(
  websiteId: string,
  sessionId: string,
  meta: VisitorMeta,
  conversationHistory: Array<{ role: string; content: string }>,
  currentMessage: string,
): Promise<CurrencyCode> {
  // Determine channel from segments or meta
  const channel = meta.segments?.find(s => ["facebook", "messenger", "instagram", "telegram", "whatsapp", "email"].includes(s.toLowerCase()))?.toLowerCase() || "website";

  const result = detectCurrency(meta, conversationHistory, currentMessage, channel);
  console.log(`[crisp-plugin] Currency detection: ${result.currency} (confidence: ${result.confidence}, signals: ${result.signals.join(", ")})`);

  // Cache the result if confidence >= 30 and not already cached
  const alreadyCached = meta.data?.currency;
  if (!alreadyCached && result.confidence >= 30) {
    try {
      await crispApi("PATCH", `/website/${websiteId}/conversation/${sessionId}/meta`, {
        data: {
          ...(meta.data || {}),
          currency: result.currency,
          currency_confidence: result.confidence,
          detected_country: result.country,
        },
      });
    } catch (e: any) {
      console.warn(`[crisp-plugin] Failed to cache currency: ${e.message}`);
    }
  }

  // If user explicitly corrected currency, update cache
  if (result.signals.includes("user_correction")) {
    try {
      await crispApi("PATCH", `/website/${websiteId}/conversation/${sessionId}/meta`, {
        data: {
          ...(meta.data || {}),
          currency: result.currency,
          currency_confidence: 100,
          detected_country: result.country,
        },
      });
    } catch {}
  }

  return result.currency;
}

// ── Compact flight query parser ──
const MONTH_MAP: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

function parseDateFromParts(dayRaw: string, monthRaw: string): string | null {
  const month = MONTH_MAP[monthRaw.toLowerCase()];
  const day = Number(dayRaw);
  if (!month || !Number.isInteger(day) || day < 1 || day > 31) return null;

  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  let year = now.getUTCFullYear();
  let candidateUtc = Date.UTC(year, month - 1, day);
  if (candidateUtc < todayUtc) {
    year += 1;
    candidateUtc = Date.UTC(year, month - 1, day);
  }
  const candidate = new Date(candidateUtc);
  if (candidate.getUTCMonth() !== month - 1 || candidate.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseCompactFlightQuery(message: string): { from: string; to: string; departDate: string; returnDate?: string } | null {
  const compact = message.trim().replace(/\s+/g, " ");

  // Round-trip: "DAC CAN 28mar to 05apr" or "DAC CAN 28mar return 05apr" or "DAC CAN 28 mar - 05 apr"
  const rtMatch = compact.match(
    /^([a-zA-Z]{3})\s+([a-zA-Z]{3})\s+(\d{1,2})\s*([a-zA-Z]{3,9})\s+(?:to|return|ret|-|–|—)\s+(\d{1,2})\s*([a-zA-Z]{3,9})$/i
  );
  if (rtMatch) {
    const [, fromRaw, toRaw, d1, m1, d2, m2] = rtMatch;
    const departDate = parseDateFromParts(d1, m1);
    const returnDate = parseDateFromParts(d2, m2);
    if (departDate && returnDate) {
      return { from: fromRaw.toUpperCase(), to: toRaw.toUpperCase(), departDate, returnDate };
    }
  }

  // One-way: "DAC CAN 28mar"
  const owMatch = compact.match(/^([a-zA-Z]{3})\s+([a-zA-Z]{3})\s+(\d{1,2})\s*([a-zA-Z]{3,9})$/);
  if (!owMatch) return null;

  const [, fromRaw, toRaw, dayRaw, monthRaw] = owMatch;
  const departDate = parseDateFromParts(dayRaw, monthRaw);
  if (!departDate) return null;

  return { from: fromRaw.toUpperCase(), to: toRaw.toUpperCase(), departDate };
}

const FLIGHT_REPLY_COPY = {
  option: "Option",
  nonStop: "Non-stop",
  stop: "Stop",
  stops: "Stops",
  direct: "Direct flight",
  layover: "Layover",
  outbound: "OUTBOUND",
  returnLeg: "RETURN",
  baggageBothWays: "Baggage (Both Ways)",
  baggageOutbound: "Baggage (Outbound)",
  baggageReturn: "Baggage (Return)",
  baggage: "Baggage",
  carryOn: "Carry-on",
  checkIn: "Check-in",
  tap: "Tap a button below to book or explore more options! ✈️",
  noFlights: "Sorry, I couldn't find any flights for that route and date. Please try another date or nearby airport.",
  header: (route: string, date: string, total?: number) => `Great news! ✨ I found ${total ? total + ' flights' : 'flights'} for ${route} on ${date} and picked the best options for you:`,
  moreHeader: (route: string, date: string) => `Here are more flight options from ${route} on ${date}:`,
};


function formatReplyDate(date: string): string {
  if (!date) return "";
  try {
    return new Intl.DateTimeFormat("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${date}T00:00:00Z`));
  } catch {
    return date;
  }
}

function formatReplyCurrency(amount: number, currency = "BDT"): string {
  const rounded = Math.round(Number(amount) || 0);

  if (currency === "BDT") {
    return `৳${rounded.toLocaleString("en-US")}`;
  }

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(rounded);
  } catch {
    return `${currency} ${rounded.toLocaleString("en-US")}`;
  }
}

// IATA code → full airline name lookup
const AIRLINE_NAME_MAP: Record<string, string> = {
  EK: "Emirates", QR: "Qatar Airways", EY: "Etihad Airways", SV: "Saudia",
  GF: "Gulf Air", WY: "Oman Air", RJ: "Royal Jordanian", ME: "Middle East Airlines",
  AA: "American Airlines", DL: "Delta Air Lines", UA: "United Airlines",
  WN: "Southwest Airlines", B6: "JetBlue Airways", AS: "Alaska Airlines",
  NK: "Spirit Airlines", F9: "Frontier Airlines", HA: "Hawaiian Airlines",
  AC: "Air Canada", WS: "WestJet", AM: "Aeromexico",
  BA: "British Airways", LH: "Lufthansa", AF: "Air France", KL: "KLM",
  IB: "Iberia", AZ: "ITA Airways", SK: "SAS", AY: "Finnair",
  LX: "Swiss International Air Lines", OS: "Austrian Airlines", SN: "Brussels Airlines",
  LO: "LOT Polish Airlines", OK: "Czech Airlines", RO: "TAROM",
  TP: "TAP Air Portugal", EI: "Aer Lingus", FR: "Ryanair", U2: "easyJet",
  W6: "Wizz Air", VY: "Vueling", PC: "Pegasus Airlines", TK: "Turkish Airlines",
  SQ: "Singapore Airlines", CX: "Cathay Pacific", JL: "Japan Airlines",
  NH: "ANA", QF: "Qantas", MH: "Malaysia Airlines", TG: "Thai Airways",
  GA: "Garuda Indonesia", PR: "Philippine Airlines", VN: "Vietnam Airlines",
  KE: "Korean Air", OZ: "Asiana Airlines", BR: "EVA Air", CI: "China Airlines",
  CA: "Air China", MU: "China Eastern Airlines", CZ: "China Southern Airlines", HU: "Hainan Airlines",
  "3U": "Sichuan Airlines", FM: "Shanghai Airlines", ZH: "Shenzhen Airlines",
  AI: "Air India", "6E": "IndiGo", SG: "SpiceJet", UK: "Vistara",
  BG: "Biman Bangladesh Airlines", BS: "US-Bangla Airlines", VQ: "Novoair",
  UL: "SriLankan Airlines", BI: "Royal Brunei Airlines", PK: "PIA",
  FZ: "flydubai", G9: "Air Arabia", WF: "Widerøe",
  ET: "Ethiopian Airlines", SA: "South African Airways", KQ: "Kenya Airways",
  MS: "EgyptAir", AT: "Royal Air Maroc",
  LA: "LATAM Airlines", AV: "Avianca", G3: "Gol Linhas Aéreas",
  CM: "Copa Airlines", AR: "Aerolíneas Argentinas",
  QZ: "AirAsia Indonesia", AK: "AirAsia", FD: "Thai AirAsia",
  D7: "AirAsia X", TR: "Scoot", "3K": "Jetstar Asia", JQ: "Jetstar",
  TW: "T'way Air", LJ: "Jin Air", ZE: "Eastar Jet", "7C": "Jeju Air",
  MM: "Peach Aviation", BC: "Skymark Airlines",
};

function formatReplyAirline(name: string): string {
  const value = (name || "Unknown Airline").trim();
  // If it's a 2-3 char IATA code, look up the full name
  if (value.length <= 3 && AIRLINE_NAME_MAP[value.toUpperCase()]) {
    return AIRLINE_NAME_MAP[value.toUpperCase()];
  }
  // Already has "Airlines" suffix
  if (/airlines?$/i.test(value)) return value;
  // Check if the name itself is a known full name (no need to append)
  const upperVal = value.toUpperCase();
  for (const fullName of Object.values(AIRLINE_NAME_MAP)) {
    if (fullName.toUpperCase() === upperVal) return fullName;
  }
  return `${value} Airlines`;
}

function formatReplyStops(stops: any): string {
  const copy = FLIGHT_REPLY_COPY;
  const normalized = String(stops ?? "").trim().toLowerCase();
  const parsed = normalized === "non-stop" ? 0 : Number.parseInt(normalized, 10);

  if (Number.isFinite(parsed)) {
    if (parsed <= 0) return copy.nonStop;
    return `${parsed} ${parsed === 1 ? copy.stop : copy.stops}`;
  }

  return normalized.includes("non") ? copy.nonStop : (String(stops || copy.nonStop));
}

function formatReplyTag(tag: string | undefined): string | null {
  if (!tag) return null;
  const normalized = tag.toLowerCase();

  if (normalized.includes("preferred")) return "❤️ YOUR PICK";
  if (normalized.includes("cheap")) return "💰 CHEAPEST";
  if (normalized.includes("fast")) return "⚡ FASTEST";

  return "🏆 BEST VALUE";
}

function extractFlightTime(iso: string): string {
  if (!iso) return "N/A";
  try {
    return new Date(iso).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Dhaka",
    });
  } catch {
    return iso;
  }
}

function buildLayoverInfoFromSegments(segments: any[]): string | undefined {
  if (!segments || segments.length <= 1) return undefined;

  const layovers = segments.slice(0, -1).map((seg: any, idx: number) => {
    const nextSeg = segments[idx + 1];
    if (!nextSeg) return null;

    const arriveAt = seg.arrival ? new Date(seg.arrival).getTime() : NaN;
    const departNextAt = nextSeg.departure ? new Date(nextSeg.departure).getTime() : NaN;
    const diffMs = departNextAt - arriveAt;
    const hasDuration = Number.isFinite(diffMs) && diffMs > 0;
    const hours = hasDuration ? Math.floor(diffMs / (1000 * 60 * 60)) : 0;
    const minutes = hasDuration ? Math.round((diffMs % (1000 * 60 * 60)) / (1000 * 60)) : 0;
    const durationText = hasDuration ? `${hours}h ${minutes}m` : "";

    const city = seg.toCity || seg.destinationCity || nextSeg.fromCity || nextSeg.departureCity || "";
    const code = seg.destination || seg.to || nextSeg.origin || nextSeg.from || nextSeg.departureCode || "";
    const placeText = city ? (code && city !== code ? `${city} (${code})` : city) : code;
    if (!placeText) return null;

    return durationText ? `${durationText} in ${placeText}` : placeText;
  }).filter(Boolean);

  return layovers.length > 0 ? layovers.join(", ") : undefined;
}

// Legacy wrapper for backward compat
function buildLayoverInfo(flight: any): string | undefined {
  return buildLayoverInfoFromSegments(flight?.segments);
}

function formatLegDuration(segments: any[]): string {
  if (!segments || segments.length === 0) return "";
  const first = segments[0];
  const last = segments[segments.length - 1];
  const depMs = first.departure ? new Date(first.departure).getTime() : NaN;
  const arrMs = last.arrival ? new Date(last.arrival).getTime() : NaN;
  if (Number.isFinite(depMs) && Number.isFinite(arrMs) && arrMs > depMs) {
    const diffMs = arrMs - depMs;
    const hrs = Math.floor(diffMs / (1000 * 60 * 60));
    const mins = Math.round((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hrs}h ${mins}m`;
  }
  return "";
}

function buildFlightResultsReply(payload: any): string | null {
  if (!payload?.flights?.length) return null;

  const copy = FLIGHT_REPLY_COPY;
  const isRoundTrip = payload.returnDate || payload.flights.some((f: any) => f.returnLeg);

  // Header
  let headerDateText = formatReplyDate(payload.date || "");
  if (isRoundTrip && payload.returnDate) {
    headerDateText += ` — ${formatReplyDate(payload.returnDate)}`;
  }
  const routeArrow = isRoundTrip ? "↔" : "→";
  const headerRoute = payload.route?.replace("→", routeArrow) || "this route";
  const header = payload.mode === "show_more"
    ? copy.moreHeader(headerRoute, headerDateText)
    : copy.header(headerRoute, headerDateText, payload.totalResults);

    const NUM_BADGES = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];

    const cards = payload.flights.map((flight: any, index: number) => {
      const optionNumber = flight.optionNumber || index + 1;
      const badge = NUM_BADGES[optionNumber - 1] || `${optionNumber}.`;
      const tag = formatReplyTag(flight.tag);
      const priceText = formatReplyCurrency(flight.price, flight.currency || "BDT");

      // Enhanced title: badge + tag + price on a bold line
      const tagText = tag || "✈️ FLIGHT";
      const titleLine = `${badge}  ${tagText} • ${priceText}`;
      const lines: string[] = [titleLine, ""];

    const hasReturn = flight.returnLeg && (flight.returnLeg.departureTime || flight.returnLeg.airline);

    if (hasReturn) {
      // ── Round-trip card ──
      let routeDateLine = `${flight.from || ""} ↔ ${flight.to || ""}`;
      if (flight.outboundDate || flight.returnDate) {
         const outDate = flight.outboundDate ? formatReplyDate(flight.outboundDate) : "";
        const retDate = flight.returnDate ? formatReplyDate(flight.returnDate) : "";
        if (outDate && retDate) routeDateLine += ` | ${outDate} — ${retDate}`;
        else if (outDate) routeDateLine += ` | ${outDate}`;
      }
      lines.push(routeDateLine);
      lines.push("");

      // OUTBOUND section
      const ob = flight.outboundLeg || {};
      const obStops = formatReplyStops(ob.stops ?? flight.stops);
      const obDate = flight.outboundDate ? ` • ${formatReplyDate(flight.outboundDate)}` : "";
      lines.push(`✈️ ${copy.outbound}${obDate}`);
      lines.push(`  ${ob.departureTime || flight.departureTime || "N/A"} → ${ob.arrivalTime || flight.arrivalTime || "N/A"}`);
      lines.push(`  ${obStops} • ${ob.duration || flight.duration || "N/A"} • ${formatReplyAirline(ob.airline || flight.airline)}`);
      if (ob.layover) {
        lines.push(`  ⏳ ${copy.layover}: ${ob.layover}`);
      }
      lines.push("");

      // RETURN section
      const rt = flight.returnLeg;
      const rtStops = formatReplyStops(rt.stops);
      const rtDate = flight.returnDate ? ` • ${formatReplyDate(flight.returnDate)}` : "";
      lines.push(`🛬 ${copy.returnLeg}${rtDate}`);
      lines.push(`  ${rt.departureTime || "N/A"} → ${rt.arrivalTime || "N/A"}`);
      lines.push(`  ${rtStops} • ${rt.duration || "N/A"} • ${formatReplyAirline(rt.airline)}`);
      if (rt.layover) {
        lines.push(`  ⏳ ${copy.layover}: ${rt.layover}`);
      }

      // Baggage — smart display
      const obCabin = ob.cabinBaggage || flight.cabinBaggage || "";
      const obCheckin = ob.checkinBaggage || flight.checkinBaggage || "";
      const rtCabin = rt.cabinBaggage || obCabin;
      const rtCheckin = rt.checkinBaggage || obCheckin;
      const sameBaggage = obCabin === rtCabin && obCheckin === rtCheckin;

      if (obCabin || obCheckin || rtCabin || rtCheckin) {
        lines.push("");
        if (sameBaggage) {
          lines.push(`🧳 ${copy.baggageBothWays}:`);
          if (obCabin) lines.push(`   ${copy.carryOn}: ${obCabin}`);
          if (obCheckin) lines.push(`   ${copy.checkIn}: ${obCheckin}`);
        } else {
          if (obCabin || obCheckin) {
            lines.push(`🧳 ${copy.baggageOutbound}:`);
            if (obCabin) lines.push(`   ${copy.carryOn}: ${obCabin}`);
            if (obCheckin) lines.push(`   ${copy.checkIn}: ${obCheckin}`);
          }
          if (rtCabin || rtCheckin) {
            lines.push(`🧳 ${copy.baggageReturn}:`);
            if (rtCabin) lines.push(`   ${copy.carryOn}: ${rtCabin}`);
            if (rtCheckin) lines.push(`   ${copy.checkIn}: ${rtCheckin}`);
          }
        }
      }
    } else {
      // ── One-way card (original format) ──
      const stopsText = formatReplyStops(flight.stops);
      const hasStops = stopsText !== copy.nonStop && String(flight.stops ?? "").trim() !== "0";

      const routeLine = `${flight.from || ""} ✈ ${flight.to || ""} | ${flight.departureTime || "N/A"} — ${flight.arrivalTime || "N/A"}`;
      const detailLine = `${stopsText} • ${flight.duration || "N/A"} • ${formatReplyAirline(flight.airline)}`;

      lines.push(routeLine, detailLine);

      // Baggage
      const cabinBag = flight.cabinBaggage || flight.cabin_baggage || "";
      const checkinBag = flight.checkinBaggage || flight.checkin_baggage || "";
      if (cabinBag || checkinBag) {
        lines.push(`🧳 ${copy.baggage}:`);
        if (cabinBag) lines.push(`   ${copy.carryOn}: ${cabinBag}`);
        if (checkinBag) lines.push(`   ${copy.checkIn}: ${checkinBag}`);
      }

      // Layover
      if (hasStops && flight.layover) {
        lines.push(`⏳ ${copy.layover}: ${flight.layover}`);
      }
    }

    return lines.join("\n");
  }).join("\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n");

  return `${header}\n\n${cards}\n\n${copy.tap}`;
}

function extractDeterministicReply(toolResult: string): string | null {
  try {
    const parsed = JSON.parse(toolResult);
    return typeof parsed?._formattedReply === "string" ? parsed._formattedReply : null;
  } catch {
    return null;
  }
}

function cleanPassportString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const stringValue = typeof value === "string" ? value : String(value);
  const cleaned = stringValue
    .replace(/```json|```/gi, "")
    .replace(/\\n/g, " ")
    .replace(/^\s*["'`]+/, "")
    .replace(/["'`]+\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || null;
}

function extractPassportField(rawText: string, aliases: string[]): string | null {
  for (const alias of aliases) {
    const nullPattern = new RegExp(`["']?${alias}["']?\\s*:\\s*null`, "i");
    if (nullPattern.test(rawText)) return null;

    const quotedPattern = new RegExp(
      `["']?${alias}["']?\\s*:\\s*"([\\s\\S]*?)"(?=\\s*,\\s*["']?[A-Za-z_]|\\s*\\})`,
      "i",
    );
    const quotedMatch = rawText.match(quotedPattern);
    if (quotedMatch?.[1] !== undefined) {
      return cleanPassportString(quotedMatch[1]);
    }

    const barePattern = new RegExp(`["']?${alias}["']?\\s*:\\s*([^,\\n\\r}]+)`, "i");
    const bareMatch = rawText.match(barePattern);
    if (bareMatch?.[1]) {
      return cleanPassportString(bareMatch[1]);
    }
  }

  return null;
}

function parseMrzDate(value: string, preferFuture = false): string | null {
  const digits = value.replace(/[^0-9]/g, "");
  if (digits.length !== 6) return null;

  const yy = Number(digits.slice(0, 2));
  const mm = Number(digits.slice(2, 4));
  const dd = Number(digits.slice(4, 6));
  if (!mm || mm > 12 || !dd || dd > 31) return null;

  const currentYear = new Date().getUTCFullYear();
  const currentYY = currentYear % 100;
  let fullYear = 1900 + yy;

  if (preferFuture) {
    fullYear = yy <= currentYY + 20 ? 2000 + yy : 1900 + yy;
  } else if (yy <= currentYY) {
    fullYear = 2000 + yy;
  }

  return `${fullYear}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

function normalizeMrzLine(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9<]/g, "")
    .trim();
}

function extractMrzLines(source: unknown): { line1: string; line2: string } {
  const rawParts = typeof source === "string"
    ? [source]
    : source && typeof source === "object"
      ? [
          (source as Record<string, unknown>).mrzLine1,
          (source as Record<string, unknown>).mrzLine2,
          (source as Record<string, unknown>).mrz,
        ]
          .filter((value) => value !== null && value !== undefined)
          .map((value) => String(value))
      : source === null || source === undefined
        ? []
        : [String(source)];

  const rawText = rawParts
    .join("\n")
    .replace(/```json|```/gi, "")
    .replace(/\r/g, "\n");

  const explicitLines = rawText
    .split(/\n+/)
    .map(normalizeMrzLine)
    .filter(Boolean);

  let line1 = explicitLines.find((line) => line.startsWith("P<") && line.length >= 30) || "";
  let line2 = explicitLines.find((line) => !line.startsWith("P<") && /^[A-Z0-9<]+$/.test(line) && line.length >= 30) || "";

  const compact = normalizeMrzLine(rawText);

  if (!line1) {
    const line1Match = compact.match(/P<[A-Z<]{3}[A-Z<]{20,44}/);
    if (line1Match) {
      line1 = line1Match[0].slice(0, 44);
    }
  }

  if (!line2) {
    const afterLine1 = line1 && compact.includes(line1)
      ? compact.slice(compact.indexOf(line1) + line1.length)
      : compact;
    const line2Match = afterLine1.match(/[A-Z0-9<]{30,44}/);
    if (line2Match) {
      line2 = line2Match[0].slice(0, 44);
    }
  }

  return {
    line1: line1.slice(0, 44),
    line2: line2.slice(0, 44),
  };
}

function parsePassportMrz(mrz: unknown): Record<string, any> {
  const { line1, line2 } = extractMrzLines(mrz);
  if (!line1 && !line2) return {};

  const parsed: Record<string, any> = {};

  if (line1) {
    const issuingCountry = line1.slice(2, 5).replace(/</g, "").trim();
    if (issuingCountry) parsed.passportCountry = issuingCountry;

    const nameSection = line1.slice(5);
    const [surnameRaw = "", givenRaw = ""] = nameSection.split("<<");
    const surname = surnameRaw.replace(/</g, " ").trim();
    const givenName = givenRaw.replace(/</g, " ").trim();
    if (surname) parsed.lastName = surname;
    if (givenName) parsed.firstName = givenName;
  }

  if (line2) {
    const passportNumber = line2.slice(0, 9).replace(/</g, "").trim();
    const nationality = line2.slice(10, 13).replace(/</g, "").trim();
    const dob = parseMrzDate(line2.slice(13, 19), false);
    const gender = line2.slice(20, 21).replace(/</g, "").trim();
    const expiry = parseMrzDate(line2.slice(21, 27), true);

    if (passportNumber) parsed.passportNumber = passportNumber;
    if (nationality) parsed.nationality = nationality;
    if (dob) parsed.dob = dob;
    if (gender === "M") parsed.gender = "Male";
    if (gender === "F") parsed.gender = "Female";
    if (expiry) parsed.passportExpiry = expiry;
  }

  return parsed;
}

function parsePassportVisionOutput(rawText: string): Record<string, any> {
  const cleaned = rawText.replace(/```json|```/gi, "").trim();
  const wrappedJson = cleaned.match(/\{[\s\S]*\}/)?.[0] || "";
  const jsonCandidates = Array.from(new Set([
    cleaned,
    wrappedJson,
    cleaned.replace(/,\s*([}\]])/g, "$1"),
    wrappedJson.replace(/,\s*([}\]])/g, "$1"),
  ].filter(Boolean)));

  for (const candidate of jsonCandidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object") return parsed as Record<string, any>;
    } catch {
      // Fall through to tolerant field extraction below
    }
  }

  return {
    mrzLine1: extractPassportField(cleaned, ["mrzLine1"]),
    mrzLine2: extractPassportField(cleaned, ["mrzLine2"]),
    firstName: extractPassportField(cleaned, ["firstName", "givenName"]),
    lastName: extractPassportField(cleaned, ["lastName", "surname", "familyName"]),
    fullName: extractPassportField(cleaned, ["fullName", "name"]),
    gender: extractPassportField(cleaned, ["gender", "sex"]),
    dob: extractPassportField(cleaned, ["dob", "dateOfBirth", "birthDate"]),
    nationality: extractPassportField(cleaned, ["nationality"]),
    passportNumber: extractPassportField(cleaned, ["passportNumber", "documentNumber", "number"]),
    passportExpiry: extractPassportField(cleaned, ["passportExpiry", "expiryDate", "expirationDate"]),
    passportCountry: extractPassportField(cleaned, ["passportCountry", "issuingCountry", "countryOfIssue"]),
    mrz: extractPassportField(cleaned, ["mrz"]),
    confidence: extractPassportField(cleaned, ["confidence"]),
  };
}

function shouldRetryPassportExtraction(passportData: Record<string, any>, rawText: string, finishReason?: string | null): boolean {
  const firstName = cleanPassportString(passportData.firstName) || "";
  const lastName = cleanPassportString(passportData.lastName) || "";
  const passportNumber = cleanPassportString(passportData.passportNumber) || "";
  const mrzLine1 = normalizeMrzLine(passportData.mrzLine1 || "");
  const mrzLine2 = normalizeMrzLine(passportData.mrzLine2 || "");
  const rawLength = rawText.trim().length;

  return Boolean(
    !rawLength ||
    finishReason === "MAX_TOKENS" ||
    mrzLine1.length < 30 ||
    mrzLine2.length < 30 ||
    (firstName.length > 0 && firstName.length <= 3 && !lastName) ||
    (firstName && !lastName) ||
    (!passportNumber && !passportData.dob && !passportData.nationality)
  );
}

function mergePassportData(primary: Record<string, any>, fallback: Record<string, any>): Record<string, any> {
  const merged: Record<string, any> = { ...primary };
  for (const [key, fallbackValue] of Object.entries(fallback || {})) {
    const primaryValue = cleanPassportString(primary?.[key]);
    const cleanedFallbackValue = cleanPassportString(fallbackValue);
    const primaryMrzLength = (key === "mrzLine1" || key === "mrzLine2")
      ? normalizeMrzLine(primaryValue || "").length
      : 0;

    if (
      !primaryValue ||
      (key === "firstName" && primaryValue.length <= 3) ||
      ((key === "mrzLine1" || key === "mrzLine2") && primaryMrzLength < 30)
    ) {
      merged[key] = cleanedFallbackValue ?? primary?.[key] ?? null;
    }
  }

  return merged;
}

function normalizePassportData(rawPassportData: Record<string, any>): Record<string, any> {
  const passportData = Object.fromEntries(
    Object.entries(rawPassportData || {}).map(([key, value]) => [key, cleanPassportString(value)])
  ) as Record<string, any>;

  // Parse MRZ from the raw line fields first so we keep their original line breaks/structure.
  const mrzData = parsePassportMrz({
    mrzLine1: rawPassportData?.mrzLine1 ?? passportData.mrzLine1,
    mrzLine2: rawPassportData?.mrzLine2 ?? passportData.mrzLine2,
    mrz: rawPassportData?.mrz ?? passportData.mrz,
  });

  // MRZ-FIRST: MRZ data takes priority over printed/Vision-extracted fields
  const firstName = mrzData.firstName || passportData.firstName || "";
  const lastName = mrzData.lastName || passportData.lastName || "";
  const fullName = passportData.fullName || "";

  passportData.firstName = firstName || null;
  passportData.lastName = lastName || null;
  passportData.passportNumber = mrzData.passportNumber || passportData.passportNumber || null;
  passportData.dob = mrzData.dob || passportData.dob || null;
  passportData.gender = mrzData.gender || passportData.gender || null;
  passportData.passportExpiry = mrzData.passportExpiry || passportData.passportExpiry || null;
  // Convert alpha-3 MRZ codes to alpha-2 for booking API compatibility
  passportData.nationality = toAlpha2(mrzData.nationality || passportData.nationality) || null;
  passportData.passportCountry = toAlpha2(mrzData.passportCountry || passportData.passportCountry) || null;

  if (!passportData.firstName && fullName) {
    const parts = fullName.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
      passportData.firstName = parts[0];
    } else if (parts.length > 1) {
      passportData.firstName = parts.slice(0, -1).join(" ");
      passportData.lastName = passportData.lastName || parts[parts.length - 1];
    }
  }

  if (!passportData.lastName && fullName && passportData.firstName) {
    const remainder = fullName.slice(String(passportData.firstName).length).trim();
    if (remainder) passportData.lastName = remainder;
  }

  if (!passportData.fullName && (passportData.firstName || passportData.lastName)) {
    passportData.fullName = [passportData.firstName, passportData.lastName].filter(Boolean).join(" ").trim() || null;
  }

  return passportData;
}

async function runPassportVisionExtraction(
  geminiKey: string,
  base64Image: string,
  mimeType: string,
  prompt: string,
  maxOutputTokens = 1000,
): Promise<{ rawText: string; finishReason: string | null }> {
  const visionUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;
  const visionRes = await fetch(visionUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType,
              data: base64Image,
            },
          },
        ],
      }],
      generationConfig: {
        temperature: 0,
        maxOutputTokens,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!visionRes.ok) {
    const errText = await visionRes.text();
    throw new Error(`Gemini Vision error ${visionRes.status}: ${errText.slice(0, 200)}`);
  }

  const visionData = await visionRes.json();
  const rawText = (visionData?.candidates?.[0]?.content?.parts || [])
    .map((part: any) => typeof part?.text === "string" ? part.text : "")
    .filter(Boolean)
    .join("\n")
    .trim();

  return {
    rawText,
    finishReason: visionData?.candidates?.[0]?.finishReason || null,
  };
}

const COUNTRY_CODE_TO_NAME: Record<string, string> = {
  AF: "Afghanistan", AL: "Albania", DZ: "Algeria", AR: "Argentina", AU: "Australia",
  AT: "Austria", BH: "Bahrain", BD: "Bangladesh", BE: "Belgium", BT: "Bhutan",
  BR: "Brazil", BN: "Brunei", KH: "Cambodia", CA: "Canada", CN: "China",
  CO: "Colombia", DK: "Denmark", EG: "Egypt", ET: "Ethiopia", FI: "Finland",
  FR: "France", DE: "Germany", GR: "Greece", HK: "Hong Kong", IN: "India",
  ID: "Indonesia", IR: "Iran", IQ: "Iraq", IE: "Ireland", IL: "Israel",
  IT: "Italy", JP: "Japan", JO: "Jordan", KE: "Kenya", KW: "Kuwait",
  LA: "Laos", LB: "Lebanon", MY: "Malaysia", MV: "Maldives", MX: "Mexico",
  MN: "Mongolia", MA: "Morocco", MM: "Myanmar", NP: "Nepal", NL: "Netherlands",
  NZ: "New Zealand", NG: "Nigeria", NO: "Norway", OM: "Oman", PK: "Pakistan",
  PS: "Palestine", PH: "Philippines", PL: "Poland", PT: "Portugal", QA: "Qatar",
  RO: "Romania", RU: "Russia", SA: "Saudi Arabia", SG: "Singapore", ZA: "South Africa",
  KR: "South Korea", ES: "Spain", LK: "Sri Lanka", SD: "Sudan", SE: "Sweden",
  CH: "Switzerland", TW: "Taiwan", TH: "Thailand", TR: "Turkey", AE: "UAE",
  GB: "United Kingdom", US: "United States", UA: "Ukraine", UZ: "Uzbekistan",
  VN: "Vietnam", YE: "Yemen", GBR: "United Kingdom", USA: "United States",
  BGD: "Bangladesh", IND: "India", PAK: "Pakistan", SAU: "Saudi Arabia",
  ARE: "UAE", CAN: "Canada", AUS: "Australia", MYS: "Malaysia", SGP: "Singapore",
  THA: "Thailand", IDN: "Indonesia", CHN: "China", JPN: "Japan", KOR: "South Korea",
  DEU: "Germany", FRA: "France", ITA: "Italy", ESP: "Spain", NLD: "Netherlands",
  TUR: "Turkey", QAT: "Qatar", OMN: "Oman", BHR: "Bahrain", KWT: "Kuwait",
  NPL: "Nepal", LKA: "Sri Lanka", MDV: "Maldives", MMR: "Myanmar", VNM: "Vietnam",
  PHL: "Philippines", EGY: "Egypt", ZAF: "South Africa", BRA: "Brazil",
  MEX: "Mexico", RUS: "Russia", IRL: "Ireland", NZL: "New Zealand",
  HKG: "Hong Kong", TWN: "Taiwan", GBD: "Bangladesh",
};

// ISO 3166-1 alpha-3 → alpha-2 mapping (MRZ uses alpha-3, booking APIs use alpha-2)
const ALPHA3_TO_ALPHA2: Record<string, string> = {
  AFG: "AF", ALB: "AL", DZA: "DZ", ARG: "AR", AUS: "AU", AUT: "AT",
  BHR: "BH", BGD: "BD", BEL: "BE", BTN: "BT", BRA: "BR", BRN: "BN",
  KHM: "KH", CAN: "CA", CHN: "CN", COL: "CO", DNK: "DK", EGY: "EG",
  ETH: "ET", FIN: "FI", FRA: "FR", DEU: "DE", GRC: "GR", HKG: "HK",
  IND: "IN", IDN: "ID", IRN: "IR", IRQ: "IQ", IRL: "IE", ISR: "IL",
  ITA: "IT", JPN: "JP", JOR: "JO", KEN: "KE", KWT: "KW", LAO: "LA",
  LBN: "LB", MYS: "MY", MDV: "MV", MEX: "MX", MNG: "MN", MAR: "MA",
  MMR: "MM", NPL: "NP", NLD: "NL", NZL: "NZ", NGA: "NG", NOR: "NO",
  OMN: "OM", PAK: "PK", PSE: "PS", PHL: "PH", POL: "PL", PRT: "PT",
  QAT: "QA", ROU: "RO", RUS: "RU", SAU: "SA", SGP: "SG", ZAF: "ZA",
  KOR: "KR", ESP: "ES", LKA: "LK", SDN: "SD", SWE: "SE", CHE: "CH",
  TWN: "TW", THA: "TH", TUR: "TR", ARE: "AE", GBR: "GB", USA: "US",
  GBD: "BD", UKR: "UA", UZB: "UZ", VNM: "VN", YEM: "YE",
};

/** Convert any country code (alpha-2 or alpha-3) to alpha-2 for booking APIs */
function toAlpha2(code: string | null | undefined): string {
  if (!code) return "";
  const upper = code.toUpperCase().trim();
  if (upper.length === 2) return upper; // already alpha-2
  return ALPHA3_TO_ALPHA2[upper] || upper.substring(0, 2); // fallback: first 2 chars
}

function countryCodeToName(code: string | null | undefined): string {
  if (!code) return "";
  const upper = code.toUpperCase().trim();
  // Try direct lookup, then try alpha-2 version
  return COUNTRY_CODE_TO_NAME[upper] || COUNTRY_CODE_TO_NAME[toAlpha2(upper)] || upper;
}

function buildPassportOcrReply(passportData: Record<string, any>): string {
  const lines = [
    "🔒 Your passport image was processed securely and is NOT stored on our servers.",
    "",
    "Please confirm these extracted passport details:",
  ];

  if (passportData.firstName) lines.push(`• Given Name: ${passportData.firstName}`);
  if (passportData.lastName) lines.push(`• Surname: ${passportData.lastName}`);
  if (passportData.gender) lines.push(`• Gender: ${passportData.gender}`);
  if (passportData.dob) lines.push(`• Date of birth: ${passportData.dob}`);
  if (passportData.nationality) lines.push(`• Nationality: ${countryCodeToName(passportData.nationality) || passportData.nationality}`);
  if (passportData.passportNumber) lines.push(`• Passport number: ${passportData.passportNumber}`);
  if (passportData.passportExpiry) lines.push(`• Passport expiry: ${passportData.passportExpiry}`);
  if (passportData.passportCountry) lines.push(`• Issuing country: ${countryCodeToName(passportData.passportCountry) || passportData.passportCountry}`);

  const missingTicketingFields = [
    !passportData.firstName ? "given name" : null,
    !passportData.lastName ? "surname" : null,
    !passportData.gender ? "gender" : null,
    !passportData.dob ? "date of birth" : null,
    !passportData.nationality ? "nationality" : null,
    !passportData.passportNumber ? "passport number" : null,
    !passportData.passportExpiry ? "passport expiry" : null,
    !passportData.passportCountry ? "issuing country" : null,
  ].filter(Boolean);

  if (missingTicketingFields.length > 0) {
    lines.push(`• Still needed for ticketing: ${missingTicketingFields.join(", ")}`);
  }

  lines.push("", "Reply with any correction, or send a clearer passport photo if anything is missing.");
  return lines.join("\n");
}

const FLIGHT_ROUTE_MAP: Record<string, string> = {
  dhaka: "DAC",
  dac: "DAC",
  guangzhou: "CAN",
  canton: "CAN",
  can: "CAN",
  chongqing: "CKG",
  ckg: "CKG",
  dubai: "DXB",
  dxb: "DXB",
  delhi: "DEL",
  del: "DEL",
  kolkata: "CCU",
  ccu: "CCU",
  bangkok: "BKK",
  bkk: "BKK",
  singapore: "SIN",
  sin: "SIN",
  "kuala lumpur": "KUL",
  kul: "KUL",
  "cox's bazar": "CXB",
  "coxs bazar": "CXB",
  cxb: "CXB",
  chittagong: "CGP",
  cgp: "CGP",
  sylhet: "ZYL",
  zyl: "ZYL",
  barishal: "BZL",
  bzl: "BZL",
  jeddah: "JED",
  jed: "JED",
  medina: "MED",
  med: "MED",
  riyadh: "RUH",
  ruh: "RUH",
};

function parseNaturalLanguageFlightQuery(message: string): { from: string; to: string; departDate: string; returnDate?: string } | null {
  const normalized = message.trim().toLowerCase().replace(/[,]+/g, " ").replace(/\s+/g, " ");
  if (!normalized) return null;
  // Skip if message is about hotels/tours/activities/trip planning — not a direct flight search
  if (/\b(hotel|hotels|resort|resorts|room|rooms|accommodation|stay|tour|activity|activities|plan|trip|itinerary|package|design|honeymoon)\b/i.test(normalized)) {
    return null;
  }
  if (!/(flight|ticket|fare|price|from|to|\bdac\b|\bcan\b|\bckg\b|\bdxb\b|\bdel\b|\bccu\b|\bbkk\b|\bsin\b|\bkul\b)/i.test(normalized)) {
    return null;
  }

  const routeNames = Object.keys(FLIGHT_ROUTE_MAP).sort((a, b) => b.length - a.length);
  let from: string | null = null;
  let to: string | null = null;

  // Try explicit "from X to Y" pattern
  const explicitMatch = normalized.match(/from\s+([a-z'\s]+?)\s+to\s+([a-z'\s]+?)(?:\s+on\s+|\s+for\s+|\s+\d|$)/i);
  if (!explicitMatch) {
    // Also try "X to Y" without "from" keyword
    const simpleMatch = normalized.match(/^([a-z'\s]+?)\s+to\s+([a-z'\s]+?)(?:\s+on\s+|\s+for\s+|\s+\d|$)/i);
    if (simpleMatch) {
      const fromName = simpleMatch[1].trim();
      const toName = simpleMatch[2].trim();
      from = FLIGHT_ROUTE_MAP[fromName] || null;
      to = FLIGHT_ROUTE_MAP[toName] || null;
    }
  } else {
    const fromName = explicitMatch[1].trim();
    const toName = explicitMatch[2].trim();
    from = FLIGHT_ROUTE_MAP[fromName] || null;
    to = FLIGHT_ROUTE_MAP[toName] || null;
  }

  if (!from || !to) {
    // Fallback: find route names by their position in the input string (preserves order)
    const foundRoutes = routeNames
      .filter((name) => normalized.includes(name))
      .sort((a, b) => normalized.indexOf(a) - normalized.indexOf(b))
      .map((name) => FLIGHT_ROUTE_MAP[name]);
    const uniqueRoutes = [...new Set(foundRoutes)];
    if (uniqueRoutes.length >= 2) {
      from = from || uniqueRoutes[0];
      to = to || uniqueRoutes[1];
    }
  }

  if (!from || !to || from === to) return null;

  // Extract all dates from the message
  const dateRegex = /(\d{1,2})(?:st|nd|rd|th)?\s*([a-z]{3,9})/gi;
  const dates: string[] = [];
  let dm;
  while ((dm = dateRegex.exec(normalized)) !== null) {
    const parsed = parseDateFromParts(dm[1], dm[2]);
    if (parsed) dates.push(parsed);
  }

  if (dates.length === 0) return null;

  const departDate = dates[0];

  // Check for round-trip indicators when two dates found
  if (dates.length >= 2) {
    const hasRtKeyword = /\b(return|ret|round\s*trip|to|—|-|–)\b/i.test(normalized);
    if (hasRtKeyword) {
      return { from, to, departDate, returnDate: dates[1] };
    }
  }

  return { from, to, departDate };
}

async function sendReply(websiteId: string, sessionId: string, content: string, botName = "Vela AI Agent") {
  return crispApi("POST", `/website/${websiteId}/conversation/${sessionId}/message`, {
    type: "text", from: "operator", origin: "chat", content,
    user: { nickname: botName, avatar: "https://ignite-dream-craft.lovable.app/images/vela-ai-avatar.jpg" },
    automated: true,
  });
}

// ── Send picker (quick reply chips) ──
// Set to true to enable quick-action buttons (requires Crisp Marketplace approval)
const QUICK_ACTIONS_ENABLED = true;

async function sendPicker(websiteId: string, sessionId: string, choices: Array<{ label: string; value: string }>, botName = "Vela AI Agent") {
  if (!QUICK_ACTIONS_ENABLED) {
    console.log(`[crisp-plugin] Quick actions disabled — skipping picker with ${choices.length} buttons`);
    return { status: 200, data: {} };
  }
  const pickerContent = {
    id: `power-actions-${Date.now()}`,
    text: "Quick Actions:",
    choices: choices.map(c => ({
      value: c.value,
      icon: c.value.startsWith("book_option") ? "🎫" : c.value === "show_more" ? "✈️" : c.value === "change_dates" ? "📅" : "👤",
      label: c.label,
      selected: false,
    })),
  };
  return crispApi("POST", `/website/${websiteId}/conversation/${sessionId}/message`, {
    type: "picker", from: "operator", origin: "chat",
    content: pickerContent,
    user: { nickname: botName, avatar: "https://ignite-dream-craft.lovable.app/images/vela-ai-avatar.jpg" },
    automated: true,
  });
}

// ── Typing indicator ──
async function setComposing(websiteId: string, sessionId: string, type: "start" | "stop" = "start") {
  try { await crispApi("PATCH", `/website/${websiteId}/conversation/${sessionId}/compose`, { type, from: "operator" }); } catch {}
}

// ── Internal edge function caller ──
async function callEdgeFunction(functionName: string, body: any, timeoutMs = 18_000): Promise<any> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const url = `${supabaseUrl}/functions/v1/${functionName}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
        "apikey": anonKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      const text = await response.text();
      console.error(`[crisp-plugin] ${functionName} HTTP ${response.status}: ${text.slice(0, 200)}`);
      return null;
    }
    return await response.json();
  } catch (e: any) {
    console.error(`[crisp-plugin] ${functionName} error:`, e.message);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ── Supabase admin client ──
function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

// ══════════════════════════════════════════════
// ── Tool definitions for Gemini function-calling ──
// ══════════════════════════════════════════════

const TOOLS = [
  {
    function_declarations: [
      {
        name: "search_flights",
        description: "Search for available flights between two cities/airports. IMPORTANT: You MUST have BOTH an explicit travel date AND passenger count from the user before calling this tool — NEVER default to today's date and NEVER assume 1 passenger. If the user hasn't mentioned a date, ask them first. If the user hasn't mentioned how many passengers, ask them first. Use IATA airport codes (3 letters). Date must be YYYY-MM-DD. Common codes: Dhaka=DAC, Dubai=DXB, London=LHR, Bangkok=BKK, Kolkata=CCU, Delhi=DEL, Singapore=SIN, KL=KUL, NYC=JFK, Cox's Bazar=CXB, Chittagong=CGP, Sylhet=ZYL, Barishal=BZL, Jeddah=JED, Medina=MED, Riyadh=RUH.",
        parameters: {
          type: "object",
          properties: {
            from: { type: "string", description: "Origin IATA airport code (e.g. DAC)" },
            to: { type: "string", description: "Destination IATA airport code (e.g. DXB)" },
            departDate: { type: "string", description: "Departure date YYYY-MM-DD" },
            returnDate: { type: "string", description: "Return date YYYY-MM-DD (optional, for round-trip)" },
            adults: { type: "integer", description: "Number of adults (REQUIRED — must be explicitly provided by user, never default to 1)" },
            children: { type: "integer", description: "Number of children (default 0)" },
            infants: { type: "integer", description: "Number of infants (default 0)" },
            cabinClass: { type: "string", description: "Economy, PremiumEconomy, Business, First (default Economy)" },
            preferredTime: { type: "string", description: "User's preferred departure time if mentioned (e.g. '9:00 AM', '14:00', 'morning', 'evening'). Leave empty if not specified." },
            preferredAirline: { type: "string", description: "User's preferred airline code or name if mentioned (e.g. 'BG', 'Biman', 'Emirates', 'EK', 'US-Bangla', 'BS'). Leave empty if not specified." },
            showMore: { type: "boolean", description: "Set to true when user asks to see MORE flights beyond the initial Power of 3. Shows 5 additional options sorted by price." },
          },
          required: ["from", "to", "departDate", "adults"],
        },
      },
      {
        name: "search_hotels",
        description: "Search for hotels in a city. Before calling, AI MUST gather these 7 data points: (1) city/area, (2) check-in date, (3) check-out date, (4) number of guests, (5) number of rooms, (6) budget range, (7) preferred hotel type. If user provides all info upfront, call immediately. If info is missing, ask ALL missing questions in ONE message. Minimum required to call: city + check-in + check-out.",
        parameters: {
          type: "object",
          properties: {
            city: { type: "string", description: "City name (e.g. Dubai, Bangkok, Dhaka)" },
            checkIn: { type: "string", description: "Check-in date YYYY-MM-DD" },
            checkOut: { type: "string", description: "Check-out date YYYY-MM-DD" },
            rooms: { type: "integer", description: "Number of rooms (default 1)" },
            adults: { type: "integer", description: "Total number of adults (default 2)" },
            children: { type: "integer", description: "Number of children under 12 (default 0)" },
            childrenAges: { type: "array", items: { type: "integer" }, description: "Ages of each child (e.g. [5, 8]) — helps find kids-stay-free deals" },
            maxBudget: { type: "number", description: "User's maximum budget per night (optional, for filtering)" },
            preferredAmenity: { type: "string", description: "User's must-have amenity like WiFi, Pool, Breakfast (optional)" },
            neighborhoodPreference: { type: "string", description: "User's area preference like city center, quiet area, near landmark (optional)" },
            tripType: { type: "string", description: "Trip type: solo, couple, family, group, business (optional, for pro-tip personalization)" },
            hotelType: { type: "string", description: "Preferred hotel type: luxury, boutique, budget, resort, apartment, business, family-friendly (optional, for filtering and recommendations)" },
          },
          required: ["city", "checkIn", "checkOut"],
        },
      },
      {
        name: "search_activities",
        description: "Search for tours, activities, experiences, things to do, attractions, excursions, sightseeing, day trips, adventure, safari, food tours, tickets, museums, and any activity at a destination. Use whenever user asks 'what to do', 'things to see', 'tours in', 'activities in', or mentions a destination with an activity-type noun. Returns curated results with names, prices, duration, ratings, reviews, includes, and highlights.",
        parameters: {
          type: "object",
          properties: {
            searchText: { type: "string", description: "Search query combining destination + activity type (e.g. 'Bangkok canal tour', 'Dubai desert safari', 'Bali snorkeling', 'things to do in Phuket', 'food tour Bangkok')" },
            currency: { type: "string", description: "Currency code (default USD)" },
            limit: { type: "integer", description: "Number of results to return (default 5, max 10). Use 3 for specific queries, 5 for general 'things to do' queries" },
          },
          required: ["searchText"],
        },
      },
      {
        name: "get_activity_details",
        description: "Get full details of a specific activity/tour by product code. Returns inclusions, exclusions, itinerary, photos, pricing, product options, and age bands. Use AFTER user selects an activity from search results.",
        parameters: {
          type: "object",
          properties: {
            productCode: { type: "string", description: "Viator product code (e.g. '12345P1')" },
            currency: { type: "string", description: "Currency code (default USD)" },
          },
          required: ["productCode"],
        },
      },
      {
        name: "check_activity_availability",
        description: "Check real-time availability and exact pricing for an activity on a specific date with specific travelers. Use AFTER collecting travel date and pax count from user. Returns available time slots, exact prices, and booking options.",
        parameters: {
          type: "object",
          properties: {
            productCode: { type: "string", description: "Viator product code" },
            productOptionCode: { type: "string", description: "Specific product option code (from get_activity_details)" },
            travelDate: { type: "string", description: "Travel date in YYYY-MM-DD format" },
            adults: { type: "integer", description: "Number of adults (default 1)" },
            children: { type: "integer", description: "Number of children (default 0)" },
            childrenAges: { type: "array", items: { type: "integer" }, description: "Ages of each child" },
            currency: { type: "string", description: "Currency code (default USD)" },
          },
          required: ["productCode", "travelDate"],
        },
      },
      {
        name: "confirm_activity_booking",
        description: "Create an activity/tour booking record after user confirms. Use AFTER availability check and user confirmation. Collects lead traveler details and creates booking in the system.",
        parameters: {
          type: "object",
          properties: {
            productCode: { type: "string", description: "Viator product code (REQUIRED)" },
            activityName: { type: "string", description: "Name of the activity (REQUIRED)" },
            travelDate: { type: "string", description: "Travel date YYYY-MM-DD (REQUIRED)" },
            adults: { type: "integer", description: "Number of adults (REQUIRED)" },
            children: { type: "integer", description: "Number of children (optional, default 0)" },
            totalPrice: { type: "number", description: "Total price from availability check (REQUIRED)" },
            currency: { type: "string", description: "Currency code (REQUIRED)" },
             leadTravelerFirstName: { type: "string", description: "Lead traveler given name (REQUIRED)" },
             leadTravelerLastName: { type: "string", description: "Lead traveler surname (REQUIRED)" },
            leadTravelerEmail: { type: "string", description: "Lead traveler email (REQUIRED)" },
            leadTravelerPhone: { type: "string", description: "Lead traveler phone number (REQUIRED)" },
            specialRequests: { type: "string", description: "Dietary requirements, accessibility needs, hotel pickup address, etc. (optional)" },
            productOptionCode: { type: "string", description: "Selected product option code if multiple options available (optional)" },
            startTime: { type: "string", description: "Selected start time if applicable (optional)" },
          },
          required: ["productCode", "activityName", "travelDate", "adults", "totalPrice", "currency", "leadTravelerFirstName", "leadTravelerLastName", "leadTravelerEmail", "leadTravelerPhone"],
        },
      },
      {
        name: "plan_trip",
        description: "Generate a complete trip plan with day-by-day itinerary, budget breakdown, live flight, hotel & activity prices. IMPORTANT: You MUST have travel dates from the user before calling this tool. Never assume dates. If dates aren't provided, ask the user first. Use when the visitor wants a full tour designed for them.",
        parameters: {
          type: "object",
          properties: {
            tripDescription: { type: "string", description: "Natural language trip description (e.g. '5 day trip to Bali from Dhaka for 2 people, budget $2000')" },
            currency: { type: "string", description: "Preferred currency (default BDT)" },
          },
          required: ["tripDescription"],
        },
      },
      {
        name: "confirm_flight_booking",
        description: "Create a flight booking record after user confirms. Use AFTER user selects a flight, provides ALL passenger details, and confirms. Creates booking in the system with pending_payment status.",
        parameters: {
          type: "object",
          properties: {
            flightSummary: { type: "string", description: "Flight route summary (e.g. 'DAC → DXB, 25 Mar, Biman BG147')" },
            airline: { type: "string", description: "Airline name" },
            departDate: { type: "string", description: "Departure date YYYY-MM-DD" },
            returnDate: { type: "string", description: "Return date YYYY-MM-DD if round trip (optional)" },
            tripType: { type: "string", description: "oneway or roundtrip" },
            totalPrice: { type: "number", description: "Total price from search results" },
            currency: { type: "string", description: "Currency code" },
            passengers: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  gender: { type: "string", description: "Gender: Male or Female (REQUIRED — title will be auto-assigned by backend rules)" },
                   firstName: { type: "string", description: "Given name as on passport (REQUIRED)" },
                   lastName: { type: "string", description: "Surname as on passport (REQUIRED)" },
                  dob: { type: "string", description: "Date of birth YYYY-MM-DD (REQUIRED)" },
                  nationality: { type: "string", description: "Nationality (REQUIRED)" },
                  passportNumber: { type: "string", description: "Passport number (REQUIRED for international flights)" },
                  passportExpiry: { type: "string", description: "Passport expiry date YYYY-MM-DD (REQUIRED for international flights)" },
                  passportCountry: { type: "string", description: "Passport issuing country (optional, defaults to nationality)" },
                  frequentFlyer: { type: "string", description: "Frequent flyer number (optional)" },
                  type: { type: "string", description: "Passenger type: adult, child, or infant (REQUIRED)" },
                },
              },
              description: "Array of ALL passenger details — one entry per traveler",
            },
            contactEmail: { type: "string", description: "Contact email for booking confirmation (REQUIRED)" },
            contactPhone: { type: "string", description: "Contact phone number (REQUIRED)" },
            cabinClass: { type: "string", description: "Economy, Premium Economy, Business, or First (optional, defaults to Economy)" },
            specialRequests: { type: "string", description: "Any special requests — wheelchair, meal preference, etc. (optional)" },
          },
          required: ["flightSummary", "airline", "departDate", "totalPrice", "currency", "passengers", "contactEmail", "contactPhone"],
        },
      },
      {
        name: "confirm_hotel_booking",
        description: "Create a hotel booking record after user confirms. Use AFTER user selects a hotel, provides guest details, and confirms. Creates booking in the system with pending_payment status.",
        parameters: {
          type: "object",
          properties: {
            hotelName: { type: "string", description: "Hotel name (REQUIRED)" },
            city: { type: "string", description: "City name (REQUIRED)" },
            checkIn: { type: "string", description: "Check-in date YYYY-MM-DD (REQUIRED)" },
            checkOut: { type: "string", description: "Check-out date YYYY-MM-DD (REQUIRED)" },
            rooms: { type: "integer", description: "Number of rooms (optional, default 1)" },
            adults: { type: "integer", description: "Number of adults (optional, default 1)" },
            children: { type: "integer", description: "Number of children (optional, default 0)" },
            totalPrice: { type: "number", description: "Total price (REQUIRED)" },
            currency: { type: "string", description: "Currency code (REQUIRED)" },
             guestFirstName: { type: "string", description: "Lead guest given name (REQUIRED)" },
             guestLastName: { type: "string", description: "Lead guest surname (REQUIRED)" },
            guestEmail: { type: "string", description: "Guest email (REQUIRED)" },
            guestPhone: { type: "string", description: "Guest phone number (REQUIRED)" },
            specialRequests: { type: "string", description: "Special requests — late check-in, extra pillows, bed type, high floor, etc. (optional)" },
            mealPlan: { type: "string", description: "Meal plan if known — breakfast included, half board, etc. (optional)" },
            panNumber: { type: "string", description: "PAN number — only if booking an Indian hotel that requires it (optional)" },
            passportNumber: { type: "string", description: "Passport number — only for international hotel bookings that require it (optional)" },
            passportExpiry: { type: "string", description: "Passport expiry date YYYY-MM-DD — only if passport is required (optional)" },
            nationality: { type: "string", description: "Guest nationality (optional)" },
          },
          required: ["hotelName", "city", "checkIn", "checkOut", "totalPrice", "currency", "guestFirstName", "guestLastName", "guestEmail", "guestPhone"],
        },
      },
      {
        name: "get_baggage_info",
        description: "Get baggage allowance, cancellation policy, date change policy, and name change policy for a specific airline. Use when visitor asks about baggage, luggage, cancellation, refund, or policy for an airline.",
        parameters: {
          type: "object",
          properties: {
            airlineCode: { type: "string", description: "2-letter IATA airline code (e.g. BG=Biman, EK=Emirates, QR=Qatar, SQ=Singapore, 6E=IndiGo, BS=US-Bangla, VQ=Novoair, SV=Saudia, TK=Turkish)" },
            airlineName: { type: "string", description: "Airline name if code not known (e.g. 'Biman Bangladesh', 'Emirates')" },
          },
          required: [],
        },
      },
      {
        name: "read_passport",
        description: "Extract passenger details from a passport photo/image sent by the user. Uses AI vision to read: given name, surname, date of birth, nationality, passport number, expiry date, gender, and issuing country. Call this when the user sends a passport image during the booking flow. Returns structured passenger data that can be used directly for flight/hotel booking. IMPORTANT: Tell the user their passport image is processed securely and NOT stored.",
        parameters: {
          type: "object",
          properties: {
            imageUrl: { type: "string", description: "URL of the passport image sent by the user in Crisp chat" },
          },
          required: ["imageUrl"],
        },
      },
    ],
  },
];

// ── Neighborhood Guide: Area Vibes & Pro-Tips ──

const AREA_VIBES: Record<string, string> = {
  paris: "The City of Light — romantic, historic, and endlessly charming.",
  london: "Iconic mix of heritage and modern culture.",
  dubai: "Ultra-modern skyline, luxury shopping, and desert adventures.",
  "new york": "The city that never sleeps — fast-paced and electrifying.",
  nyc: "The city that never sleeps — fast-paced and electrifying.",
  bangkok: "Vibrant street food scene, temples, and buzzing nightlife.",
  tokyo: "A perfect blend of ancient tradition and cutting-edge tech.",
  singapore: "Clean, green, and packed with world-class dining.",
  bali: "Tropical paradise with temples, rice terraces, and surf.",
  kolkata: "Cultural capital — art, literature, colonial architecture, and street food.",
  calcutta: "Cultural capital — art, literature, colonial architecture, and street food.",
  dhaka: "Energetic, bustling megacity with rich history.",
  mumbai: "Bollywood glam meets coastal charm and street food.",
  delhi: "Grand Mughal heritage meets modern Indian capital.",
  istanbul: "Where East meets West — bazaars, mosques, and Bosphorus views.",
  rome: "Eternal city of ancient ruins, gelato, and la dolce vita.",
  barcelona: "Gaudí architecture, Mediterranean beaches, and tapas.",
  amsterdam: "Canals, bikes, museums, and laid-back Dutch culture.",
  berlin: "Edgy, creative, and steeped in history.",
  "kuala lumpur": "Twin Towers, hawker food, and multicultural energy.",
  phuket: "Island vibes, turquoise waters, and Thai hospitality.",
  seoul: "K-culture, palaces, street food, and neon-lit nightlife.",
  sydney: "Harbour Bridge, Opera House, and beach lifestyle.",
  "cox's bazar": "World's longest natural sea beach — peaceful and scenic.",
  chittagong: "Port city with hill tracts and natural beauty.",
  maldives: "Overwater villas, crystal-clear lagoons, and pure bliss.",
  jeddah: "Gateway to Makkah — historic Al-Balad and Red Sea coast.",
  medina: "Sacred city of peace — Prophet's Mosque and spiritual serenity.",
  riyadh: "Saudi capital — modern skyline and desert heritage.",
};

const NEIGHBORHOOD_VIBES: Record<string, Record<string, string>> = {
  paris: {
    "le marais": "Historic, artsy, and great for boutiques.",
    "champs-élysées": "Iconic boulevard, luxury shopping, and café culture.",
    montmartre: "Bohemian charm, Sacré-Cœur, and artist vibes.",
    "saint-germain": "Literary cafés, galleries, and Left Bank elegance.",
  },
  "new york": {
    "times square": "High energy, neon lights, and tourist-central.",
    soho: "Trendy, artsy, and boutique shopping paradise.",
    midtown: "Skyscraper central — close to everything.",
    brooklyn: "Hip, diverse, and packed with local flavor.",
  },
  dubai: {
    marina: "Modern, upscale, and great for evening walks.",
    downtown: "Home to Burj Khalifa and Dubai Mall — the heart of the action.",
    "palm jumeirah": "Luxury island living with private beaches.",
    "deira": "Old Dubai charm — souks, spices, and creek views.",
  },
  london: {
    westminster: "Historic, close to Big Ben and Parliament.",
    kensington: "Elegant, quiet, and museum-rich.",
    "covent garden": "Theatreland, street performers, and bustling markets.",
    shoreditch: "Trendy, artsy, and great nightlife.",
  },
  bangkok: {
    sukhumvit: "Vibrant nightlife, street food, and BTS accessible.",
    riverside: "Serene, temple views, and luxury retreats.",
    silom: "Business hub by day, night market by evening.",
    "khao san": "Backpacker hub — lively, cheap, and fun.",
  },
  tokyo: {
    shinjuku: "Bustling, neon-lit, and great transport hub.",
    shibuya: "Youth culture, fashion, and the famous crossing.",
    asakusa: "Traditional Tokyo — Senso-ji temple and old-town charm.",
    ginza: "Upscale shopping and fine dining.",
  },
  bali: {
    seminyak: "Beach clubs, sunset bars, and trendy vibes.",
    ubud: "Spiritual heart — rice terraces, yoga, and art.",
    kuta: "Budget-friendly, surf beaches, and nightlife.",
    nusa_dua: "Luxury resort enclave with calm beaches.",
  },
  kolkata: {
    "park street": "Cultural hub, colonial charm, and great restaurants.",
    "new town": "Modern IT hub, clean, and spacious.",
    "salt lake": "Planned township, parks, and tech offices.",
    howrah: "Across the river — historic and budget-friendly.",
  },
  singapore: {
    "marina bay": "Iconic skyline, luxury, and waterfront dining.",
    orchard: "Shopping paradise — malls and designer boutiques.",
    sentosa: "Beach resort island — fun and family-friendly.",
    chinatown: "Heritage, hawker food, and temple charm.",
  },
};

function getAreaVibe(city: string, neighborhoodPref: string): string {
  // Try specific neighborhood first
  const cityNeighborhoods = NEIGHBORHOOD_VIBES[city];
  if (cityNeighborhoods && neighborhoodPref) {
    for (const [area, vibe] of Object.entries(cityNeighborhoods)) {
      if (neighborhoodPref.includes(area) || area.includes(neighborhoodPref)) {
        return vibe;
      }
    }
  }
  // Fall back to city-level vibe
  return AREA_VIBES[city] || "";
}

function getProTip(bucket: string, city: string, tripType?: string): string {
  // Trip-type specific tips
  const tripTips: Record<string, Record<string, string>> = {
    family: {
      "Best Value": "Family-friendly — great for kids with space to spread out.",
      "Cheapest": "Budget-smart for families — save for fun activities with the kids!",
      "Premium": "The ultimate family treat — kids' clubs, pools, and room to relax.",
    },
    couple: {
      "Best Value": "Romantic and well-priced — perfect for a cozy getaway.",
      "Cheapest": "More budget for romantic dinners and experiences together!",
      "Premium": "Couples' paradise — spa, views, and that special touch.",
    },
    business: {
      "Best Value": "Business-ready — reliable WiFi, quiet rooms, and easy access.",
      "Cheapest": "Clean and efficient — everything you need for a work trip.",
      "Premium": "Executive-level comfort — lounge access and prime location.",
    },
    solo: {
      "Best Value": "Solo traveler's dream — safe, central, and social-friendly.",
      "Cheapest": "Perfect for backpackers and solo explorers on a budget.",
      "Premium": "Treat yourself — you deserve it after the adventure!",
    },
  };

  const tt = (tripType || "").toLowerCase();
  if (tt && tripTips[tt] && tripTips[tt][bucket]) {
    return tripTips[tt][bucket];
  }

  const tips: Record<string, string[]> = {
    "Best Value": [
      "Great balance of comfort and price — you won't regret this one.",
      "Highly rated by guests at a price that won't break the bank.",
      "Smart pick — excellent reviews without the premium price tag.",
    ],
    "Cheapest": [
      "Best for budget travelers who want clean, safe, and central.",
      "Saves you money for experiences and dining out!",
      "No-frills but well-rated — perfect for short stays.",
    ],
    "Premium": [
      "The luxury pick — treat yourself to top-tier service.",
      "Perfect for a special occasion or when only the best will do.",
      "Full resort experience with premium amenities.",
    ],
    "Recommended": [
      "A solid all-rounder with great guest feedback.",
      "Popular with travelers — reliable quality.",
    ],
  };
  const pool = tips[bucket] || tips["Recommended"]!;
  const idx = (city.length + bucket.length) % pool.length;
  return pool[idx];
}

// ── Execute tool calls ──
async function executeToolCall(name: string, args: any, crispCtx?: { websiteId: string; sessionId: string; botName: string; currency?: CurrencyCode }): Promise<string> {
  console.log(`[crisp-plugin] Executing tool: ${name}`, JSON.stringify(args));
  // Use detected currency from crispCtx, fallback to BDT
  const detectedCurrency = crispCtx?.currency || "BDT";

  if (name === "search_flights") {
    // ── Date guard: reject searches where AI defaulted to today's date ──
    const today = new Date().toISOString().split("T")[0];
    if (!args.departDate || args.departDate === today) {
      console.warn(`[crisp-plugin] Flight search blocked — no explicit date provided (got: ${args.departDate})`);
      return JSON.stringify({
        found: false,
        needDate: true,
        message: "I need to know your travel date before searching. Please ask the user: 'When would you like to travel?'",
      });
    }

    // ── Passenger count guard: reject searches where AI assumed default passengers ──
    if (!args.adults || args.adults < 1) {
      console.warn(`[crisp-plugin] Flight search blocked — no explicit passenger count (got adults: ${args.adults})`);
      return JSON.stringify({
        found: false,
        needPassengers: true,
        message: "I need to know how many passengers are travelling before searching. Please ask the user: 'How many passengers will be travelling? (adults, children, infants)'",
      });
    }

    const searchBody = {
      from: args.from?.toUpperCase(),
      to: args.to?.toUpperCase(),
      departDate: args.departDate,
      returnDate: args.returnDate || null,
      adults: args.adults,
      children: args.children || 0,
      infants: args.infants || 0,
      cabinClass: args.cabinClass || "Economy",
      currency: args.currency || detectedCurrency,
    };

    const result = await callEdgeFunction("unified-flight-search", searchBody);

    if (!result || !result.flights || result.flights.length === 0) {
      return JSON.stringify({
        found: false,
        message: "No flights found for this route and date. The route may not be available or all flights are sold out.",
      });
    }

    // ── Show More mode: return 5 flights sorted by price, numbered as Option 1-5 ──
    // For round-trip searches, filter to only flights that have return segments
    let allFlights = result.flights;
    if (args.returnDate) {
      const rtFlights = allFlights.filter((f: any) => {
        const segs = f.segments || [];
        return segs.some((s: any) => s.group === 1);
      });
      if (rtFlights.length > 0) allFlights = rtFlights;
    }
    const isShowMore = args.showMore === true;

    if (isShowMore) {
      const extractTime = (iso: string) => {
        if (!iso) return "N/A";
        try {
          const d = new Date(iso);
          return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Dhaka" });
        } catch { return iso; }
      };

      const moreFlights = [...allFlights]
        .sort((a: any, b: any) => (a.price || 999999) - (b.price || 999999))
        .slice(0, 5)
        .map((f: any, i: number) => {
          const apiBag = f.baggageAllowance || {};
          const cabinBag = f.cabinBaggage || apiBag.cabin || "7 Kg";
          const checkinBag = f.checkinBaggage || apiBag.checkin || "20 Kg";

          // Separate outbound/return segments
          const allSegs = f.segments || [];
          const outboundSegs = allSegs.filter((s: any) => s.group === 0 || s.group === undefined);
          const returnSegs = allSegs.filter((s: any) => s.group === 1);
          const isRT = returnSegs.length > 0 && args.returnDate;

          const outFirst = outboundSegs[0];
          const outLast = outboundSegs[outboundSegs.length - 1];
          const retFirst = returnSegs[0];
          const retLast = returnSegs[returnSegs.length - 1];

          const flightData: any = {
            optionNumber: i + 1,
            airline: f.airlineName || f.airline,
            airlineCode: f.airline,
            price: Math.round(f.price),
            currency: f.currency || "BDT",
            departureTime: extractTime(outFirst?.departure || f.departure),
            arrivalTime: extractTime(outLast?.arrival || f.arrival),
            duration: f.duration,
            stops: f.stops,
            layover: buildLayoverInfoFromSegments(outboundSegs.length > 0 ? outboundSegs : allSegs),
            from: f.from || args.from,
            to: f.to || args.to,
            cabinBaggage: cabinBag,
            checkinBaggage: checkinBag,
            flightNumber: f.flightNumber,
          };

          if (isRT && retFirst && retLast) {
            flightData.outboundDate = args.departDate;
            flightData.returnDate = args.returnDate;
            flightData.outboundLeg = {
              departureTime: extractTime(outFirst?.departure || f.departure),
              arrivalTime: extractTime(outLast?.arrival || f.arrival),
              duration: formatLegDuration(outboundSegs) || f.duration,
              stops: Math.max(0, outboundSegs.length - 1),
              airline: outFirst?.airlineName || outFirst?.carrier || f.airlineName || f.airline,
              layover: buildLayoverInfoFromSegments(outboundSegs),
              cabinBaggage: cabinBag,
              checkinBaggage: checkinBag,
            };
            flightData.returnLeg = {
              departureTime: extractTime(retFirst.departure),
              arrivalTime: extractTime(retLast.arrival),
              duration: formatLegDuration(returnSegs),
              stops: Math.max(0, returnSegs.length - 1),
              airline: retFirst.airlineName || retFirst.carrier || f.airlineName || f.airline,
              layover: buildLayoverInfoFromSegments(returnSegs),
              cabinBaggage: cabinBag,
              checkinBaggage: checkinBag,
            };
          }

          return flightData;
        });

      return JSON.stringify({
        found: true,
        _hasFlightResults: true,
        totalResults: allFlights.length,
        showing: moreFlights.length,
        route: `${args.from} → ${args.to}`,
        date: args.departDate,
        returnDate: args.returnDate || null,
        mode: "show_more",
        flights: moreFlights,
        _formattedReply: buildFlightResultsReply({
          route: `${args.from} → ${args.to}`,
          date: args.departDate,
          returnDate: args.returnDate || null,
          mode: "show_more",
          flights: moreFlights,
        }),
      });
    }

    // ── Power of 3 Flight Selection ──
    // Option 1: "Best" (Balanced) – good price, good timing, direct preferred
    // Option 2: "Cheapest" – lowest price (may have stops or bad times)
    // Option 3: "Fastest" – shortest duration / direct, not already shown above
    const getDuration = (f: any) => {
      const raw = String(f.duration || "");
      const hm = raw.match(/(\d+)\s*h\s*(\d+)?/i);
      if (hm) return parseInt(hm[1]) * 60 + parseInt(hm[2] || "0");
      const mins = parseInt(raw.replace(/\D/g, ""));
      return isNaN(mins) ? 9999 : mins;
    };
    const getPrice = (f: any) => f.price || 999999;
    const getStops = (f: any) => {
      if (f.stops === 0 || f.stops === "0" || f.stops === "Non-stop") return 0;
      return parseInt(String(f.stops)) || 1;
    };
    const flightKey = (f: any) => {
      if (f?.id) return `id:${f.id}`;
      if (Array.isArray(f?.segments) && f.segments.length > 0) {
        return f.segments
          .map((s: any) => `${s.carrier || s.airline || ""}-${s.flightNumber || ""}-${s.departure || ""}-${s.arrival || ""}-${s.group ?? 0}`)
          .join("|");
      }
      return `${f.airline || ""}:${f.flightNumber || ""}:${f.departure || ""}:${f.arrival || ""}`;
    };

    // Score for "Best": balance of price (40%), duration (30%), fewer stops (30%)
    const priceMin = Math.min(...allFlights.map(getPrice));
    const priceMax = Math.max(...allFlights.map(getPrice)) || priceMin + 1;
    const durMin = Math.min(...allFlights.map(getDuration));
    const durMax = Math.max(...allFlights.map(getDuration)) || durMin + 1;

    const bestScored = allFlights.map((f: any) => {
      const priceNorm = (getPrice(f) - priceMin) / (priceMax - priceMin || 1);
      const durNorm = (getDuration(f) - durMin) / (durMax - durMin || 1);
      const stopsPenalty = getStops(f) * 0.3;
      const score = priceNorm * 0.4 + durNorm * 0.3 + stopsPenalty * 0.3;
      return { f, score };
    }).sort((a: any, b: any) => a.score - b.score);

    const bestFlight = bestScored[0]?.f;
    const sortedByPrice = [...allFlights].sort((a: any, b: any) => getPrice(a) - getPrice(b));
    let cheapestFlight = sortedByPrice.find((f: any) => flightKey(f) !== flightKey(bestFlight)) || sortedByPrice[0];
    const sortedByDuration = [...allFlights].sort((a: any, b: any) => getDuration(a) - getDuration(b));
    let fastestFlight = sortedByDuration.find((f: any) =>
      flightKey(f) !== flightKey(bestFlight) && flightKey(f) !== flightKey(cheapestFlight)
    ) || sortedByDuration[0];

    // Diversify if duplicates
    if (flightKey(cheapestFlight) === flightKey(bestFlight) && sortedByPrice.length > 1) {
      cheapestFlight = sortedByPrice[1];
    }
    if (flightKey(fastestFlight) === flightKey(bestFlight) || flightKey(fastestFlight) === flightKey(cheapestFlight)) {
      fastestFlight = sortedByDuration.find((f: any) =>
        flightKey(f) !== flightKey(bestFlight) && flightKey(f) !== flightKey(cheapestFlight)
      ) || fastestFlight;
    }

    // ── Preferred Airline Logic ──
    const prefAirline = (args.preferredAirline || "").trim().toUpperCase();
    const isPreferredMatch = (f: any) => {
      if (!prefAirline) return false;
      const code = (f.airline || "").toUpperCase();
      const name = (f.airlineName || "").toUpperCase();
      return code === prefAirline || name.includes(prefAirline) || prefAirline.includes(code);
    };

    let preferredSuffix = ""; // appended to tag if preferred falls in a category
    let separatePreferred: any = null; // shown first if not in any category

    if (prefAirline) {
      const prefFlights = allFlights.filter(isPreferredMatch);
      if (prefFlights.length > 0) {
        // Check if preferred airline is already one of the 3 picks
        const bestIsPreferred = isPreferredMatch(bestFlight);
        const cheapestIsPreferred = isPreferredMatch(cheapestFlight);
        const fastestIsPreferred = isPreferredMatch(fastestFlight);

        if (bestIsPreferred) {
          preferredSuffix = " (Preferred)";
          bestFlight._prefNote = true;
        } else if (cheapestIsPreferred) {
          preferredSuffix = " (Preferred)";
          cheapestFlight._prefNote = true;
        } else if (fastestIsPreferred) {
          preferredSuffix = " (Preferred)";
          fastestFlight._prefNote = true;
        } else {
          // Preferred airline is NOT in any category — show it separately first
          const bestPref = prefFlights.sort((a: any, b: any) => getPrice(a) - getPrice(b))[0];
          separatePreferred = bestPref;
        }
      }
    }

    const selected: Array<{ flight: any; tag: string }> = [];
    if (separatePreferred) {
      selected.push({ flight: separatePreferred, tag: "❤️ Preferred by You" });
    }
    selected.push({ flight: bestFlight, tag: bestFlight?._prefNote ? "⭐ Best (Preferred)" : "⭐ Best" });
    selected.push({ flight: cheapestFlight, tag: cheapestFlight?._prefNote ? "💰 Cheapest (Preferred)" : "💰 Cheapest" });
    selected.push({ flight: fastestFlight, tag: fastestFlight?._prefNote ? "⚡ Fastest (Preferred)" : "⚡ Fastest" });

    const finalFlights: any[] = [];
    const finalKeys = new Set<string>();
    for (const { flight, tag } of selected) {
      if (!flight) continue;
      const key = flightKey(flight);
      if (!finalKeys.has(key)) {
        flight._tag = tag;
        finalFlights.push(flight);
        finalKeys.add(key);
      }
    }

    const topFlights = finalFlights.map((f: any) => {
      const apiBag = f.baggageAllowance || {};
      const cabinBag = f.cabinBaggage || apiBag.cabin || "7 Kg";
      const checkinBag = f.checkinBaggage || apiBag.checkin || "20 Kg";

      const extractTime = (iso: string) => {
        if (!iso) return "N/A";
        try {
          const d = new Date(iso);
          return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Dhaka" });
        } catch { return iso; }
      };

      // Separate outbound (group 0) and return (group 1) segments
      const allSegs = f.segments || [];
      const outboundSegs = allSegs.filter((s: any) => s.group === 0 || s.group === undefined);
      const returnSegs = allSegs.filter((s: any) => s.group === 1);
      const isRoundTrip = returnSegs.length > 0 && args.returnDate;

      const outFirst = outboundSegs[0];
      const outLast = outboundSegs[outboundSegs.length - 1];
      const retFirst = returnSegs[0];
      const retLast = returnSegs[returnSegs.length - 1];

      const flightData: any = {
        tag: f._tag,
        airline: f.airlineName || f.airline,
        airlineCode: f.airline,
        price: Math.round(f.price),
        currency: f.currency || "BDT",
        departureTime: extractTime(outFirst?.departure || f.departure),
        arrivalTime: extractTime(outLast?.arrival || f.arrival),
        duration: f.duration,
        stops: f.stops,
        layover: buildLayoverInfoFromSegments(outboundSegs.length > 0 ? outboundSegs : allSegs),
        from: f.from || args.from,
        to: f.to || args.to,
        cabinBaggage: cabinBag,
        checkinBaggage: checkinBag,
        flightNumber: f.flightNumber,
      };

      if (isRoundTrip && retFirst && retLast) {
        flightData.outboundDate = args.departDate;
        flightData.returnDate = args.returnDate;
        flightData.outboundLeg = {
          departureTime: extractTime(outFirst?.departure || f.departure),
          arrivalTime: extractTime(outLast?.arrival || f.arrival),
          duration: formatLegDuration(outboundSegs) || f.duration,
          stops: Math.max(0, outboundSegs.length - 1),
          airline: outFirst?.airlineName || outFirst?.carrier || f.airlineName || f.airline,
          layover: buildLayoverInfoFromSegments(outboundSegs),
          cabinBaggage: cabinBag,
          checkinBaggage: checkinBag,
        };
        flightData.returnLeg = {
          departureTime: extractTime(retFirst.departure),
          arrivalTime: extractTime(retLast.arrival),
          duration: formatLegDuration(returnSegs),
          stops: Math.max(0, returnSegs.length - 1),
          airline: retFirst.airlineName || retFirst.carrier || f.airlineName || f.airline,
          layover: buildLayoverInfoFromSegments(returnSegs),
          cabinBaggage: cabinBag,
          checkinBaggage: checkinBag,
        };
      }

      return flightData;
    });

    const hasPreferred = Boolean(separatePreferred || bestFlight?._prefNote || cheapestFlight?._prefNote || fastestFlight?._prefNote);
    return JSON.stringify({
      found: true,
      totalResults: result.flights.length,
      showing: topFlights.length,
      route: `${args.from} → ${args.to}`,
      date: args.departDate,
      returnDate: args.returnDate || null,
      _hasFlightResults: true,
      selectionRule: "Power of 3: Best (balanced), Cheapest (lowest fare), Fastest (shortest time)" + (hasPreferred ? " + Preferred airline highlighted" : ""),
      flights: topFlights,
      _formattedReply: buildFlightResultsReply({
        route: `${args.from} → ${args.to}`,
        date: args.departDate,
        returnDate: args.returnDate || null,
        flights: topFlights,
      }),
    });
  }

  if (name === "search_hotels") {
    const searchBody: any = {
      cityName: args.city,
      checkinDate: args.checkIn,
      checkoutDate: args.checkOut,
      rooms: args.rooms || 1,
      adults: args.adults || 2,
      children: args.children || 0,
    };
    if (args.childrenAges && Array.isArray(args.childrenAges) && args.childrenAges.length > 0) {
      searchBody.childrenAges = args.childrenAges;
    }

    const result = await callEdgeFunction("unified-hotel-search", searchBody);

    if (!result || !result.hotels || result.hotels.length === 0) {
      const pivotMsg = `😕 No hotels available in ${args.city} for those exact dates. But I'm not giving up!\n\n` +
        `📅 **Flexible dates?** Shifting by a day or two might unlock great options.\n` +
        `📍 **Nearby area?** I can check neighboring spots that might be perfect.\n` +
        `🙋 **Need help?** I can connect you with a Travel Expert.\n\n` +
        `Which would you prefer? 🤔`;

      return JSON.stringify({
        found: false,
        _hasPivotResponse: true,
        message: pivotMsg,
        _formattedReply: pivotMsg,
      });
    }

    const allHotels = result.hotels;
    const maxBudget = args.maxBudget ? Number(args.maxBudget) : null;

    // Filter by budget — apply Pivot A if budget filters everything out
    const budgetFiltered = maxBudget
      ? allHotels.filter((h: any) => (h.price || 0) <= maxBudget)
      : allHotels;

    if (maxBudget && budgetFiltered.length === 0) {
      const cheapestAvailable = [...allHotels].sort((a: any, b: any) => (a.price || 999999) - (b.price || 999999))[0];
      const cheapestPrice = cheapestAvailable ? formatReplyCurrency(cheapestAvailable.price, cheapestAvailable.currency || "BDT") : "";

      const pivotMsg = `😅 Couldn't find anything under your budget right in ${args.city}. Prices start from ${cheapestPrice}/night.\n\n` +
        `💡 **Nearby areas** might have budget-friendly gems — want me to check?\n` +
        `💰 **Stretch the budget a bit?** I found great deals just above your limit.\n\n` +
        `What would you prefer? 🤔`;

      return JSON.stringify({
        found: false,
        _hasPivotResponse: true,
        message: pivotMsg,
        _formattedReply: pivotMsg,
        cheapestAvailable: cheapestAvailable ? Math.round(cheapestAvailable.price) : null,
      });
    }

    const pool = budgetFiltered.length > 0 ? budgetFiltered : allHotels;

    // ── Power of 3: Best Value, Cheapest, Premium ──
    // Bucket A: Best Value — highest rating-to-price ratio
    const bestValue = [...pool]
      .filter((h: any) => h.price > 0)
      .sort((a: any, b: any) => {
        const ratioA = (a.rating || a.stars || 0) / (a.price || 1);
        const ratioB = (b.rating || b.stars || 0) / (b.price || 1);
        return ratioB - ratioA;
      })[0];

    // Bucket B: Cheapest — lowest price with decent rating (7.0+ or 3+ stars)
    const cheapest = [...pool]
      .filter((h: any) => h.price > 0 && ((h.rating || 0) >= 7.0 || (h.stars || 0) >= 3))
      .sort((a: any, b: any) => (a.price || 999999) - (b.price || 999999))[0]
      || [...pool].filter((h: any) => h.price > 0).sort((a: any, b: any) => (a.price || 999999) - (b.price || 999999))[0];

    // Bucket C: Premium — highest star rating / luxury
    const premium = [...pool]
      .sort((a: any, b: any) => {
        const starsA = a.stars || 0;
        const starsB = b.stars || 0;
        if (starsB !== starsA) return starsB - starsA;
        return (b.rating || 0) - (a.rating || 0);
      })[0];

    // Deduplicate and build final picks
    const hotelKey = (h: any) => (h.name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const selectedHotels: Array<{ hotel: any; bucket: string; icon: string }> = [];
    const usedKeys = new Set<string>();

    const addIfNew = (h: any, bucket: string, icon: string) => {
      if (!h) return;
      const key = hotelKey(h);
      if (!usedKeys.has(key)) {
        usedKeys.add(key);
        selectedHotels.push({ hotel: h, bucket, icon });
      }
    };

    addIfNew(bestValue, "Best Value", "⭐");
    addIfNew(cheapest, "Cheapest", "💸");
    addIfNew(premium, "Premium", "💎");

    // If dedup reduced to <3, fill from remaining sorted by rating
    if (selectedHotels.length < 3) {
      const remaining = pool
        .filter((h: any) => !usedKeys.has(hotelKey(h)) && h.price > 0)
        .sort((a: any, b: any) => (b.rating || 0) - (a.rating || 0));
      for (const h of remaining) {
        if (selectedHotels.length >= 3) break;
        addIfNew(h, "Recommended", "🏨");
      }
    }

    // Calculate nights
    const checkInDate = new Date(args.checkIn);
    const checkOutDate = new Date(args.checkOut);
    const nights = Math.max(1, Math.round((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)));

    // Build deterministic reply
    const formattedDate = `${formatReplyDate(args.checkIn)} — ${formatReplyDate(args.checkOut)}`;
    const nightsLabel = `${nights} night${nights > 1 ? "s" : ""}`;

    const replyHeader = `🏨 Found ${allHotels.length} hotels in ${args.city} for ${formattedDate} (${nightsLabel})! Here are your top 3 picks:\n`;

    const cards = selectedHotels.map((item, idx) => {
      const h = item.hotel;
      const badge = ["1️⃣", "2️⃣", "3️⃣"][idx] || `${idx + 1}.`;
      const priceText = formatReplyCurrency(h.price, h.currency || "BDT");
      const totalPrice = formatReplyCurrency(h.price * nights, h.currency || "BDT");
      const starsText = h.stars ? "⭐".repeat(Math.min(h.stars, 5)) : "";
      const ratingText = h.rating ? ` • ${h.rating}/10` : "";
      // Smart meal/breakfast detection: check mealBasis, amenities, and room data
      const mealBasis = (h.mealBasis || "").toLowerCase();
      const amenitiesLower = (h.amenities || []).map((a: string) => a.toLowerCase());
      let mealDisplay = "";
      if (mealBasis && mealBasis !== "room only" && mealBasis !== "room_only") {
        mealDisplay = `🍽️ ${h.mealBasis}`;
      } else if (amenitiesLower.some((a: string) => a.includes("breakfast"))) {
        mealDisplay = "🍽️ Breakfast Included";
      } else if (amenitiesLower.some((a: string) => a.includes("meal") || a.includes("dining") || a.includes("restaurant"))) {
        mealDisplay = "🍴 On-site Dining";
      } else {
        mealDisplay = "🍽️ Room Only (no meals)";
      }
      const amenitiesList = (h.amenities || []).filter((a: string) => !a.toLowerCase().includes("breakfast")).slice(0, 3).join(", ");

      // Neighborhood guide: city area + vibe
      const cityLower = (args.city || "").toLowerCase();
      const neighborhoodPref = (args.neighborhoodPreference || "").toLowerCase();
      const areaVibe = getAreaVibe(cityLower, neighborhoodPref);
      const proTip = getProTip(item.bucket, cityLower, args.tripType);

      const lines: string[] = [];
      lines.push(`${badge}  ${item.icon} ${item.bucket} • ${priceText}/night`);
      lines.push(`🏨 ${h.name} | ${args.city}`);
      lines.push("");
      if (areaVibe) lines.push(`🏘️ Area: ${areaVibe}`);
      if (proTip) lines.push(`✨ Pro-Tip: ${proTip}`);
      if (starsText || ratingText) lines.push(`${starsText}${ratingText}`);
      lines.push(mealDisplay);
      if (amenitiesList) lines.push(`✅ ${amenitiesList}`);
      lines.push(`💳 Total: ${totalPrice} (${nightsLabel})`);
      lines.push(`🔖 Bookable on TravelVela`);

      return lines.join("\n");
    });

    const ctaText = "Which of these stays looks right for your trip? Tap below to choose! 🏨";

    const formattedReply = `${replyHeader}\n${cards.join("\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n")}\n\n${ctaText}`;

    return JSON.stringify({
      found: true,
      _hasHotelResults: true,
      totalResults: allHotels.length,
      showing: selectedHotels.length,
      city: args.city,
      checkIn: args.checkIn,
      checkOut: args.checkOut,
      nights,
      selectionRule: "Power of 3: Best Value (rating/price ratio), Cheapest (lowest safe price), Premium (highest stars/luxury)",
      hotels: selectedHotels.map((item) => ({
        name: item.hotel.name,
        bucket: item.bucket,
        stars: item.hotel.stars || item.hotel.rating,
        price: Math.round(item.hotel.price),
        totalPrice: Math.round(item.hotel.price * nights),
        currency: item.hotel.currency || "BDT",
        rating: item.hotel.rating,
        mealBasis: item.hotel.mealBasis,
        amenities: (item.hotel.amenities || []).slice(0, 5),
      })),
      _formattedReply: formattedReply,
    });
  }

  if (name === "search_activities") {
const result = await callEdgeFunction("unified-tour-search", {
      action: "freetext",
      searchText: args.searchText,
      currency: args.currency || "USD",
      limit: Math.min(args.limit || 10, 15),
    });

    // ── Pivot Protocol: No results ──
    if (!result || !result.products || result.products.length === 0) {
      const pivotMsg = `😔 Couldn't find activities for "${args.searchText}".\n\nBut don't worry — here's what we can do:\n\n🔄 Try different keywords (e.g. "safari" → "desert tour")\n📍 I can search nearby areas or a broader destination\n🙋 Or connect you with our Travel Expert\n\nWhat would you prefer?`;
      return JSON.stringify({ found: false, _hasActivityPivot: true, message: pivotMsg });
    }

    const allActivities = result.products;
    
    // ── AI Curation: Sort by rating*reviewCount for best experiences ──
    const scored = allActivities.map((t: any) => ({
      ...t,
      _score: (t.rating || 0) * Math.log10(Math.max(t.reviewCount || 1, 1)) + (t.category === "Free Cancellation" ? 0.5 : 0),
    }));
    scored.sort((a: any, b: any) => b._score - a._score);
    
    const displayLimit = Math.min(args.limit || 5, 5);
    const topActivities = scored.slice(0, displayLimit);

    // ── Activity type emoji mapping ──
    const ACTIVITY_EMOJIS: Record<string, string> = {
      boat: "🛶", cruise: "🚢", canal: "🛶", sailing: "⛵", 
      food: "🍜", street: "🍜", cooking: "👨‍🍳", culinary: "🍽️",
      temple: "🏯", palace: "🏯", museum: "🏛️", historical: "🏛️", heritage: "🏛️",
      safari: "🦁", desert: "🏜️", jungle: "🌴", wildlife: "🐘",
      snorkel: "🤿", diving: "🤿", beach: "🏖️", island: "🏝️", water: "💧",
      hiking: "🥾", trek: "🥾", mountain: "⛰️", adventure: "🧗",
      city: "🏙️", walking: "🚶", sightseeing: "👁️", tour: "🗺️",
      night: "🌃", sunset: "🌅", sunrise: "🌅",
      show: "🎭", entertainment: "🎪", culture: "🎭",
      shopping: "🛍️", market: "🛍️",
      spa: "💆", wellness: "🧘", yoga: "🧘",
      transfer: "🚐", airport: "✈️",
    };
    
    function getActivityEmoji(name: string, desc: string): string {
      const text = `${name} ${desc}`.toLowerCase();
      for (const [keyword, emoji] of Object.entries(ACTIVITY_EMOJIS)) {
        if (text.includes(keyword)) return emoji;
      }
      return "🎯";
    }

    // ── Build deterministic activity cards — "Experience Showcase" ──
    const searchLabel = args.searchText || "activities";
    let replyHeader = `🎯 Found ${allActivities.length} experiences for "${searchLabel}" — here are the top ${topActivities.length} picks! ✨\n`;

    const cards = topActivities.map((t: any, idx: number) => {
      const badge = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣"][idx] || `${idx + 1}.`;
      const actEmoji = getActivityEmoji(t.name || "", t.shortDescription || "");
      const priceText = t.price > 0 ? formatReplyCurrency(t.price, t.currency || "USD") : ("Ask for price");
      const ratingStars = t.rating > 0 ? `⭐ ${t.rating}` : "";
      const reviewText = t.reviewCount > 0 ? ` (${t.reviewCount.toLocaleString()} ${"reviews"})` : "";
      const durationText = t.duration ? `⏱️ ${t.duration}` : "";
      const freeCancelBadge = t.category === "Free Cancellation" ? ("🟢 Free Cancellation") : "";

      // Extract includes from description/highlights
      const highlights = (t.highlights || []).slice(0, 3);
      const includesText = highlights.length > 0 
        ? `📋 ${"Includes"}: ${highlights.join(", ")}` 
        : "";
      
      const descText = t.shortDescription ? t.shortDescription.slice(0, 100) + (t.shortDescription.length > 100 ? "..." : "") : "";

      const lines: string[] = [];
      lines.push(`${badge}  ${actEmoji} ${t.name}`);
      
      // Duration + Price line
      const metaParts = [durationText, priceText ? `💰 From ${priceText}/person` : ""].filter(Boolean);
      if (metaParts.length) lines.push(metaParts.join("  •  "));
      
      // Rating + Reviews + Free Cancellation
      const qualityParts = [`${ratingStars}${reviewText}`, freeCancelBadge].filter(Boolean);
      if (qualityParts.length) lines.push(qualityParts.join("  •  "));
      
      // Includes
      if (includesText) lines.push(includesText);
      
      // Description as highlights
      if (descText) lines.push(`✨ ${descText}`);

      return lines.join("\n");
    });

    const ctaText = "Which experience catches your eye? Tap below or type the number! 🎯";

    const formattedReply = `${replyHeader}\n${cards.join("\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n")}\n\n${ctaText}`;

    return JSON.stringify({
      found: true,
      _hasActivityResults: true,
      totalResults: allActivities.length,
      showing: topActivities.length,
      search: args.searchText,
      activities: topActivities.map((t: any, idx: number) => ({
        name: t.name,
        price: t.price,
        currency: t.currency || "USD",
        duration: t.duration,
        rating: t.rating,
        reviewCount: t.reviewCount,
        category: t.category,
        shortDescription: t.shortDescription?.slice(0, 150),
        productCode: t.productCode,
        highlights: (t.highlights || []).slice(0, 3),
      })),
      _formattedReply: formattedReply,
    });
  }

  // ── Get Activity Details ──
  if (name === "get_activity_details") {
const result = await callEdgeFunction("unified-tour-search", {
      action: "product",
      productCode: args.productCode,
      currency: args.currency || "USD",
    });

    if (!result || !result.product) {
      return JSON.stringify({ found: false, message: "Couldn't load activity details. Please try again." });
    }

    const p = result.product;

    // Extract key details
    const inclusions = (p.inclusions || []).map((i: any) => i.otherDescription || i.inclusionType || "").filter(Boolean);
    const exclusions = (p.exclusions || []).map((e: any) => e.otherDescription || e.exclusionType || "").filter(Boolean);
    const itinerary = (p.itinerary?.itineraryItems || []).map((item: any) => ({
      name: item.pointOfInterestLocation?.attractionId ? item.description : (item.description || ""),
      duration: item.duration?.fixedDurationInMinutes ? `${item.duration.fixedDurationInMinutes}min` : "",
    })).filter((i: any) => i.name);

    // Product options (variants)
    const options = (p.productOptions || []).map((o: any) => ({
      code: o.productOptionCode,
      title: o.title || o.description || "Standard",
      description: o.description || "",
    }));

    // Pricing
    const price = p.pricing?.summary?.fromPrice || 0;
    const priceCurrency = p.pricing?.currency || args.currency || "USD";

    // Build rich detail card
    const priceText = price > 0 ? formatReplyCurrency(price, priceCurrency) : "";
    const ratingStars = p.reviews?.combinedAverageRating ? `⭐ ${Math.round(p.reviews.combinedAverageRating * 10) / 10}` : "";
    const reviewCount = p.reviews?.totalReviews || 0;
    const duration = p.duration?.fixedDurationInMinutes
      ? `${Math.floor(p.duration.fixedDurationInMinutes / 60)}h${p.duration.fixedDurationInMinutes % 60 > 0 ? ` ${p.duration.fixedDurationInMinutes % 60}m` : ""}`
      : p.duration?.variableDurationFromMinutes
        ? `${Math.floor(p.duration.variableDurationFromMinutes / 60)}-${Math.floor((p.duration.variableDurationToMinutes || p.duration.variableDurationFromMinutes) / 60)}h`
        : "";

    const cancellation = p.cancellationPolicy?.type === "FULL_REFUND"
      ? "🟢 Free cancellation"
      : p.cancellationPolicy?.description || "";

    const lines: string[] = [];
    lines.push(`🎯 **${p.title}**`);
    lines.push("");
    if (duration || priceText) lines.push(`⏱️ ${duration}  •  💰 From ${priceText}`);
    if (ratingStars) lines.push(`${ratingStars} (${reviewCount.toLocaleString()} reviews)`);
    if (cancellation) lines.push(cancellation);
    lines.push("");

    if (p.description) {
      const desc = p.description.replace(/<[^>]*>/g, "").slice(0, 300);
      lines.push(`📝 ${desc}${p.description.length > 300 ? "..." : ""}`);
      lines.push("");
    }

    if (inclusions.length > 0) {
      lines.push("✅ **What's Included:**");
      inclusions.slice(0, 5).forEach((i: string) => lines.push(`  • ${i}`));
      lines.push("");
    }
    if (exclusions.length > 0) {
      lines.push("❌ **Not Included:**");
      exclusions.slice(0, 3).forEach((e: string) => lines.push(`  • ${e}`));
      lines.push("");
    }

    if (itinerary.length > 0) {
      lines.push("🗺️ **Itinerary:**");
      itinerary.slice(0, 5).forEach((item: any, idx: number) => {
        lines.push(`  ${idx + 1}. ${item.name}${item.duration ? ` (${item.duration})` : ""}`);
      });
      lines.push("");
    }

    if (options.length > 1) {
      lines.push("🎫 **Options Available:**");
      options.slice(0, 4).forEach((o: any, idx: number) => {
        lines.push(`  ${idx + 1}. ${o.title}`);
      });
      lines.push("");
    }

    const ctaText = "Want to book this? Just tell me your travel date and how many people! 📅";
    lines.push(ctaText);

    const formattedReply = lines.join("\n");

    return JSON.stringify({
      found: true,
      _hasActivityDetail: true,
      productCode: args.productCode,
      name: p.title,
      price,
      currency: priceCurrency,
      duration,
      rating: p.reviews?.combinedAverageRating || 0,
      reviewCount,
      inclusions: inclusions.slice(0, 5),
      exclusions: exclusions.slice(0, 3),
      cancellation,
      productOptions: options,
      _formattedReply: formattedReply,
    });
  }

  // ── Check Activity Availability ──
  if (name === "check_activity_availability") {
    // Build paxMix
    const paxMix: any[] = [];
    const adultCount = args.adults || 1;
    paxMix.push({ ageBand: "ADULT", numberOfTravelers: adultCount });
    if (args.children && args.children > 0) {
      if (args.childrenAges && Array.isArray(args.childrenAges)) {
        // Group children by age band
        const childAges = args.childrenAges;
        const childCount = childAges.filter((a: number) => a >= 3 && a <= 12).length;
        const infantCount = childAges.filter((a: number) => a < 3).length;
        const youthCount = childAges.filter((a: number) => a > 12 && a < 18).length;
        if (childCount > 0) paxMix.push({ ageBand: "CHILD", numberOfTravelers: childCount });
        if (infantCount > 0) paxMix.push({ ageBand: "INFANT", numberOfTravelers: infantCount });
        if (youthCount > 0) paxMix.push({ ageBand: "YOUTH", numberOfTravelers: youthCount });
      } else {
        paxMix.push({ ageBand: "CHILD", numberOfTravelers: args.children });
      }
    }

    const result = await callEdgeFunction("unified-tour-search", {
      action: "availability",
      productCode: args.productCode,
      productOptionCode: args.productOptionCode || undefined,
      travelDate: args.travelDate,
      paxMix,
      currency: args.currency || "USD",
    });

    if (!result || !result.availability) {
      return JSON.stringify({
        available: false,
        message: "Couldn't check availability. The date may not be available or the activity might be sold out. Try a different date?",
      });
    }

    const avail = result.availability;
    const bookableItems = avail.bookableItems || [];

    if (bookableItems.length === 0) {
      return JSON.stringify({
        available: false,
        message: `No availability on ${args.travelDate}. Would you like to try a different date? 📅`,
      });
    }

    // Extract available time slots and prices
    const slots = bookableItems.map((item: any) => {
      const startTime = item.startTime || "";
      const totalPrice = item.totalPrice?.price?.recommendedRetailPrice
        || item.totalPrice?.price?.partnerTotalPrice
        || item.lineItems?.reduce((sum: number, li: any) =>
          sum + (li.subtotalPrice?.price?.recommendedRetailPrice || li.subtotalPrice?.price?.partnerTotalPrice || 0), 0)
        || 0;
      const currency = item.totalPrice?.price?.currencyCode || args.currency || "USD";

      return {
        startTime,
        totalPrice: Math.round(totalPrice * 100) / 100,
        currency,
        productOptionCode: item.productOptionCode || "",
      };
    }).filter((s: any) => s.totalPrice > 0);

    if (slots.length === 0) {
      return JSON.stringify({
        available: false,
        message: `Activity is listed but no bookable slots found for ${args.travelDate}. Try another date? 📅`,
      });
    }

    // Format availability card
    const lines: string[] = [];
    const dateFormatted = formatReplyDate(args.travelDate);
    lines.push(`✅ **Available on ${dateFormatted}!**`);
    lines.push("");
    lines.push(`👥 ${adultCount} adult${adultCount > 1 ? "s" : ""}${args.children ? ` + ${args.children} child${args.children > 1 ? "ren" : ""}` : ""}`);
    lines.push("");

    if (slots.length === 1) {
      const s = slots[0];
      const priceText = formatReplyCurrency(s.totalPrice, s.currency);
      lines.push(`💰 **Total: ${priceText}**`);
      if (s.startTime) lines.push(`🕐 Start time: ${s.startTime}`);
    } else {
      lines.push("🕐 **Available time slots:**");
      slots.slice(0, 5).forEach((s: any, idx: number) => {
        const priceText = formatReplyCurrency(s.totalPrice, s.currency);
        lines.push(`  ${idx + 1}. ${s.startTime || "Flexible"} — ${priceText}`);
      });
    }

    lines.push("");
    const ctaText = "To book, I just need your name, email, and phone number! 🎯";
    lines.push(ctaText);

    return JSON.stringify({
      available: true,
      _hasAvailabilityResult: true,
      date: args.travelDate,
      slots,
      totalTravelers: adultCount + (args.children || 0),
      _formattedReply: lines.join("\n"),
    });
  }

  // ── Confirm Activity Booking ──
  if (name === "confirm_activity_booking") {
    const sb = getSupabaseAdmin();
    const bookingId = `ACT-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    // Create booking record in Supabase
    const bookingData = {
      booking_id: bookingId,
      title: args.activityName,
      subtitle: `${args.travelDate} • ${args.adults} adult${args.adults > 1 ? "s" : ""}${args.children ? ` + ${args.children} child${args.children > 1 ? "ren" : ""}` : ""}`,
      type: "activity",
      status: "pending_payment",
      total: args.totalPrice,
      user_id: "00000000-0000-0000-0000-000000000000", // Guest booking via chat
      details: {
        productCode: args.productCode,
        productOptionCode: args.productOptionCode || null,
        travelDate: args.travelDate,
        startTime: args.startTime || null,
        adults: args.adults,
        children: args.children || 0,
        currency: args.currency,
        leadTraveler: {
          firstName: args.leadTravelerFirstName,
          lastName: args.leadTravelerLastName,
          name: `${args.leadTravelerFirstName} ${args.leadTravelerLastName}`,
          email: args.leadTravelerEmail,
          phone: args.leadTravelerPhone,
        },
        specialRequests: args.specialRequests || null,
        source: "crisp_chatbot",
      },
    };

    const { data: booking, error } = await sb
      .from("bookings")
      .insert(bookingData)
      .select("id, booking_id")
      .single();

    if (error) {
      console.error("[crisp-plugin] Booking creation error:", error);
      return JSON.stringify({
        success: false,
        message: "Something went wrong creating the booking. Our team has been notified — we'll follow up shortly! 🙏",
      });
    }

    // Build confirmation card
    const priceText = formatReplyCurrency(args.totalPrice, args.currency);
    const dateFormatted = formatReplyDate(args.travelDate);

    const lines: string[] = [];
    lines.push("🎉 **Booking Confirmed!**");
    lines.push("");
    lines.push(`🎯 ${args.activityName}`);
    lines.push(`📅 ${dateFormatted}${args.startTime ? ` at ${args.startTime}` : ""}`);
    lines.push(`👥 ${args.adults} adult${args.adults > 1 ? "s" : ""}${args.children ? ` + ${args.children} child${args.children > 1 ? "ren" : ""}` : ""}`);
    lines.push(`💰 Total: ${priceText}`);
    lines.push("");
    lines.push(`📋 Booking ID: **${bookingId}**`);
    lines.push(`👤 ${args.leadTravelerFirstName} ${args.leadTravelerLastName}`);
    lines.push(`📧 ${args.leadTravelerEmail}`);
    lines.push(`📱 ${args.leadTravelerPhone}`);
    lines.push("");
    lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━");
    lines.push("");

    const nextSteps = "Our team will send you a payment link shortly. Any questions? We're here to help! 🙏";
    lines.push(nextSteps);

    return JSON.stringify({
      success: true,
      _hasBookingConfirmation: true,
      bookingId,
      dbId: booking?.id,
      _formattedReply: lines.join("\n"),
    });
  }

  // ── Confirm Flight Booking ──
  if (name === "confirm_flight_booking") {
    const sb = getSupabaseAdmin();
    const bookingId = `FLT-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const passengers = args.passengers || [];

    const bookingData = {
      booking_id: bookingId,
      title: args.flightSummary || `${args.airline} Flight`,
      subtitle: `${args.departDate}${args.returnDate ? ` — ${args.returnDate}` : ""} • ${passengers.length} pax`,
      type: "Flight",
      status: "pending_payment",
      total: args.totalPrice,
      user_id: "00000000-0000-0000-0000-000000000000",
      details: {
        airline: args.airline,
        departDate: args.departDate,
        returnDate: args.returnDate || null,
        tripType: args.tripType || "oneway",
        cabinClass: args.cabinClass || "Economy",
        currency: args.currency,
        passengers: passengers.map((p: any) => ({
          title: p.title || "",
          firstName: p.firstName || "",
          lastName: p.lastName || "",
          fullName: `${p.title || ""} ${p.firstName || ""} ${p.lastName || ""}`.trim(),
          dob: p.dob || null,
          nationality: p.nationality || null,
          passportNumber: p.passportNumber || null,
          passportExpiry: p.passportExpiry || null,
          passportCountry: p.passportCountry || p.nationality || null,
          frequentFlyer: p.frequentFlyer || null,
          type: p.type || "adult",
        })),
        contactEmail: args.contactEmail,
        contactPhone: args.contactPhone,
        specialRequests: args.specialRequests || null,
        source: "crisp_chatbot",
      },
    };

    const { data: booking, error } = await sb
      .from("bookings")
      .insert(bookingData)
      .select("id, booking_id")
      .single();

    if (error) {
      console.error("[crisp-plugin] Flight booking error:", error);
      return JSON.stringify({
        success: false,
        message: "Something went wrong creating the booking. Our team has been notified — we'll follow up shortly! 🙏",
      });
    }

    const priceText = formatReplyCurrency(args.totalPrice, args.currency);
    const dateFormatted = formatReplyDate(args.departDate);

    const lines: string[] = [];
    lines.push("🎉 **Booking Confirmed!**");
    lines.push("");
    lines.push(`✈️ ${args.flightSummary}`);
    lines.push(`📅 ${dateFormatted}${args.returnDate ? ` — ${formatReplyDate(args.returnDate)}` : ""}`);
    lines.push(`💺 ${args.cabinClass || "Economy"} • ${passengers.length} traveler${passengers.length > 1 ? "s" : ""}`);
    lines.push(`💰 Total: ${priceText}`);
    lines.push("");
    lines.push(`📋 Booking ID: **${bookingId}**`);
    passengers.forEach((p: any, i: number) => {
      const displayName = p.fullName || `${p.title || ""} ${p.firstName || ""} ${p.lastName || ""}`.trim();
      lines.push(`👤 ${i + 1}. ${displayName}${p.type !== "adult" ? ` (${p.type})` : ""}`);
      if (p.passportNumber) lines.push(`   🛂 ${p.passportNumber} (exp: ${p.passportExpiry || "N/A"})`);
    });
    lines.push(`📧 ${args.contactEmail}`);
    lines.push(`📱 ${args.contactPhone}`);
    lines.push("");
    lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━");
    lines.push("");
    lines.push("💳 **Payment Options:**");
    lines.push("• bKash: 01870802030 (Personal)");
    lines.push("• Bank Transfer: Ask for details");
    lines.push("");

    const nextSteps = "Once paid, send the screenshot or transaction ID here. Your e-ticket will be emailed shortly! 🎫";
    lines.push(nextSteps);

    return JSON.stringify({
      success: true,
      _hasBookingConfirmation: true,
      bookingId,
      dbId: booking?.id,
      _formattedReply: lines.join("\n"),
    });
  }

  // ── Confirm Hotel Booking ──
  if (name === "confirm_hotel_booking") {
    const sb = getSupabaseAdmin();
    const bookingId = `HTL-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    const checkInDate = new Date(args.checkIn);
    const checkOutDate = new Date(args.checkOut);
    const nights = Math.max(1, Math.round((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)));

    const bookingData = {
      booking_id: bookingId,
      title: `${args.hotelName} — ${args.city}`,
      subtitle: `${args.checkIn} to ${args.checkOut} • ${nights} night${nights > 1 ? "s" : ""} • ${args.rooms || 1} room${(args.rooms || 1) > 1 ? "s" : ""}`,
      type: "Hotel",
      status: "pending_payment",
      total: args.totalPrice,
      user_id: "00000000-0000-0000-0000-000000000000",
      details: {
        hotelName: args.hotelName,
        city: args.city,
        checkIn: args.checkIn,
        checkOut: args.checkOut,
        nights,
        rooms: args.rooms || 1,
        adults: args.adults || 1,
        children: args.children || 0,
        currency: args.currency,
        guestFirstName: args.guestFirstName,
        guestLastName: args.guestLastName,
        guestName: `${args.guestFirstName} ${args.guestLastName}`,
        guestEmail: args.guestEmail,
        guestPhone: args.guestPhone,
        specialRequests: args.specialRequests || null,
        mealPlan: args.mealPlan || null,
        panNumber: args.panNumber || null,
        passportNumber: args.passportNumber || null,
        passportExpiry: args.passportExpiry || null,
        nationality: args.nationality || null,
        source: "crisp_chatbot",
      },
    };

    const { data: booking, error } = await sb
      .from("bookings")
      .insert(bookingData)
      .select("id, booking_id")
      .single();

    if (error) {
      console.error("[crisp-plugin] Hotel booking error:", error);
      return JSON.stringify({
        success: false,
        message: "Something went wrong creating the booking. Our team has been notified — we'll follow up shortly! 🙏",
      });
    }

    const priceText = formatReplyCurrency(args.totalPrice, args.currency);
    const nightsLabel = `${nights} night${nights > 1 ? "s" : ""}`;

    const lines: string[] = [];
    lines.push("🎉 **Booking Confirmed!**");
    lines.push("");
    lines.push(`🏨 ${args.hotelName} | ${args.city}`);
    lines.push(`📅 ${formatReplyDate(args.checkIn)} — ${formatReplyDate(args.checkOut)} (${nightsLabel})`);
    lines.push(`👥 ${args.adults || 1} adult${(args.adults || 1) > 1 ? "s" : ""}${args.children ? ` + ${args.children} child${args.children > 1 ? "ren" : ""}` : ""} • ${args.rooms || 1} room${(args.rooms || 1) > 1 ? "s" : ""}`);
    if (args.mealPlan) lines.push(`🍽️ ${args.mealPlan}`);
    lines.push(`💰 Total: ${priceText}`);
    lines.push("");
    lines.push(`📋 Booking ID: **${bookingId}**`);
    lines.push(`👤 ${args.guestFirstName} ${args.guestLastName}`);
    lines.push(`📧 ${args.guestEmail}`);
    lines.push(`📱 ${args.guestPhone}`);
    if (args.specialRequests) lines.push(`📝 ${args.specialRequests}`);
    lines.push("");
    lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━");
    lines.push("");
    lines.push("💳 **Payment Options:**");
    lines.push("• bKash: 01870802030 (Personal)");
    lines.push("• Bank Transfer: Ask for details");
    lines.push("");

    const nextSteps = "Once paid, send the screenshot or transaction ID here. Your hotel confirmation will be emailed shortly! 🏨";
    lines.push(nextSteps);

    return JSON.stringify({
      success: true,
      _hasBookingConfirmation: true,
      bookingId,
      dbId: booking?.id,
      _formattedReply: lines.join("\n"),
    });
  }

  if (name === "plan_trip") {
    // Send a "planning now" message to the visitor before the long-running call
    if (crispCtx) {
      const planningMsg = "✅ Got all the details! Planning your trip now — this takes a moment, please wait... ⏳";
      await sendReply(crispCtx.websiteId, crispCtx.sessionId, planningMsg, crispCtx.botName);
    }

    // Call the ai-trip-planner which does flight+hotel search + itinerary generation
    const result = await callEdgeFunction("ai-trip-planner", {
      messages: [{ role: "user", content: args.tripDescription }],
      currency: args.currency || detectedCurrency,
    }, 55_000); // longer timeout for trip planning

    if (!result || result.error) {
      return JSON.stringify({
        success: false,
        message: result?.error || "Trip planning failed. Please try again.",
      });
    }

    // The reply contains the full itinerary (may include JSON block)
    return JSON.stringify({
      success: true,
      itinerary: result.reply,
      liveData: result.liveData,
    });
  }

  if (name === "read_passport") {
    const imageUrl = args.imageUrl;
    if (!imageUrl) {
      return JSON.stringify({ success: false, message: "No image URL provided." });
    }

    const geminiKey = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!geminiKey) {
      return JSON.stringify({ success: false, message: "Vision AI not configured. Please provide passport details manually." });
    }

    try {
      console.log(`[crisp-plugin] Reading passport from image: ${imageUrl.slice(0, 80)}...`);

      // Fetch the image and convert to base64
      const imgRes = await fetch(imageUrl);
      if (!imgRes.ok) {
        return JSON.stringify({ success: false, message: "Could not access the image. Please try sending it again." });
      }
      const imgBuffer = await imgRes.arrayBuffer();
      // Convert to base64 without spreading large arrays onto the call stack
      const bytes = new Uint8Array(imgBuffer);
      let binary = "";
      const chunkSize = 8192;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
        for (let j = 0; j < chunk.length; j++) {
          binary += String.fromCharCode(chunk[j]);
        }
      }
      const base64Image = btoa(binary);
      const mimeType = imgRes.headers.get("content-type") || "image/jpeg";

      const primaryPrompt = `Read ONLY the passport Machine Readable Zone (MRZ) at the bottom of the page.
Return ONLY valid JSON:
{
  "mrzLine1": "complete first MRZ line starting with P<",
  "mrzLine2": "complete second MRZ line",
  "confidence": "high, medium, or low"
}
Rules:
1. Copy both MRZ lines character-for-character, including every < symbol.
2. Do not explain anything.
3. Do not add extra keys.
4. If a character is unclear, use < instead of guessing.`;

      let primaryRawText = "";
      let primaryFinishReason: string | null = null;
      let passportData: Record<string, any> = {};

      try {
        const primaryResult = await runPassportVisionExtraction(geminiKey, base64Image, mimeType, primaryPrompt, 600);
        primaryRawText = primaryResult.rawText;
        primaryFinishReason = primaryResult.finishReason;
        console.log(`[crisp-plugin] Passport OCR raw:`, primaryRawText.slice(0, 300));
        passportData = normalizePassportData(parsePassportVisionOutput(primaryRawText));
      } catch (err: any) {
        console.error(`[crisp-plugin] Gemini Vision error:`, err.message);
        return JSON.stringify({ success: false, message: "Could not process the passport image. Please provide your details manually." });
      }

      if (shouldRetryPassportExtraction(passportData, primaryRawText, primaryFinishReason)) {
        const retryPrompt = `The previous passport read was incomplete. Re-read this passport and return ONLY valid JSON:
{
  "mrzLine1": "complete first MRZ line starting with P<",
  "mrzLine2": "complete second MRZ line",
  "firstName": "given name if visible",
  "lastName": "surname if visible",
  "passportNumber": "passport number if visible",
  "dob": "YYYY-MM-DD if visible",
  "passportExpiry": "YYYY-MM-DD if visible",
  "nationality": "3-letter nationality code if visible",
  "gender": "Male or Female if visible",
  "passportCountry": "3-letter issuing country code if visible",
  "confidence": "high, medium, or low"
}
Rules:
1. Prioritize the two MRZ lines at the bottom.
2. Use printed passport fields only as fallback for values missing from MRZ.
3. Do not explain anything.
4. Do not add extra keys.`;

        try {
          console.log(`[crisp-plugin] Passport OCR retry triggered (finishReason: ${primaryFinishReason || "none"})`);
          const retryResult = await runPassportVisionExtraction(geminiKey, base64Image, mimeType, retryPrompt, 900);
          console.log(`[crisp-plugin] Passport OCR retry raw:`, retryResult.rawText.slice(0, 300));
          const retryData = normalizePassportData(parsePassportVisionOutput(retryResult.rawText));
          passportData = normalizePassportData(mergePassportData(passportData, retryData));
        } catch (retryErr: any) {
          console.error(`[crisp-plugin] Passport OCR retry error:`, retryErr.message);
        }
      }

      const extractedFieldCount = ["fullName", "firstName", "lastName", "passportNumber", "dob", "passportExpiry", "nationality", "passportCountry", "gender"]
        .filter((key) => {
          const value = passportData?.[key];
          return typeof value === "string" ? value.trim() !== "" : value !== null && value !== undefined;
        }).length;
      const hasUsefulPassportData = Boolean(
        passportData.firstName ||
        passportData.lastName ||
        passportData.fullName ||
        passportData.passportNumber ||
        passportData.dob ||
        passportData.passportExpiry ||
        passportData.nationality
      );

      console.log(`[crisp-plugin] Passport OCR normalized fields: ${extractedFieldCount}`, JSON.stringify({
        firstName: passportData.firstName,
        lastName: passportData.lastName,
        passportNumber: passportData.passportNumber,
        dob: passportData.dob,
        nationality: passportData.nationality,
      }).slice(0, 200));

      if (!hasUsefulPassportData) {
        return JSON.stringify({
          success: false,
          message: "Could not reliably extract passport details from the image. Please send a clearer photo or provide the details manually.",
          data: passportData,
        });
      }

      const formattedReply = buildPassportOcrReply(passportData);

      return JSON.stringify({
        success: true,
        message: "Passport details extracted successfully. IMPORTANT: This image was processed in-memory and NOT stored anywhere.",
        data: passportData,
        extractedFieldCount,
        privacyNote: "Image processed securely in-memory only. No passport image or data is stored on our servers.",
        _formattedReply: formattedReply,
      });
    } catch (err: any) {
      console.error(`[crisp-plugin] Passport OCR error:`, err.message);
      return JSON.stringify({ success: false, message: "Error reading passport. Please provide your details manually." });
    }
  }

  if (name === "get_baggage_info") {
    const sb = getSupabaseAdmin();
    const airlineCode = (args.airlineCode || "").toUpperCase();
    const airlineName = args.airlineName || "";

    if (!airlineCode && !airlineName) {
      return JSON.stringify({ found: false, message: "Please specify an airline name or code." });
    }

    // 1. Check airline_settings (admin-configured, always fresh)
    let settingsQuery = sb.from("airline_settings").select("*");
    if (airlineCode) {
      settingsQuery = settingsQuery.ilike("airline_code", `%${airlineCode}%`);
    } else {
      settingsQuery = settingsQuery.ilike("airline_name", `%${airlineName}%`);
    }
    const { data: settingsData } = await settingsQuery.limit(1);

    if (settingsData && settingsData.length > 0) {
      const s = settingsData[0];
      return JSON.stringify({
        found: true,
        source: "admin_settings",
        airline: s.airline_name,
        code: s.airline_code,
        cabinBaggage: s.cabin_baggage,
        checkinBaggage: s.checkin_baggage,
        cancellationPolicy: s.cancellation_policy,
        dateChangePolicy: s.date_change_policy,
        nameChangePolicy: s.name_change_policy,
        noShowPolicy: s.no_show_policy,
      });
    }

    // 2. Check baggage_cache (auto-populated from search results, valid for 60 days)
    if (airlineCode) {
      const { data: cachedData } = await sb
        .from("baggage_cache")
        .select("*")
        .eq("airline_code", airlineCode)
        .gt("expires_at", new Date().toISOString())
        .order("cached_at", { ascending: false })
        .limit(3);

      if (cachedData && cachedData.length > 0) {
        // Return the most recent cached entry
        const c = cachedData[0];
        const resolvedName = AIRLINE_NAME_MAP[airlineCode] || airlineCode;
        return JSON.stringify({
          found: true,
          source: "baggage_cache",
          airline: resolvedName,
          code: airlineCode,
          cabinBaggage: c.cabin_baggage,
          checkinBaggage: c.checkin_baggage,
          route: `${c.from_code} → ${c.to_code}`,
          fareClass: c.fare_class || "General",
          note: "This baggage info is from recent flight searches and may vary by route and fare class.",
        });
      }
    }

    return JSON.stringify({
      found: false,
      message: `No baggage/policy info found for ${airlineCode || airlineName}. This airline may not be in our database yet.`,
    });
  }

  return JSON.stringify({ error: `Unknown tool: ${name}` });
}

// ── Default system prompt (2026 Edition) ──
const DEFAULT_SYSTEM_PROMPT = `# Vela AI Agent — System Prompt

**Today: ${new Date().toISOString().split("T")[0]} | Year: ${new Date().getFullYear()} | Month: ${new Date().toLocaleString("en-US", { month: "long" })}**

## RULE 0: BE SHORT. BE SMART. SELL.
- **MAX 2-3 lines per message.** Search results/itineraries excluded.
- **NO filler.** No "Great!", "Awesome!", "Let me search...", "I'd love to help!". Just act.
- **NO echoing.** Don't repeat what the user said back.
- **ONE question per message.** Never list multiple questions.
- **After results:** "Which one would you like to book?" — nothing more.
- **Always upsell:** Flight booked → "Would you like to check hotels too?" → Hotel booked → "Activities?"
- **If you can search, search.** Don't ask permission or announce it.
- **If you don't understand something, hand off to human.** Don't guess wrong.

## RULE 1: LANGUAGE
- Simply respond in whatever language the user is writing in. Mirror their language naturally.
- Do NOT switch languages unless the user switches first.
- Airline names, airport codes, and proper nouns always stay in English.

## RULE 2: SMART MEMORY
- You have FULL conversation history. NEVER re-ask anything already said.
- "What about hotels?" after flights → search hotels for SAME destination/dates. Don't ask again.
- "there" = last destination. "same dates" = previously mentioned dates.
- "Actually 3 people" → update silently, continue.

## RULE 3: HANDOFF
**Hand off to human immediately when:**
- You genuinely don't understand what the user wants (after one clarification attempt)
- User is frustrated, angry, or asks for a real person
- Refund disputes, payment problems, complex booking modifications
- Tool fails repeatedly with no pivot options

**NEVER hand off for:** Flight/hotel/activity searches, trip planning, student tickets, large groups, baggage questions. USE YOUR TOOLS.

Handoff message: "Connecting you with our team. Please hold on! 🙏"

## RULE 4: DATES — MANDATORY BEFORE SEARCH
- **CRITICAL: You MUST ask the user for travel dates BEFORE calling search_flights or plan_trip.** NEVER assume today's date or any default date. If the user hasn't mentioned a date, ASK: "When would you like to travel?" or "What date are you looking to fly?"
- **NEVER call search_flights without the user explicitly providing a travel date.** This is a hard rule with NO exceptions.
- Bare numbers "27/28/29" = DAYS of current/next month. NEVER interpret as years.
- No year mentioned → use ${new Date().getFullYear()}. If date passed → ${new Date().getFullYear() + 1}.
- **NEVER ask "which year?"** Resolve silently.
- Convert to YYYY-MM-DD silently.

## RULE 5: NUMBERS IN CONTEXT
- "23+23+8" with "student ticket" or "baggage" context → baggage weights (kg), NOT passengers.
- "2 adult 1 child" / "5 jon" → passengers.
- **If ambiguous, ASK ONE short question:** "23+23+8 kg baggage? How many passengers?"
- **NEVER assume 54 passengers.** Numbers >9 without "person/jon" context → probably NOT passengers.

## RULE 6: IATA CODES
- Resolve city names to IATA codes yourself. NEVER ask user for codes.
- Multiple airports → pick the main one. Don't ask which airport.

## IDENTITY
You are **Vela AI Agent** — TravelVela's travel assistant on Crisp chat.
- IATA-accredited agency, Barishal, Bangladesh | Phone: 01870802030
- Services: Flights, Hotels, Tours, Activities, Student fares

## GREETING (FIRST MESSAGE ONLY)
"✈️ Welcome to TravelGo! 🌍

We can help you find and book the best flights, hotels, and travel experiences.

What would you like to do today?"
[BUTTONS: ✈️ Book Flights=search_flights_menu | 🏨 Book Hotels=search_hotels_menu | 🌍 Plan a Trip=plan_a_trip | 🙋 Human Support=speak_human]
After greeting → ultra-short mode. NEVER re-introduce.

## OFF-TOPIC / GIBBERISH
- If you're IN THE MIDDLE of a flow (e.g., collecting booking ref, passenger details, dates), and user sends gibberish or unrelated text → stay in context, re-ask the same question politely. Do NOT redirect.
- Only use off-topic redirect when there's NO active flow: "We specialize in travel bookings. How can I assist you today?" / "আমরা ট্রাভেল বুকিং নিয়ে কাজ করি। কিভাবে সাহায্য করতে পারি?"
- If user seems confused or frustrated → hand off to human immediately.

## TONE & PROFESSIONALISM
- Be professional, courteous, and respectful at all times. You represent a reputable IATA-accredited travel agency.
- Address users formally. Use "Sir/Ma'am" or equivalent polite forms.
- NO casual emoji spam. Use emojis sparingly (max 1 per message).
- NO silly phrases like "buddy", "dude", "pal". You are a professional travel consultant.
- Be warm but business-like. Think: helpful bank officer, not college friend.

## TOOLS
- ✈️ **search_flights** — flights/fares
- 🏨 **search_hotels** — hotels
- 🎯 **search_activities** — tours/activities (Viator)
- 📋 **get_activity_details** — activity details after selection
- 📅 **check_activity_availability** — check date/pax availability
- ✅ **confirm_flight_booking** / **confirm_hotel_booking** / **confirm_activity_booking** — create bookings
- 🗺️ **plan_trip** — complete trip itinerary with flights+hotels+activities
- 🧳 **get_baggage_info** — baggage & airline policies
- 📸 **read_passport** — extract details from passport photo

## FLIGHT SEARCH DATA COLLECTION ORDER
**You MUST collect ALL FOUR before calling search_flights:**
1. Destination — "Where would you like to go?"
2. Origin — "Which city are you flying from?"
3. **Travel date — "When would you like to travel?"** ← NEVER SKIP THIS STEP
4. **Passengers — Ask SPECIFICALLY: "How many adults, children (2-11 yrs), and infants (under 2)?"** ← NEVER SKIP THIS STEP
   - You MUST ask for all three categories: adults, children, and infants separately.
   - If user says just a number like "3 passengers" or "3 jon", follow up: "How many adults, children (2-11 yrs), and infants (under 2)?"
   - Only proceed when you have explicit counts for adults, children, and infants (0 is acceptable for children/infants if user confirms).
Only call search_flights AFTER the user has explicitly provided a travel date AND a breakdown of adults, children, and infants. NEVER default to today's date. NEVER assume 1 adult — always ask.

## MULTI-DATE QUERIES
- "27/28/29 kon date koto price" → search EACH date, show comparison table. Days of current month.
- "return"/"round trip" keywords → round-trip search.
- Two dates, gap >7 days, no keywords → default round-trip.
- Two dates, gap ≤7 days, ambiguous → ASK: "Round trip or date comparison?"

## FLIGHT BOOKING FLOW
1. Search → show results → "Which one would you like to book?"
2. User picks → collect passenger details:
   - Gender, Given name, Surname, DOB, Nationality, Type (adult/child/infant)
   - International: + passport number, expiry
   - Contact: email, phone
   - Passport photo sent? → use **read_passport** tool
3. Use **confirm_flight_booking** → booking card with payment options
4. Domestic = no passport needed. International = passport required.
NEVER send to external links. Handle everything in chat.

## HOTEL BOOKING FLOW
Required before search: city, check-in, check-out, guests, rooms. Budget & type are helpful.
- If user gives all info → search immediately.
- If missing multiple items → ask ALL missing in ONE message (exception to one-question rule).
- After results → "Which one do you prefer?"
- User picks → collect: name, email, phone → **confirm_hotel_booking**

## ACTIVITY BOOKING FLOW
1. Search → show top 3-5 results
2. User picks → **get_activity_details**
3. Collect date + pax → **check_activity_availability**
4. Collect name, email, phone → **confirm_activity_booking**
- If user says "things to do in [city]" without specifics → ask traveler type with buttons:
[BUTTONS: 👤 Solo=solo | 💑 Couple=couple | 👨‍👩‍👧‍👦 Family=family | 👥 Friends=friends]

## TRIP PLANNING (plan_trip)
Gather ONE question at a time in this order:
1. Destination (city, not country) — if city given, accept immediately
2. Origin — "Where are you flying from?"
3. Travel dates
4. Duration → buttons: [BUTTONS: 📅 3 Days=3 day trip | 🗓️ 5 Days=5 day trip | 🌴 7 Days=7 day trip | ✈️ 10 Days=10 day trip]
5. Travelers → buttons: [BUTTONS: 👤 Solo=solo | 💑 Couple=couple | 👨‍👩‍👧‍👦 Family=family | 🎉 Friends=friends]
6. Style → buttons: [BUTTONS: 💰 Budget=budget | ✨ Mid-range=mid-range | 👑 Luxury=luxury]

**Shortcut:** If user provides ALL info in one message → call plan_trip immediately.
**Skip** any step already answered. Parse the FULL message first.

Before calling plan_trip, send brief summary:
"📍 [dest] | 🛫 [origin] | 📅 [dates] | ⏱️ [days] | 👥 [travelers]
Planning now... ⏳"

After results → frame as DRAFT with estimated pricing. Ask: "Would you like to finalize or make changes?"

## BUTTON FORMAT
[BUTTONS: Label1=value1 | Label2=value2 | Label3=value3]
Max 6 buttons. Values should be natural sentences. Use for multiple-choice only, not open-ended questions.

## OPTION SELECTION
User types "1", "2", "option 1" → select that option from last results. Proceed to booking directly.

## RESULT FORMATTING
System auto-formats flight/hotel/activity cards. Just return data as-is.
- Flights: numbered cards with price, route, time, baggage
- Hotels: 3 buckets (Best Value, Cheapest, Premium)
- Activities: cards with duration, price, rating
- ONE message only. NEVER split across multiple messages.

## MANAGE BOOKING FLOW
When user clicks "Manage Booking" or says they need help with an existing booking:
1. Ask: "Please share your booking reference or ticket screenshot 📸 📸"
2. Then ask: "What seems to be the issue?" with buttons:
[BUTTONS: 📅 Date Change=date_change | ❌ Cancel/Refund=cancel_refund | ❓ Other=other_issue]
3. If user asks about name change → hand off to human immediately.
4. Summarize what you know and hand off: "Your reference [ref] regarding [issue] — connecting you with our team! 🙏"
- If user sends a ticket photo, use **read_passport** tool if it contains passport, otherwise note the details visible.
- NEVER try to modify bookings yourself. Always hand off after collecting info.

## STUDENT FARES
Search flights normally. Note student fares need verification. After search, collect Student ID/Visa and hand off for verification only.

## BAGGAGE/POLICY
Use **get_baggage_info** for airline-specific baggage and policy questions.

## TRIP PLAN EXTRAS
After any trip plan, include:
- ✅ Included: flights, hotels, activities booked via TravelVela
- ❌ Excluded: visa, insurance, meals not mentioned, tips, personal expenses
- 📋 Refund: per airline/hotel/activity policy
- 🛂 Visa always excluded

## VISA INFO (Bangladesh passport)
- 🟢 Visa-free: Maldives, Nepal, Bhutan, Seychelles
- 🟡 E-visa/VOA: Thailand, Malaysia, Turkey, Cambodia, Myanmar
- 🔴 Embassy: USA, UK, Canada, Australia, Schengen, Japan, Korea, China, Singapore, UAE, Saudi
- Always caveat: "Visa policies may change. Please verify with the embassy."

## INVOICE INTEGRITY
NEVER issue inflated invoices. Politely decline: "We can only issue invoices for the actual price."

## PAYMENT INFO (share when asked)
**Bank:** DBBL: 1271100024041, City Bank: 1781330020536, UCB: 0322112000001341 — all A/C name: TRAVEL VELA
**Mobile:** bKash: 01319581771 (1%), Nagad: 01870802030 (1%)
**Deadline:** 30 min after confirmation. Send receipt screenshot + passport/visa copies.
`;

// ── Extract conversation context summary for better AI understanding ──
function buildContextSummary(history: Array<{ role: string; content: string }>): string {
  if (history.length < 2) return "";
  
  const facts: string[] = [];
  const mentionedDestinations: string[] = [];
  const mentionedDates: string[] = [];
  let travelers = "";
  let tripStyle = "";
  let lastSearchType = "";
  
  for (const msg of history) {
    const text = msg.content.toLowerCase();
    
    // Track destinations mentioned
    const destMatch = text.match(/(?:to|in|visiting|going to|trip to|travel to)\s+([a-z\s']+?)(?:\s+(?:on|for|from|,|\.|!|\?)|$)/i);
    if (destMatch) mentionedDestinations.push(destMatch[1].trim());
    
    // Track dates
    const dateMatch = text.match(/(\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*(?:\s+\d{4})?)/gi);
    if (dateMatch) mentionedDates.push(...dateMatch);
    
    // Track travelers
    if (/(\d+)\s*(?:person|people|adult|pax|traveler)/i.test(text)) {
      travelers = text.match(/(\d+)\s*(?:person|people|adult|pax|traveler)/i)?.[0] || "";
    }
    if (/\b(solo|couple|family|honeymoon|group|business)\b/i.test(text)) {
      tripStyle = text.match(/\b(solo|couple|family|honeymoon|group|business)\b/i)?.[1] || "";
    }
    
    // Track what was searched
    if (msg.role === "assistant") {
      if (/flight|✈️/.test(text)) lastSearchType = "flights";
      if (/hotel|🏨/.test(text)) lastSearchType = "hotels";
      if (/activit|tour|🎯/.test(text)) lastSearchType = "activities";
    }
  }
  
  const parts: string[] = [];
  if (mentionedDestinations.length > 0) parts.push(`Destinations discussed: ${[...new Set(mentionedDestinations)].join(", ")}`);
  if (mentionedDates.length > 0) parts.push(`Dates mentioned: ${[...new Set(mentionedDates)].join(", ")}`);
  if (travelers) parts.push(`Travelers: ${travelers}`);
  if (tripStyle) parts.push(`Trip style: ${tripStyle}`);
  if (lastSearchType) parts.push(`Last search type: ${lastSearchType}`);
  
  if (parts.length === 0) return "";
  return `\n\n**CONVERSATION CONTEXT (auto-extracted — use this to avoid re-asking):**\n${parts.map(p => `- ${p}`).join("\n")}`;
}

// ── Build system prompt from settings ──
function buildSystemPrompt(settings: PluginSettings, visitorMeta: VisitorMeta, history?: Array<{ role: string; content: string }>, detectedCurrency?: CurrencyCode): string {
  let prompt = DEFAULT_SYSTEM_PROMPT;

  // Inject conversation context summary
  if (history && history.length >= 2) {
    const contextSummary = buildContextSummary(history);
    if (contextSummary) prompt += contextSummary;
  }

  if (settings.system_prompt?.trim()) {
    prompt += `\n\n## 8. Website-Specific Instructions\n${settings.system_prompt.trim()}`;
  }

  if (settings.language && settings.language !== "auto") {
    prompt += `\n\n**LANGUAGE OVERRIDE:** Always respond in ${settings.language}, regardless of the visitor's language.`;
  }
  if (settings.response_style) {
    const styleMap: Record<string, string> = {
      concise: "Keep responses very short — 2-3 lines maximum. Be direct.",
      detailed: "Provide thorough, detailed responses. 5-8 lines is fine.",
      friendly: "Be extra warm, casual, and use emojis. Make it feel like chatting with a friend.",
      professional: "Maintain a formal, business-like tone. Avoid emojis.",
    };
    const style = styleMap[settings.response_style];
    if (style) prompt += `\n\n**RESPONSE STYLE:** ${style}`;
  }
  if (settings.bot_name) prompt = prompt.replace(/Vela AI Agent/g, settings.bot_name);

  // Visitor info + currency context
  const infoParts: string[] = [];
  if (visitorMeta.nickname) infoParts.push(`Name: ${visitorMeta.nickname}`);
  if (visitorMeta.email) infoParts.push(`Email: ${visitorMeta.email}`);
  if (detectedCurrency) {
    const symbol = CURRENCY_SYMBOLS[detectedCurrency] || detectedCurrency;
    infoParts.push(`Currency: ${detectedCurrency} (${symbol})`);
  }
  if (infoParts.length > 0) {
    prompt += `\n\n**VISITOR INFO:** ${infoParts.join(", ")}`;
  }

  // Currency instruction
  if (detectedCurrency) {
    const symbol = CURRENCY_SYMBOLS[detectedCurrency] || detectedCurrency;
    prompt += `\n\n**CURRENCY:** The visitor's detected currency is **${detectedCurrency} (${symbol})**. Always show prices in ${detectedCurrency} format. When calling search tools, use currency="${detectedCurrency}". If the visitor asks to switch currency (e.g. "show in dollars"), use their preferred currency instead.`;
  }

  return prompt;
}

// ══════════════════════════════════════════════
// ── AI Usage Logging ──
// ══════════════════════════════════════════════

// Approximate costs per 1M tokens (USD)
const COST_PER_1M: Record<string, { input: number; output: number }> = {
  "gemini-2.5-flash-lite": { input: 0.075, output: 0.30 },
  "gemini-2.5-flash": { input: 0.15, output: 0.60 },
  "gpt-4.1-mini": { input: 0.40, output: 1.60 },
  "gpt-4.1": { input: 2.00, output: 8.00 },
};

async function logAiUsage(opts: {
  model: string;
  provider: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  durationMs?: number;
  routeReason?: string;
  success?: boolean;
}) {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) return;

    const modelKey = opts.model.replace(/^.*\//, ""); // strip prefix
    const costs = COST_PER_1M[modelKey] || { input: 0.10, output: 0.40 };
    const inputTokens = opts.inputTokens || 0;
    const outputTokens = opts.outputTokens || 0;
    const totalTokens = opts.totalTokens || (inputTokens + outputTokens);
    const estimatedCost = (inputTokens * costs.input + outputTokens * costs.output) / 1_000_000;

    const sb = createClient(supabaseUrl, serviceKey);
    await sb.from("ai_usage_logs").insert({
      model: opts.model,
      provider: opts.provider,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_tokens: totalTokens,
      estimated_cost: Math.round(estimatedCost * 1_000_000) / 1_000_000, // 6 decimal places
      function_name: "crisp-plugin",
      route_reason: opts.routeReason || "",
      duration_ms: opts.durationMs || 0,
      success: opts.success !== false,
    });
  } catch (err: any) {
    console.warn("[crisp-plugin] Failed to log AI usage:", err.message);
  }
}

// ══════════════════════════════════════════════
// ── ChatGPT (OpenAI) Fallback with tool-calling ──
// ══════════════════════════════════════════════

// Convert Gemini tool definitions to OpenAI format
const OPENAI_TOOLS = TOOLS[0].function_declarations.map((fn: any) => ({
  type: "function" as const,
  function: {
    name: fn.name,
    description: fn.description,
    parameters: fn.parameters,
  },
}));

async function chatGptFallback(
  systemPrompt: string,
  conversationHistory: Array<{ role: string; content: string }>,
  visitorMessage: string,
  maxTokens: number,
  model: string = "gpt-4.1-mini",
  crispCtx?: { websiteId: string; sessionId: string; botName: string; currency?: CurrencyCode }
): Promise<string> {
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiKey) {
    console.warn("[crisp-plugin] No OPENAI_API_KEY, cannot fall back to ChatGPT");
    return "Thanks for your message! I'll connect you with our travel team shortly. 🙏";
  }

  console.log("[crisp-plugin] Falling back to ChatGPT (OpenAI) directly");
  const chatGptStart = Date.now();

  try {
    const messages: Array<any> = [
      { role: "system", content: systemPrompt },
      ...conversationHistory.map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      })),
    ];

    // Add current message if not already in history
    if (messages.length <= 1 || messages[messages.length - 1].content !== visitorMessage) {
      messages.push({ role: "user", content: visitorMessage });
    }

    // Function-calling loop (max 3 rounds)
    for (let round = 0; round < 3; round++) {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: maxTokens,
          temperature: 0.7,
          tools: OPENAI_TOOLS,
          tool_choice: "auto",
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error(`[crisp-plugin] ChatGPT error (round ${round}):`, res.status, errText.slice(0, 300));
        return "Thanks for your message! I'll connect you with our travel team shortly. 🙏";
      }

      const data = await res.json();
      const choice = data?.choices?.[0];
      const msg = choice?.message;

      if (!msg) {
        return "Thanks for your message! I'll connect you with our travel team shortly. 🙏";
      }

      // Check if model wants to call tools
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        messages.push(msg);

        for (const toolCall of msg.tool_calls) {
          const fnName = toolCall.function.name;
          let fnArgs = {};
          try {
            fnArgs = JSON.parse(toolCall.function.arguments || "{}");
          } catch { /* use empty args */ }

          console.log(`[crisp-plugin] ChatGPT tool call round ${round}: ${fnName}`);
          const toolResult = await executeToolCall(fnName, {
            ...fnArgs,
            originalMessage: visitorMessage,
          }, crispCtx);
          const deterministicReply = extractDeterministicReply(toolResult);
          if (deterministicReply) {
            console.log("[crisp-plugin] ChatGPT returned deterministic flight reply");
            return deterministicReply;
          }

          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: toolResult,
          });
        }

        continue;
      }

      // No tool calls — return text response
      if (msg.content) {
        console.log("[crisp-plugin] ChatGPT fallback succeeded");
        // Log usage from OpenAI response
        const usage = data?.usage;
        logAiUsage({
          model,
          provider: "openai",
          inputTokens: usage?.prompt_tokens || 0,
          outputTokens: usage?.completion_tokens || 0,
          totalTokens: usage?.total_tokens || 0,
          durationMs: Date.now() - chatGptStart,
          routeReason: "smart-route-or-fallback",
          success: true,
        });
        return msg.content;
      }

      return "Thanks for your message! I'll connect you with our travel team shortly. 🙏";
    }

    console.warn("[crisp-plugin] ChatGPT fallback exhausted 3 rounds");
    return "Thanks for your message! I'll connect you with our travel team shortly. 🙏";
  } catch (err: any) {
    console.error("[crisp-plugin] ChatGPT fetch error:", err.message);
    return "Thanks for your message! I'll connect you with our travel team shortly. 🙏";
  }
}

// ══════════════════════════════════════════════
// ── Smart AI Router: Gemini vs ChatGPT ──
// ══════════════════════════════════════════════

type AiModel = "gemini" | "chatgpt";
type ComplexityTier = "simple" | "complex";
type RouteDecision = { provider: AiModel; tier: ComplexityTier };

/**
 * Classify query intent to route to the best model & tier:
 * - Simple → Gemini 2.5 Flash Lite / GPT-4.1 Mini (cheap, fast)
 * - Complex → Gemini 2.5 Flash / GPT-4.1 (premium, high quality)
 *
 * Provider selection:
 * - Gemini: searches, baggage/fare queries, greetings, FAQs
 * - ChatGPT: trip planning, complex reasoning, complaints, refunds
 *
 * Tier selection:
 * - Simple: greetings, single questions, short messages, searches
 * - Complex: planning, complaints, comparisons, long conversations, multi-sentence
 */
function classifyQueryIntent(message: string, history: Array<{ role: string; content: string }>): RouteDecision {
  const lower = message.toLowerCase().trim();

  // ── ChatGPT complex patterns (premium GPT-4.1) ──
  const chatgptComplexPatterns = [
    // Trip planning & itineraries
    /plan\s+(a|my|our)\s+trip/i,
    /itinerary/i,
    /suggest.*(place|destination|where)/i,
    /recommend/i,
    /best\s+time\s+to\s+(visit|go|travel)/i,
    /what\s+should\s+i\s+(do|see|visit|pack)/i,
    /help\s+me\s+(plan|decide|choose)/i,
    // Complaints & issues
    /complain/i,
    /refund/i,
    /cancel(l?ation)?/i,
    /problem\s+with/i,
    /not\s+happy/i,
    /disappointed/i,
    /worst/i,
    /terrible/i,
    /issue\s+with/i,
    /wrong\s+(charge|booking|ticket|flight)/i,
    // Complex comparisons
    /compare/i,
    /which\s+(is|one)\s+(better|cheaper|faster)/i,
    /pros?\s+and\s+cons?/i,
    /difference\s+between/i,
    // Advice & guidance
    /visa\s+(require|need|process)/i,
    /travel\s+(insurance|advisory|warning)/i,
    /safety/i,
    /covid|vaccine|pcr/i,
    // Follow-up reasoning (implicit references needing context)
    /what\s+about\s+(hotel|flight|activit)/i,
    /and\s+(hotel|flight|activit)/i,
    /also\s+(find|search|book|check)/i,
    /cheaper\s+(one|option|alternative)/i,
    /something\s+(else|different|better)/i,
    /change\s+(it|that|this|the)/i,
    /modify/i,
    /customize/i,
    // Multi-intent (user mentions multiple services in one message)
    /flight.*hotel|hotel.*flight|flight.*activit|hotel.*activit/i,
  ];

  for (const pattern of chatgptComplexPatterns) {
    if (pattern.test(lower)) {
      console.log(`[crisp-plugin] Smart route → ChatGPT/complex (matched: ${pattern.source})`);
      return { provider: "chatgpt", tier: "complex" };
    }
  }

  // Long conversational messages (3+ sentences) → ChatGPT complex
  const sentenceCount = message.split(/[.!?।]+/).filter(s => s.trim().length > 5).length;
  if (sentenceCount >= 3) {
    console.log(`[crisp-plugin] Smart route → ChatGPT/complex (${sentenceCount} sentences)`);
    return { provider: "chatgpt", tier: "complex" };
  }

  // Long conversation history (6+ messages) → ChatGPT complex (lowered from 8 for better context)
  if (history.length >= 6) {
    console.log(`[crisp-plugin] Smart route → ChatGPT/complex (long convo: ${history.length} msgs)`);
    return { provider: "chatgpt", tier: "complex" };
  }

  // ── Gemini complex patterns (premium Gemini 2.5 Flash) ──
  const geminiComplexPatterns = [
    /explain/i,
    /how\s+(does|do|can|to)/i,
    /what\s+is\s+the\s+(best|cheapest|fastest|easiest)/i,
    /tell\s+me\s+(about|more)/i,
    /details?\s+(about|of|on)/i,
    /policy/i,
    /rules?\s+(for|about|of)/i,
    /why\s+(is|should|do|did)/i,
    /what\s+if/i,
  ];

  for (const pattern of geminiComplexPatterns) {
    if (pattern.test(lower)) {
      console.log(`[crisp-plugin] Smart route → Gemini/complex (matched: ${pattern.source})`);
      return { provider: "gemini", tier: "complex" };
    }
  }

  // Medium conversation history (3-5 messages) → Gemini complex for better context (lowered from 4)
  if (history.length >= 3) {
    console.log(`[crisp-plugin] Smart route → Gemini/complex (medium convo: ${history.length} msgs)`);
    return { provider: "gemini", tier: "complex" };
  }

  // Default → Gemini simple (searches, greetings, short questions)
  console.log("[crisp-plugin] Smart route → Gemini/simple (default)");
  return { provider: "gemini", tier: "simple" };
}

async function generateAiResponse(
  visitorMessage: string,
  conversationHistory: Array<{ role: string; content: string }>,
  visitorMeta: VisitorMeta,
  pluginSettings: PluginSettings,
  crispCtx?: { websiteId: string; sessionId: string; botName: string; currency?: CurrencyCode }
): Promise<string> {
  // NOTE: Flight fast-path removed. The AI handles all flight queries via tool-calling
  // to avoid brittle regex parsing that can reverse origin/destination or misparse dates.

  const geminiKey = Deno.env.get("GOOGLE_AI_API_KEY");
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  const systemPrompt = buildSystemPrompt(pluginSettings, visitorMeta, conversationHistory, crispCtx?.currency);
  const maxTokens = pluginSettings.max_tokens || 1200;

  // Smart routing: pick the best model AND tier for this query
  const route = classifyQueryIntent(visitorMessage, conversationHistory);
  console.log(`[crisp-plugin] Route decision: ${route.provider}/${route.tier}`);

  // Route to ChatGPT if selected and available
  if (route.provider === "chatgpt" && openaiKey) {
    const gptModel = route.tier === "complex" ? "gpt-4.1" : "gpt-4.1-mini";
    console.log(`[crisp-plugin] Using ${gptModel} (smart routed)`);
    const result = await chatGptFallback(systemPrompt, conversationHistory, visitorMessage, maxTokens, gptModel, crispCtx);
    // If ChatGPT fails, try Gemini
    if (result === "Thanks for your message! I'll connect you with our travel team shortly. 🙏" && geminiKey) {
      console.log("[crisp-plugin] ChatGPT failed, falling back to Gemini");
      const geminiModel = route.tier === "complex" ? "gemini-2.5-flash" : "gemini-2.5-flash-lite";
      return await geminiAiCall(systemPrompt, conversationHistory, visitorMessage, maxTokens, geminiKey, geminiModel, gptModel, crispCtx);
    }
    return result;
  }

  // Route to Gemini if selected and available
  if (geminiKey) {
    const gemModel = route.tier === "complex" ? "gemini-2.5-flash" : "gemini-2.5-flash-lite";
    const gptFallback = route.tier === "complex" ? "gpt-4.1" : "gpt-4.1-mini";
    console.log(`[crisp-plugin] Using ${gemModel} (smart routed)`);
    return await geminiAiCall(systemPrompt, conversationHistory, visitorMessage, maxTokens, geminiKey, gemModel, gptFallback, crispCtx);
  }

  // Neither key available for selected model — use whatever is available
  if (openaiKey) {
    return await chatGptFallback(systemPrompt, conversationHistory, visitorMessage, maxTokens, "gpt-4.1-mini", crispCtx);
  }

  return "Thanks for your message! I'll connect you with our travel team shortly. 🙏";
}

async function geminiAiCall(
  systemPrompt: string,
  conversationHistory: Array<{ role: string; content: string }>,
  visitorMessage: string,
  maxTokens: number,
  apiKey: string,
  geminiModel: string = "gemini-2.5-flash-lite",
  fallbackGptModel: string = "gpt-4.1-mini",
  crispCtx?: { websiteId: string; sessionId: string; botName: string; currency?: CurrencyCode }
): Promise<string> {
  const geminiStart = Date.now();
  // Build conversation contents
  const contents: Array<{ role: string; parts: Array<any> }> = [
    { role: "user", parts: [{ text: systemPrompt }] },
    { role: "model", parts: [{ text: "Understood. I'll use my search tools (flights, hotels, activities, trip planner, baggage info) when visitors ask about travel." }] },
  ];

  const recentHistory = conversationHistory.slice(-10);
  for (const msg of recentHistory) {
    contents.push({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    });
  }

  if (contents.length < 3 || contents[contents.length - 1].parts[0]?.text !== visitorMessage) {
    contents.push({ role: "user", parts: [{ text: visitorMessage }] });
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`;

  for (let round = 0; round < 3; round++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          tools: TOOLS,
          tool_config: { function_calling_config: { mode: "AUTO" } },
          generationConfig: { temperature: 0.7, maxOutputTokens: maxTokens, topP: 0.95 },
        }),
      });

      if (res.status === 429) {
        console.warn(`[crisp-plugin] Gemini 429, falling back to ChatGPT`);
        return await chatGptFallback(systemPrompt, conversationHistory, visitorMessage, maxTokens, fallbackGptModel, crispCtx);
      }
      if (!res.ok) {
        const errText = await res.text();
        console.error(`[crisp-plugin] Gemini error (round ${round}):`, res.status, errText.slice(0, 300));
        return await chatGptFallback(systemPrompt, conversationHistory, visitorMessage, maxTokens, fallbackGptModel, crispCtx);
      }

      const data = await res.json();
      const candidate = data?.candidates?.[0];
      if (!candidate?.content?.parts) {
        return await chatGptFallback(systemPrompt, conversationHistory, visitorMessage, maxTokens, fallbackGptModel, crispCtx);
      }

      const parts = candidate.content.parts;
      console.log(`[crisp-plugin] Gemini round ${round} parts:`, JSON.stringify(parts.map((p: any) => Object.keys(p))));

      const functionCall = parts.find((p: any) => p.functionCall);
      if (functionCall) {
        const { name, args } = functionCall.functionCall;
        console.log(`[crisp-plugin] Tool call round ${round}: ${name}`);
        const toolArgs = { ...(args || {}), originalMessage: visitorMessage };
        const toolResult = await executeToolCall(name, toolArgs, crispCtx);
        const deterministicReply = extractDeterministicReply(toolResult);
        if (deterministicReply) return deterministicReply;

        contents.push({ role: "model", parts: [{ functionCall: { name, args: args || {} } }] });
        contents.push({ role: "user", parts: [{ functionResponse: { name, response: { content: toolResult } } }] });
        continue;
      }

      const textPart = parts.find((p: any) => p.text);
      if (textPart?.text) {
        // Log Gemini usage
        const usageMeta = data?.usageMetadata;
        logAiUsage({
          model: geminiModel,
          provider: "google",
          inputTokens: usageMeta?.promptTokenCount || 0,
          outputTokens: usageMeta?.candidatesTokenCount || 0,
          totalTokens: usageMeta?.totalTokenCount || 0,
          durationMs: Date.now() - geminiStart,
          routeReason: "smart-route",
          success: true,
        });
        return textPart.text;
      }

      return await chatGptFallback(systemPrompt, conversationHistory, visitorMessage, maxTokens, fallbackGptModel, crispCtx);
    } catch (err: any) {
      console.error(`[crisp-plugin] Gemini fetch error (round ${round}):`, err.message);
      return await chatGptFallback(systemPrompt, conversationHistory, visitorMessage, maxTokens, fallbackGptModel, crispCtx);
    }
  }

  return "I found some results but had trouble processing them. Please try again or visit our website for the latest prices! 🙏";
}

// ── 5-minute handoff follow-up ──
// After handoff, wait 5 minutes then check if a human operator replied.
// If not, send a context-aware follow-up message.
function scheduleHandoffFollowup(websiteId: string, sessionId: string, botName: string) {
  setTimeout(async () => {
    try {
      // Fetch recent messages to check if a human operator replied
      const { data } = await crispApi("GET", `/website/${websiteId}/conversation/${sessionId}/messages`);
      const messages = data?.data || [];

      // Get the handoff timestamp from meta
      const { data: metaData } = await crispApi("GET", `/website/${websiteId}/conversation/${sessionId}/meta`);
      const handoffAt = parseInt(metaData?.data?.data?.handoff_at || "0");
      if (!handoffAt) return;

      // Check if any operator (non-automated, non-user) message was sent AFTER handoff
      const operatorReplied = messages.some((msg: any) => {
        if (msg.from !== "operator" || msg.automated) return false;
        const msgTime = new Date(msg.timestamp || msg.created_at || 0).getTime();
        return msgTime > handoffAt;
      });

      if (operatorReplied) {
        console.log(`[crisp-plugin] Human operator already replied for ${sessionId}, skipping follow-up`);
        return;
      }

      // Analyze conversation context to craft a smart follow-up
      const recentMessages = messages
        .filter((m: any) => m.type === "text" && m.content)
        .slice(-10)
        .map((m: any) => m.content)
        .join(" ")
        .toLowerCase();

      // Detect context: was user looking at flight prices?
      const wasViewingFlights = recentMessages.includes("best value") || recentMessages.includes("cheapest") ||
        recentMessages.includes("fastest") || recentMessages.includes("book option") ||
        recentMessages.includes("৳") || recentMessages.includes("flight");
      const wasViewingHotels = recentMessages.includes("hotel") || recentMessages.includes("room") || recentMessages.includes("check-in");
      const hadComplexIssue = recentMessages.includes("refund") || recentMessages.includes("cancel") ||
        recentMessages.includes("problem") || recentMessages.includes("issue") || recentMessages.includes("complaint");

      let followUpMsg = "Our human support agents are still busy. 🕐\n\n";

      if (wasViewingFlights) {
        followUpMsg += "But I'm still here and can help you! I can book any of those flights, search for different options, or check other dates for you. Just let me know! ✈️";
      } else if (wasViewingHotels) {
        followUpMsg += "But I can still help you with hotel bookings, compare prices, or search different dates. Want me to assist? 🏨";
      } else if (hadComplexIssue) {
        followUpMsg += "They'll get back to you as soon as possible. In the meantime, feel free to ask me anything else — I'm here to help! 🙏";
      } else {
        followUpMsg += "But I'm still here! I can help with flight searches, hotel bookings, or any travel questions. Just ask! 😊";
      }

      await sendReply(websiteId, sessionId, followUpMsg, botName);

      // Also send picker to re-engage
      await sendPicker(websiteId, sessionId, [
        { label: "✈️ Search Flights", value: "search_flights_again" },
        { label: "🏨 Search Hotels", value: "search_hotels_again" },
        { label: "💬 Keep Waiting", value: "keep_waiting" },
      ], botName);

      // Clear the handoff timestamp
      try {
        await crispApi("PATCH", `/website/${websiteId}/conversation/${sessionId}/meta`, {
          data: { handoff_at: "" },
        });
      } catch {}

      console.log(`[crisp-plugin] Sent 5-min handoff follow-up for ${sessionId} (context: ${wasViewingFlights ? "flights" : wasViewingHotels ? "hotels" : hadComplexIssue ? "complex" : "general"})`);
    } catch (err: any) {
      console.error(`[crisp-plugin] Handoff follow-up error:`, err.message);
    }
  }, 5 * 60 * 1000); // 5 minutes
}

// ── DB-based deduplication (works across isolates) ──
async function tryClaimMessage(sessionId: string, fingerprint: string | number, content: string): Promise<boolean> {
  // Build a unique key from session + fingerprint or content hash
  const hashBase = fingerprint
    ? `${sessionId}:fp:${fingerprint}`
    : `${sessionId}:msg:${content.slice(0, 100)}`;
  const dedupId = hashBase;

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Clean old entries (> 2 minutes) — fire and forget
    sb.from("message_dedup").delete().lt("created_at", new Date(Date.now() - 120_000).toISOString()).then(() => {});

    // Try atomic insert — if it succeeds, we claimed it; if conflict, it's a duplicate
    const { error } = await sb.from("message_dedup").insert({ id: dedupId });

    if (error) {
      // Unique constraint violation = duplicate
      if (error.code === "23505") {
        console.log(`[crisp-plugin] Dedup: skipping duplicate for ${sessionId}`);
        return false; // already claimed
      }
      console.warn(`[crisp-plugin] Dedup insert error:`, error.message);
      // On other errors, proceed anyway to not block messages
      return true;
    }

    return true; // successfully claimed
  } catch (err: any) {
    console.warn(`[crisp-plugin] Dedup error:`, err.message);
    return true; // fail-open
  }
}

// ── Filter: only respond to visitor text messages from website chat ──
function getTextContent(data: any): string {
  if (typeof data?.content === "string") return data.content;
  if (typeof data?.content?.text === "string") return data.content.text;
  return "";
}

function looksLikePickerPayload(data: any): boolean {
  const content = data?.content;
  if (!content || typeof content !== "object") return false;

  const hasChoices = Array.isArray(content?.choices);
  const hasContentValue = String(content?.value ?? "").trim() !== "";
  const hasResultValue = String(content?.result?.value ?? content?.result ?? "").trim() !== "";

  return hasChoices || hasContentValue || hasResultValue;
}

function getPickerSelection(data: any): { value: string; hasSelectedChoice: boolean } {
  if (!looksLikePickerPayload(data)) {
    return { value: "", hasSelectedChoice: false };
  }

  const content = data.content;
  const choices = Array.isArray(content?.choices) ? content.choices : [];

  const selectedChoice = choices.find((choice: any) => {
    const selected = choice?.selected;
    return selected === true || selected === "true" || selected === 1 || selected === "1";
  });

  const contentValue = String(content?.value ?? "").trim();
  const resultValue = String(content?.result?.value ?? content?.result ?? "").trim();
  const rawValue = selectedChoice?.value ?? (contentValue || resultValue || "");
  const value = String(rawValue || "").trim();

  console.log(`[crisp-plugin] getPickerSelection: choices=${choices.length}, selected=${!!selectedChoice}, contentValue="${contentValue}", resultValue="${resultValue}", value="${value}", id="${String(content?.id || "")}"`);

  return { value, hasSelectedChoice: Boolean(selectedChoice || contentValue || resultValue) };
}

function mapQuickActionTextToPickerValue(text: string, mode: "loose" | "strict" = "loose"): string {
  const raw = String(text || "").trim().toLowerCase();
  if (!raw) return "";

  const normalized = raw
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, " ")
    .replace(/[^\p{L}\p{N}\s_]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (/^(plan_a_trip|search_flights_menu|search_hotels_menu|speak_human|manage_booking|date_change|cancel_refund|name_change|other_issue|show_more|change_dates|search_flights_again|search_hotels_again)$/.test(raw)) {
    return raw;
  }

  const strictMap: Record<string, string> = {
    "plan a tour": "plan_a_trip",
    "plan a trip": "plan_a_trip",
    "search flights": "search_flights_menu",
    "find hotels": "search_hotels_menu",
    "human support": "speak_human",
    "speak to human": "speak_human",
    "manage booking": "manage_booking",
    "manage my booking": "manage_booking",
  };

  if (strictMap[raw]) return strictMap[raw];
  if (strictMap[normalized]) return strictMap[normalized];

  if (mode === "strict") return "";

  const looksLikeDetailedRequest = /\b(from|to|on|for|\d{1,2}(st|nd|rd|th)?|tomorrow|next|day|days|person|people|adult|adults|child|children|family|couple|honeymoon|budget|luxury)\b/.test(normalized);
  if (looksLikeDetailedRequest) return "";

  if (/^(plan\s+a\s+(tour|trip)|plan\s+a\s+complete\s+trip|complete\s+tour|complete\s+trip)$/.test(normalized)) {
    return "plan_a_trip";
  }
  if (/^(search|find)\s+flights?$/.test(normalized)) {
    return "search_flights_menu";
  }
  if (/^(search|find)\s+hotels?$/.test(normalized)) {
    return "search_hotels_menu";
  }
  if (/^(human\s+support|speak\s+to\s+human|talk\s+to\s+human|human\s+agent)$/.test(normalized)) {
    return "speak_human";
  }

  return "";
}

// ── Origin-to-channel mapping ──
const ORIGIN_TO_CHANNEL: Record<string, string> = {
  "chat": "website",
  "urn:crisp.im:chat:0": "website",
  "": "website",
  "urn:crisp.im:whatsapp:0": "whatsapp",
  "urn:crisp.im:messenger:0": "messenger",
  "urn:crisp.im:instagram:0": "instagram",
  "urn:crisp.im:telegram:0": "telegram",
  "urn:crisp.im:email:0": "email",
  "urn:crisp.im:twitter:0": "twitter",
  "urn:crisp.im:line:0": "line",
  "urn:crisp.im:viber:0": "viber",
};

// Cache for channel settings from DB
let channelSettingsCache: { channels: Record<string, boolean>; ts: number } | null = null;
const CHANNEL_CACHE_TTL = 120_000; // 2 minutes

async function getAllowedChannels(): Promise<Record<string, boolean>> {
  if (channelSettingsCache && Date.now() - channelSettingsCache.ts < CHANNEL_CACHE_TTL) {
    return channelSettingsCache.channels;
  }
  // Default: only website chat enabled — bot disabled on all other channels
  // to avoid interfering with human support agents
  const defaults: Record<string, boolean> = {
    website: true, whatsapp: false, messenger: false, instagram: false,
    telegram: false, email: false, twitter: false, line: false, viber: false,
  };
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) return defaults;
    const res = await fetch(
      `${supabaseUrl}/rest/v1/api_settings?provider=eq.site_apps&select=settings`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
    );
    if (!res.ok) return defaults;
    const rows = await res.json();
    if (rows?.[0]?.settings?.crisp_bot_channels) {
      const saved = rows[0].settings.crisp_bot_channels as Record<string, boolean>;
      const merged = { ...defaults, ...saved };
      channelSettingsCache = { channels: merged, ts: Date.now() };
      return merged;
    }
  } catch (e: any) {
    console.warn(`[crisp-plugin] Failed to load channel settings: ${e.message}`);
  }
  channelSettingsCache = { channels: defaults, ts: Date.now() };
  return defaults;
}

function isFromVisitor(event: string, data: any): boolean {
  // Channel filtering is done asynchronously in the main handler
  // This function only checks message type/format

  // Primary path: visitor messages (text, picker, or file/image)
  if (event === "message:send" && data.from === "user") {
    if (data.automated) return false;
    if (data.type !== "text" && data.type !== "picker" && data.type !== "file") return false;
    if (data.type === "text" && (!data.content || data.content.trim() === "")) return false;
    if (data.type === "file" && !data.content?.url) return false;
    return true;
  }

  // Crisp picker clicks: can arrive as message:received or message:updated,
  // and some payloads omit data.type entirely.
  if ((event === "message:received" || event === "message:updated") && (data.type === "picker" || looksLikePickerPayload(data))) {
    const { value, hasSelectedChoice } = getPickerSelection(data);
    const hasContentValue = Boolean(String(data?.content?.value ?? data?.content?.result?.value ?? data?.content?.result ?? "").trim());
    console.log(`[crisp-plugin] Picker event check: event=${event}, from=${data.from}, value="${value}", hasSelected=${hasSelectedChoice}, hasContentValue=${hasContentValue}`);
    if (hasSelectedChoice || hasContentValue) return true;
  }

  // Some channels echo picker taps as text events (sometimes from operator)
  if ((event === "message:send" || event === "message:received" || event === "message:updated") && data.type === "text" && !data.automated) {
    const strictPickerValue = mapQuickActionTextToPickerValue(getTextContent(data), "strict");
    if (strictPickerValue) {
      console.log(`[crisp-plugin] Treating text as quick-action: event=${event}, from=${data.from}, mapped=${strictPickerValue}`);
      return true;
    }
  }

  return false;
}

function buildDedupFingerprint(event: string, data: any, pickerValue: string): string {
  const rawFingerprint = String(data?.fingerprint || data?.stamp || "").trim();

  // Normalize quick-action/picker events so message:received + message:updated
  // for the same click collapse to a single dedup key.
  if (pickerValue) {
    const pickerId = String(data?.content?.id || "").trim();
    if (pickerId) return `picker:${pickerId}:${pickerValue}`;
    if (rawFingerprint) return `picker:${rawFingerprint}:${pickerValue}`;
    return `picker:value:${pickerValue}`;
  }

  const textContent = getTextContent(data).trim().toLowerCase().slice(0, 120);

  // Use text content ONLY for dedup — fingerprints can differ between
  // message:send and message:received events for the same user message.
  if (textContent) {
    return `text:${textContent}`;
  }

  if (rawFingerprint) return `msg:${String(data?.type || "unknown")}:${rawFingerprint}`;

  return "";
}

// ══════════════════════════════════════════════
// ── Main handler ──
// ══════════════════════════════════════════════

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const payload = await req.json();
    const event = payload.event;
    let data = payload.data || {};
    const websiteId = payload.website_id || data.website_id;
    const sessionId = data.session_id;

    // message:updated picker payloads can omit data.type/data.from and vary between
    // choices[selected], content.value, or content.result shapes.
    if (event === "message:updated" && !data.type && looksLikePickerPayload(data)) {
      const { value, hasSelectedChoice } = getPickerSelection(data);
      if (hasSelectedChoice) {
        data.type = "picker";
        data.from = data.from || "user";
        console.log(`[crisp-plugin] Normalized message:updated as picker click: value="${value}"`);
      }
    }

    // ── Channel filtering (async) ──
    const origin = data.origin || "";
    const channelName = ORIGIN_TO_CHANNEL[origin] || origin.replace(/^urn:crisp\.im:([^:]+):.*$/, "$1") || "unknown";
    const allowedChannels = await getAllowedChannels();
    if (allowedChannels[channelName] === false || (!(channelName in allowedChannels) && channelName !== "website")) {
      console.log(`[crisp-plugin] Channel "${channelName}" (origin: ${origin}) is disabled — skipping`);
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: `Channel ${channelName} disabled` }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!isFromVisitor(event, data)) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: "Not a visitor text message" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!websiteId || !sessionId) {
      return new Response(JSON.stringify({ error: "Missing website_id or session_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── CRITICAL: Return 200 immediately, process in background ──
    // Crisp requires a 200 response within ~2 seconds or it marks the hook as failed.
    // We fire-and-forget the actual processing.
    const bgPromise = handleCrispMessage(event, data, websiteId, sessionId).catch((err) => {
      console.error(`[crisp-plugin] Background processing error for ${sessionId}:`, err.message);
    });

    // Use waitUntil if available (Deno Deploy), otherwise the promise runs detached
    if (typeof (globalThis as any).waitUntil === "function") {
      (globalThis as any).waitUntil(bgPromise);
    }

    return new Response(JSON.stringify({ ok: true, accepted: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[crisp-plugin] Payload parse error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ── Background message processor ──
async function handleCrispMessage(event: string, data: any, websiteId: string, sessionId: string): Promise<void> {
  // Extract message content — handle picker responses
  let visitorMessage = "";
  let isHandoff = false;
  let pickerValue = "";
  let pickerLabel = ""; // The label text the user actually clicked
  if ((data.type === "picker" || looksLikePickerPayload(data)) && data.content) {
    const { value } = getPickerSelection(data);
    pickerValue = value;
    // Extract the label of the selected choice for language detection
    const choices = Array.isArray(data.content?.choices) ? data.content.choices : [];
    const selectedChoice = choices.find((c: any) => c.selected === true || c.value === value);
    pickerLabel = String(selectedChoice?.label || "").replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "").trim();
    console.log(`[crisp-plugin] Picker selected value: ${pickerValue || "(none)"}, label: "${pickerLabel}"`);

    if (!pickerValue) {
      console.log(`[crisp-plugin] Picker message without selected value — skipping`);
      return;
    }

    if (pickerValue === "speak_human") {
      isHandoff = true;
      visitorMessage = "";
    } else if (pickerValue === "manage_booking") {
      visitorMessage = "I need help with an existing booking. Ask me for my booking reference number or ticket copy.";
    } else if (pickerValue === "date_change") {
      visitorMessage = "I want to change the date of my booking.";
    } else if (pickerValue === "cancel_refund") {
      visitorMessage = "I want to cancel my booking and get a refund.";
    } else if (pickerValue === "name_change") {
      visitorMessage = "I need to change a passenger name on my booking.";
    } else if (pickerValue === "other_issue") {
      visitorMessage = "I have another issue with my booking.";
    } else if (pickerValue === "show_more") {
      visitorMessage = "Show me more flight options for the same route and date. Use showMore=true with the same route and date from our previous search.";
    } else if (pickerValue === "change_dates") {
      visitorMessage = "I want to change the travel dates. Ask me what new date I'd like to fly.";
    } else if (pickerValue === "search_flights_again" || pickerValue === "search_flights_menu") {
      visitorMessage = "I'd like to search for flights. Ask me where I want to go.";
    } else if (pickerValue === "search_hotels_again" || pickerValue === "search_hotels_menu") {
      visitorMessage = "I'd like to search for hotels. Ask me which city and dates.";
    } else if (pickerValue === "keep_waiting") {
      visitorMessage = "";
    } else if (pickerValue === "plan_a_trip") {
      visitorMessage = "I want to plan a complete trip. Ask me where I want to go.";
    } else if (pickerValue === "book_now_flights") {
      const earlySettings = await getPluginSettings(websiteId);
      const botName = earlySettings?.bot_name || "Vela AI Agent";
      const recentMsgs = await getConversationMessages(websiteId, sessionId);
      const lastBotMsg = [...recentMsgs].reverse().find(m => m.role === "assistant")?.content || "";
      const NUM_BADGES = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];
      const optionButtons: { label: string; value: string }[] = [];
      for (let i = 0; i < NUM_BADGES.length; i++) {
        if (lastBotMsg.includes(NUM_BADGES[i])) {
          optionButtons.push({ label: `✈️ Option ${i + 1}`, value: `book_option_${i + 1}` });
        }
      }
      if (optionButtons.length === 0) {
        for (let i = 1; i <= 3; i++) optionButtons.push({ label: `✈️ Option ${i}`, value: `book_option_${i}` });
      }
      await sendReply(websiteId, sessionId, "Which flight would you like to book? Tap an option below or type the number (e.g. \"1\" or \"Option 2\") ✈️", botName);
      await new Promise(r => setTimeout(r, 300));
      await sendPicker(websiteId, sessionId, optionButtons, botName);
      await setComposing(websiteId, sessionId, "stop");
      return;
    } else if (pickerValue === "book_now_hotels") {
      const earlySettings = await getPluginSettings(websiteId);
      const botName = earlySettings?.bot_name || "Vela AI Agent";
      const recentMsgs = await getConversationMessages(websiteId, sessionId);
      const lastBotMsg = [...recentMsgs].reverse().find(m => m.role === "assistant")?.content || "";
      const NUM_BADGES = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];
      const optionButtons: { label: string; value: string }[] = [];
      for (let i = 0; i < NUM_BADGES.length; i++) {
        if (lastBotMsg.includes(NUM_BADGES[i])) {
          optionButtons.push({ label: `🏨 Hotel ${i + 1}`, value: `book_hotel_${i + 1}` });
        }
      }
      if (optionButtons.length === 0) {
        for (let i = 1; i <= 3; i++) optionButtons.push({ label: `🏨 Hotel ${i}`, value: `book_hotel_${i}` });
      }
      await sendReply(websiteId, sessionId, "Which hotel catches your eye? Tap below or type the number (e.g. \"1\" or \"Hotel 2\") 🏨", botName);
      await new Promise(r => setTimeout(r, 300));
      await sendPicker(websiteId, sessionId, optionButtons, botName);
      await setComposing(websiteId, sessionId, "stop");
      return;
    } else if (pickerValue === "book_now_activities") {
      const earlySettings = await getPluginSettings(websiteId);
      const botName = earlySettings?.bot_name || "Vela AI Agent";
      const recentMsgs = await getConversationMessages(websiteId, sessionId);
      const lastBotMsg = [...recentMsgs].reverse().find(m => m.role === "assistant")?.content || "";
      const NUM_BADGES = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];
      const optionButtons: { label: string; value: string }[] = [];
      for (let i = 0; i < NUM_BADGES.length; i++) {
        if (lastBotMsg.includes(NUM_BADGES[i])) {
          optionButtons.push({ label: `🎯 Activity ${i + 1}`, value: `book_activity_${i + 1}` });
        }
      }
      if (optionButtons.length === 0) {
        for (let i = 1; i <= 5; i++) optionButtons.push({ label: `🎯 Activity ${i}`, value: `book_activity_${i}` });
      }
      await sendReply(websiteId, sessionId, "Which activity interests you? Tap below or type the number (e.g. \"1\" or \"Activity 3\") 🎯", botName);
      await new Promise(r => setTimeout(r, 300));
      await sendPicker(websiteId, sessionId, optionButtons, botName);
      await setComposing(websiteId, sessionId, "stop");
      return;
    } else if (pickerValue.startsWith("book_hotel_")) {
      const optionNum = pickerValue.replace("book_hotel_", "");
      visitorMessage = `I want to book Hotel Option ${optionNum}. Please proceed with the hotel booking for Option ${optionNum} from our previous hotel search results. Collect my guest details (name, email, phone, special requests) and then use confirm_hotel_booking to create the booking.`;
    } else if (pickerValue === "show_more_hotels") {
      visitorMessage = "Show me more hotel options for the same city and dates from our previous search. Show the next 5 hotels sorted by rating.";
    } else if (pickerValue === "change_area") {
      visitorMessage = "I want to look at hotels in a different area/neighborhood. Ask me which area I prefer.";
    } else if (pickerValue.startsWith("book_activity_")) {
      const optionNum = pickerValue.replace("book_activity_", "");
      visitorMessage = `I want to learn more about Activity Option ${optionNum} from our previous search. Use get_activity_details with the productCode of Activity ${optionNum} to show me full details, inclusions, and pricing. Then ask me for my travel date and group size to check availability.`;
    } else if (pickerValue === "show_more_activities") {
      visitorMessage = "Show me more activity options for the same search. Use a higher limit (10) with the same search keywords from our previous activity search.";
    } else if (pickerValue === "different_activity") {
      visitorMessage = "I want to search for a different type of activity. Ask me what kind of experience I'm looking for.";
    } else if (pickerValue.startsWith("book_option_")) {
      const optionNum = pickerValue.replace("book_option_", "");
      visitorMessage = `I want to book flight Option ${optionNum}. Please proceed with the booking for flight Option ${optionNum} from our previous search results. Collect my passenger details and then use confirm_flight_booking to create the booking.`;
    } else {
      visitorMessage = `I selected: ${pickerValue}`;
    }
  } else if (data.type === "file" && data.content?.url) {
    // User sent a file/image — check if it's an image (passport, ID, etc.)
    const fileUrl = data.content.url;
    const fileName = data.content.name || "";
    const fileType = data.content.type || "";
    const isImage = fileType.startsWith("image/") || /\.(jpg|jpeg|png|webp|heic|gif|bmp)$/i.test(fileName);
    
    if (isImage) {
      console.log(`[crisp-plugin] Image received from visitor: ${fileName} (${fileType})`);
      visitorMessage = `[USER SENT AN IMAGE: ${fileUrl}]\nThe user has sent a photo. Based on our conversation context, if we're in a booking flow and collecting passenger details, this is likely a passport photo — use the read_passport tool with imageUrl="${fileUrl}" to extract their details. If context doesn't suggest passport, ask the user what this image is for.`;
    } else {
      visitorMessage = `I sent a file: ${fileName}. What should I do with it?`;
    }
  } else {
    visitorMessage = data.content;

    // Fallback for channels that deliver quick-action button taps as plain text
    const mappedPickerValue = mapQuickActionTextToPickerValue(visitorMessage);
    if (mappedPickerValue) {
      pickerValue = mappedPickerValue;
      console.log(`[crisp-plugin] Mapped text quick-action to picker value: ${pickerValue}`);

      if (pickerValue === "speak_human") {
        isHandoff = true;
        visitorMessage = "";
      } else if (pickerValue === "manage_booking") {
        visitorMessage = "I need help with an existing booking. Ask me for my booking reference number or ticket copy.";
      } else if (pickerValue === "date_change") {
        visitorMessage = "I want to change the date of my booking.";
      } else if (pickerValue === "cancel_refund") {
        visitorMessage = "I want to cancel my booking and get a refund.";
      } else if (pickerValue === "name_change") {
        visitorMessage = "I need to change a passenger name on my booking.";
      } else if (pickerValue === "other_issue") {
        visitorMessage = "I have another issue with my booking.";
      } else if (pickerValue === "show_more") {
        visitorMessage = "Show me more flight options for the same route and date. Use showMore=true with the same route and date from our previous search.";
      } else if (pickerValue === "change_dates") {
        visitorMessage = "I want to change the travel dates. Ask me what new date I'd like to fly.";
      } else if (pickerValue === "search_flights_again" || pickerValue === "search_flights_menu") {
        visitorMessage = "I'd like to search for flights. Ask me where I want to go.";
      } else if (pickerValue === "search_hotels_again" || pickerValue === "search_hotels_menu") {
        visitorMessage = "I'd like to search for hotels. Ask me which city and dates.";
      } else if (pickerValue === "plan_a_trip") {
        visitorMessage = "I want to plan a complete trip. Ask me where I want to go.";
      }
    }
  }

  // NOTE: Compact flight query rewriting removed — the AI handles natural language
  // flight requests directly via tool-calling for better accuracy.
  const fingerprint = buildDedupFingerprint(event, data, pickerValue);

  // DB-based dedup — atomic claim across all isolates
  const dedupContent = isHandoff ? `handoff:${Date.now()}` : visitorMessage;
  const claimed = await tryClaimMessage(sessionId, fingerprint, dedupContent);
  if (!claimed) {
    console.log(`[crisp-plugin] Dedup: skipping duplicate background processing for ${sessionId}`);
    return;
  }

  const pluginSettings = await getPluginSettings(websiteId);
  if (pluginSettings.enabled === false) {
    return;
  }

  // Handle human handoff directly
  if (isHandoff) {
    const botName = pluginSettings.bot_name || "Vela AI — Your Smart Travel Assistant";
    await sendReply(websiteId, sessionId, "I'm connecting you with our travel team right now. They'll be with you shortly! 🙏", botName);
    try {
      await crispApi("PATCH", `/website/${websiteId}/conversation/${sessionId}/routing`, { assign: { unassign: true } });
    } catch {}
    try {
      await crispApi("PATCH", `/website/${websiteId}/conversation/${sessionId}/meta`, {
        data: { handoff_at: Date.now().toString() },
      });
    } catch {}
    scheduleHandoffFollowup(websiteId, sessionId, botName);
    await setComposing(websiteId, sessionId, "stop");
    return;
  }

  // Handle "keep waiting" — just acknowledge
  if (!visitorMessage || visitorMessage.trim() === "") {
    const botName = pluginSettings.bot_name || "Vela AI — Your Smart Travel Assistant";
    await sendReply(websiteId, sessionId, "No worries! Our team will get back to you soon. I'm still here if you need anything in the meantime! 😊", botName);
    return;
  }

  // Show typing indicator
  await setComposing(websiteId, sessionId, "start");

  // Fetch context in parallel
  const [conversationHistory, visitorMeta] = await Promise.all([
    getConversationMessages(websiteId, sessionId),
    getVisitorMeta(websiteId, sessionId),
  ]);

  const activeFlow = String(visitorMeta.data?.active_flow || "");
  const manageBookingStage = String(visitorMeta.data?.manage_booking_stage || "");
  const botName = pluginSettings.bot_name || "Vela AI — Your Smart Travel Assistant";

  // ── Human operator takeover detection ──
  // If a real human operator has replied recently, the bot should STOP responding
  // to avoid interfering with human support. We check:
  // 1. If handoff_at is set (explicit handoff)
  // 2. If any non-automated operator message exists in the last N messages
  const handoffAt = parseInt(String(visitorMeta.data?.handoff_at || "0"));
  const HUMAN_TAKEOVER_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

  // Check recent messages for human operator activity
  const recentHumanOperatorMsg = conversationHistory.length > 0 && (() => {
    // Get raw messages to check for human operator replies
    // conversationHistory already has the last 20 messages
    // We need to check the original API data, so let's look at the last few messages
    return false; // Will be checked below with raw API data
  })();

  // Fetch raw messages to detect human operator replies accurately
  const { data: rawMsgData } = await crispApi("GET", `/website/${websiteId}/conversation/${sessionId}/messages`);
  const rawMessages = rawMsgData?.data || [];
  
  const now = Date.now();
  const humanOperatorActive = rawMessages.some((msg: any) => {
    // Must be from operator, NOT automated (not the bot), and recent
    if (msg.from !== "operator" || msg.automated) return false;
    // Check the user nickname — skip messages from the bot itself
    const nickname = msg.user?.nickname || "";
    if (nickname.toLowerCase().includes("vela ai") || nickname.toLowerCase().includes("bot")) return false;
    const msgTime = msg.timestamp ? msg.timestamp : new Date(msg.created_at || 0).getTime();
    // Message must be within the takeover window
    return (now - msgTime) < HUMAN_TAKEOVER_WINDOW_MS;
  });

  // Also check if handoff was recently requested
  const handoffActive = handoffAt > 0 && (now - handoffAt) < HUMAN_TAKEOVER_WINDOW_MS;

  if (humanOperatorActive || handoffActive) {
    console.log(`[crisp-plugin] Human operator is active for ${sessionId} (operator_replied=${humanOperatorActive}, handoff=${handoffActive}) — bot standing down`);
    await setComposing(websiteId, sessionId, "stop");
    return;
  }

  if (pickerValue === "manage_booking") {
    await mergeConversationData(websiteId, sessionId, {
      ...(visitorMeta.data || {}),
      active_flow: "manage_booking",
      manage_booking_stage: "awaiting_reference",
      manage_booking_reference: "",
      manage_booking_issue: "",
      manage_booking_issue_detail: "",
      manage_booking_ticket_received: "",
    });
    await sendReply(websiteId, sessionId, "Please share your booking reference or ticket copy.", botName);
    await setComposing(websiteId, sessionId, "stop");
    return;
  }

  if (activeFlow === "manage_booking" || ["date_change", "cancel_refund", "other_issue", "name_change"].includes(pickerValue)) {
    console.log(`[crisp-plugin] Manage booking flow: stage=${manageBookingStage || "(none)"}, picker=${pickerValue || "(none)"}, type=${data.type}`);

    if (pickerValue === "name_change") {
      await beginManageBookingHandoff(websiteId, sessionId, botName, {
        ...(visitorMeta.data || {}),
        manage_booking_issue: "name_change",
      });
      return;
    }

    if (!manageBookingStage || manageBookingStage === "awaiting_reference") {
      if (data.type === "file" && data.content?.url) {
        await mergeConversationData(websiteId, sessionId, {
          ...(visitorMeta.data || {}),
          active_flow: "manage_booking",
          manage_booking_stage: "awaiting_issue",
          manage_booking_ticket_received: "true",
          manage_booking_attachment_url: data.content.url,
        });
        await sendManageBookingIssuePicker(websiteId, sessionId, botName);
        await setComposing(websiteId, sessionId, "stop");
        return;
      }

      const reference = extractBookingReference(visitorMessage);
      if (!reference) {
        await sendReply(websiteId, sessionId, "Please share your booking reference or ticket copy.", botName);
        await setComposing(websiteId, sessionId, "stop");
        return;
      }

      await mergeConversationData(websiteId, sessionId, {
        ...(visitorMeta.data || {}),
        active_flow: "manage_booking",
        manage_booking_stage: "awaiting_issue",
        manage_booking_reference: reference,
      });
      await sendManageBookingIssuePicker(websiteId, sessionId, botName);
      await setComposing(websiteId, sessionId, "stop");
      return;
    }

    if (manageBookingStage === "awaiting_issue") {
      if (pickerValue === "date_change") {
        await mergeConversationData(websiteId, sessionId, {
          ...(visitorMeta.data || {}),
          active_flow: "manage_booking",
          manage_booking_stage: "awaiting_issue_detail",
          manage_booking_issue: "date_change",
        });
        await sendReply(websiteId, sessionId, "Please share the preferred new travel date.", botName);
        await setComposing(websiteId, sessionId, "stop");
        return;
      }

      if (pickerValue === "cancel_refund") {
        await mergeConversationData(websiteId, sessionId, {
          ...(visitorMeta.data || {}),
          active_flow: "manage_booking",
          manage_booking_stage: "awaiting_issue_detail",
          manage_booking_issue: "cancel_refund",
        });
        await sendReply(websiteId, sessionId, "Please briefly mention the reason for cancellation or refund.", botName);
        await setComposing(websiteId, sessionId, "stop");
        return;
      }

      if (pickerValue === "other_issue") {
        await mergeConversationData(websiteId, sessionId, {
          ...(visitorMeta.data || {}),
          active_flow: "manage_booking",
          manage_booking_stage: "awaiting_issue_detail",
          manage_booking_issue: "other_issue",
        });
        await sendReply(websiteId, sessionId, "Please briefly describe the assistance required.", botName);
        await setComposing(websiteId, sessionId, "stop");
        return;
      }

      const normalizedIssue = String(visitorMessage || "").toLowerCase();
      const inferredIssue = /cancel|refund/.test(normalizedIssue)
        ? "cancel_refund"
        : /name\s*change|change\s*name/.test(normalizedIssue)
          ? "name_change"
          : /date|resched|change/.test(normalizedIssue)
            ? "date_change"
            : "other_issue";

      await beginManageBookingHandoff(websiteId, sessionId, botName, {
        ...(visitorMeta.data || {}),
        manage_booking_issue: inferredIssue,
        manage_booking_issue_detail: String(visitorMessage || "").trim(),
      });
      return;
    }

    if (manageBookingStage === "awaiting_issue_detail") {
      const detail = data.type === "file" && data.content?.url
        ? `Attachment received: ${data.content.url}`
        : String(visitorMessage || "").trim();

      await beginManageBookingHandoff(websiteId, sessionId, botName, {
        ...(visitorMeta.data || {}),
        manage_booking_issue_detail: detail,
      });
      return;
    }
  }

  // Smart currency detection
  const detectedCurrency = await detectAndCacheCurrency(websiteId, sessionId, visitorMeta, conversationHistory, visitorMessage);

  // Generate AI response (with tool-calling)
  const crispCtx = { websiteId, sessionId, botName, currency: detectedCurrency };
  const aiReply = await generateAiResponse(visitorMessage, conversationHistory, visitorMeta, pluginSettings, crispCtx);

  // Parse [BUTTONS: ...] from AI reply and extract them
  let cleanReply = aiReply;
  let inlineButtons: Array<{ label: string; value: string }> = [];

  const buttonMatch = aiReply.match(/\[BUTTONS:\s*(.+?)\]/);
  if (buttonMatch) {
    cleanReply = aiReply.replace(/\[BUTTONS:\s*.+?\]/, "").trim();
    const buttonParts = buttonMatch[1].split("|").map(b => b.trim()).filter(Boolean);
    for (const part of buttonParts) {
      const eqIdx = part.lastIndexOf("=");
      if (eqIdx > 0) {
        inlineButtons.push({
          label: part.slice(0, eqIdx).trim(),
          value: part.slice(eqIdx + 1).trim(),
        });
      }
    }
    // Limit to 6 buttons
    inlineButtons = inlineButtons.slice(0, 6);
  }

  const sendResult = await sendReply(websiteId, sessionId, cleanReply, botName);
  await new Promise((resolve) => setTimeout(resolve, 350));

  // Send inline buttons if AI included [BUTTONS:] format
  if (inlineButtons.length > 0) {
    await sendPicker(websiteId, sessionId, inlineButtons, botName);
  }

  // Send combined picker: Single "Book Now" + utility actions (clean, minimal)
  const NUM_BADGES_DETECT = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];
  const hasBadgeOptions = NUM_BADGES_DETECT.some((badge) => aiReply.includes(badge));
  const hasFlightCTA = aiReply.includes("Tap a button below to book");
  const hasHotelCTA = aiReply.includes("Which of these stays") || (aiReply.includes("Best Value") && aiReply.includes("/night"));
  const hasActivityCTA = aiReply.includes("Which activity catches your eye") || (aiReply.includes("🎯") && aiReply.includes("From "));
  const hasFlightResults = hasBadgeOptions && (hasFlightCTA || (!hasHotelCTA && !hasActivityCTA));
  const hasHotelResults = hasHotelCTA && hasBadgeOptions;
  const hasActivityResults = hasActivityCTA && hasBadgeOptions;

  if (hasActivityResults) {
    const optionButtons: { label: string; value: string }[] = [];
    for (let i = 0; i < NUM_BADGES_DETECT.length; i++) {
      if (aiReply.includes(NUM_BADGES_DETECT[i])) {
        optionButtons.push({ label: `🎯 Activity ${i + 1}`, value: `book_activity_${i + 1}` });
      }
    }
    if (optionButtons.length === 0) {
      for (let i = 1; i <= 3; i++) optionButtons.push({ label: `🎯 Activity ${i}`, value: `book_activity_${i}` });
    }
    optionButtons.push({ label: "🔍 More Activities", value: "show_more_activities" });
    optionButtons.push({ label: "🔄 Different Activity", value: "different_activity" });
    await sendPicker(websiteId, sessionId, optionButtons.slice(0, 6), botName);
  } else if (hasFlightResults && !hasHotelResults) {
    // Show individual option buttons directly so user can pick right away
    const optionButtons: { label: string; value: string }[] = [];
    for (let i = 0; i < NUM_BADGES_DETECT.length; i++) {
      if (aiReply.includes(NUM_BADGES_DETECT[i])) {
        optionButtons.push({ label: `✈️ Option ${i + 1}`, value: `book_option_${i + 1}` });
      }
    }
    if (optionButtons.length === 0) {
      for (let i = 1; i <= 3; i++) optionButtons.push({ label: `✈️ Option ${i}`, value: `book_option_${i}` });
    }
    // Add utility actions after option buttons
    optionButtons.push({ label: "✈️ More Flights", value: "show_more" });
    optionButtons.push({ label: "📅 Change Dates", value: "change_dates" });
    // Crisp picker max 6 buttons — trim if needed
    await sendPicker(websiteId, sessionId, optionButtons.slice(0, 6), botName);
  } else if (hasHotelResults) {
    const optionButtons: { label: string; value: string }[] = [];
    for (let i = 0; i < NUM_BADGES_DETECT.length; i++) {
      if (aiReply.includes(NUM_BADGES_DETECT[i])) {
        optionButtons.push({ label: `🏨 Hotel ${i + 1}`, value: `book_hotel_${i + 1}` });
      }
    }
    if (optionButtons.length === 0) {
      for (let i = 1; i <= 3; i++) optionButtons.push({ label: `🏨 Hotel ${i}`, value: `book_hotel_${i}` });
    }
    optionButtons.push({ label: "🔍 More Hotels", value: "show_more_hotels" });
    optionButtons.push({ label: "📅 Change Dates", value: "change_dates" });
    await sendPicker(websiteId, sessionId, optionButtons.slice(0, 6), botName);
  }

  await setComposing(websiteId, sessionId, "stop");

  console.log(`[crisp-plugin] Replied to ${sessionId}: ${aiReply.slice(0, 120)}... (status: ${sendResult.status})`);
}
