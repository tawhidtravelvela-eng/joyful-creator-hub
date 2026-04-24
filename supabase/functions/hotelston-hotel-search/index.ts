// Hotelston Hotel API v2 — SOAP integration
// Supports: search (by destination/hotel IDs), checkAvailability, bookHotel, cancelHotelBooking

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TEST_ENDPOINT = "https://dev.hotelston.com/ws/HotelServiceV2/HotelServiceHttpSoap11Endpoint/";
const PROD_ENDPOINT = "https://www.hotelston.com/ws/HotelServiceV2/HotelServiceHttpSoap11Endpoint/";

function getEndpoint(env: string): string {
  return env === "production" ? PROD_ENDPOINT : TEST_ENDPOINT;
}

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

// Load Hotelston credentials from Supabase secrets or api_settings
async function getCredentials(sb: any): Promise<{ email: string; password: string; profile: string; environment: string }> {
  // First try Supabase secrets
  const email = Deno.env.get("HOTELSTON_EMAIL");
  const password = Deno.env.get("HOTELSTON_PASSWORD");
  const profile = Deno.env.get("HOTELSTON_PROFILE") || "0";

  if (email && password) {
    // Check environment from api_settings
    const { data } = await sb
      .from("api_settings")
      .select("settings")
      .eq("provider", "hotelston_hotel")
      .maybeSingle();
    const env = (data?.settings as any)?.environment || "test";
    return { email, password, profile, environment: env };
  }

  throw new Error("Hotelston credentials not configured. Set HOTELSTON_EMAIL and HOTELSTON_PASSWORD secrets.");
}

// Build SOAP envelope
function buildSoapEnvelope(action: string, body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:req="http://request.v2.hotelservice.ws.hotelston.com/xsd" xmlns:typ="http://types.v2.hotelservice.ws.hotelston.com/xsd">
  <soapenv:Header/>
  <soapenv:Body>
    ${body}
  </soapenv:Body>
</soapenv:Envelope>`;
}

// Call Hotelston SOAP API
async function callSoap(endpoint: string, soapAction: string, soapBody: string): Promise<string> {
  const envelope = buildSoapEnvelope(soapAction, soapBody);

  

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      "SOAPAction": `urn:${soapAction}`,
      "Accept-Encoding": "gzip",
    },
    body: envelope,
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`[hotelston] SOAP ${soapAction} HTTP ${response.status}:`, text.slice(0, 500));
    throw new Error(`Hotelston SOAP error: ${response.status}`);
  }

  return await response.text();
}

// Simple XML value extractor — handles namespace prefixes (e.g. xsd1:success)
function extractTag(xml: string, tag: string): string {
  const regex = new RegExp(`<(?:[\\w-]+:)?${tag}[^>]*>([^<]*)</(?:[\\w-]+:)?${tag}>`, "i");
  const match = xml.match(regex);
  return match ? match[1].trim() : "";
}

function extractAttr(xml: string, tag: string, attr: string): string {
  const regex = new RegExp(`<(?:[\\w-]+:)?${tag}[^>]*\\s(?:[\\w-]+:)?${attr}="([^"]*)"`, "i");
  const match = xml.match(regex);
  return match ? match[1] : "";
}

function extractAllBlocks(xml: string, tag: string): string[] {
  const results: string[] = [];
  // Match both prefixed and unprefixed: <tag or <ns:tag
  const openRegex = new RegExp(`<(?:[\\w-]+:)?${tag}[\\s>]`, "gi");
  let m;
  while ((m = openRegex.exec(xml)) !== null) {
    const start = m.index;
    // Find matching close tag (prefixed or not)
    const closeRegex = new RegExp(`</(?:[\\w-]+:)?${tag}>`, "gi");
    closeRegex.lastIndex = start;
    const cm = closeRegex.exec(xml);
    if (cm) {
      results.push(xml.substring(start, cm.index + cm[0].length));
      openRegex.lastIndex = cm.index + cm[0].length;
    }
  }
  // Also handle self-closing tags
  const selfClosingRegex = new RegExp(`<(?:[\\w-]+:)?${tag}\\b[^>]*/\\s*>`, "gi");
  while ((m = selfClosingRegex.exec(xml)) !== null) {
    if (!results.some(r => r.includes(m![0]))) {
      results.push(m[0]);
    }
  }
  return results;
}

// ── Fetch hotel images from Static Data API ──

async function fetchHotelDetailsImages(hotelId: string, creds: { email: string; password: string; environment: string }): Promise<string[]> {
  try {
    const staticEndpoint = creds.environment === "production"
      ? "https://www.hotelston.com/ws/StaticDataServiceV2/StaticDataServiceHttpSoap11Endpoint/"
      : "https://dev.hotelston.com/ws/StaticDataServiceV2/StaticDataServiceHttpSoap11Endpoint/";

    const envelope = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:req="http://request.v2.staticdataservice.ws.hotelston.com/xsd"
  xmlns:typ="http://types.v2.staticdataservice.ws.hotelston.com/xsd">
  <soapenv:Header/>
  <soapenv:Body>
    <req:HotelDetailsRequest>
      <typ:loginDetails typ:email="${creds.email}" typ:password="${creds.password}"/>
      <req:hotelId>${hotelId}</req:hotelId>
    </req:HotelDetailsRequest>
  </soapenv:Body>
</soapenv:Envelope>`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(staticEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        "SOAPAction": "urn:getHotelDetails",
        "Accept-Encoding": "gzip",
      },
      body: envelope,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) return [];

    const xml = await res.text();
    const imageBlocks = extractAllBlocks(xml, "image");
    const images = imageBlocks
      .map(ib => extractAttr(ib, "image", "url"))
      .filter(Boolean)
      .map(url => url.replace(/^http:\/\//i, "https://"));
    return images;
  } catch (e) {
    console.error(`[hotelston] fetchHotelDetailsImages(${hotelId}) error:`, e);
    return [];
  }
}

// In-memory image cache to avoid re-fetching across warm invocations
const imageCache = new Map<string, string[]>();

async function enrichHotelsWithImages(hotels: any[], creds: { email: string; password: string; environment: string }) {
  // Only enrich top 5 hotels to keep search fast (~2-3s instead of ~10s)
  const MAX_IMAGE_FETCH = 5;
  const CONCURRENCY = 3;
  const hotelsToEnrich = hotels.slice(0, MAX_IMAGE_FETCH);

  for (let i = 0; i < hotelsToEnrich.length; i += CONCURRENCY) {
    const batch = hotelsToEnrich.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(async (hotel) => {
      const rawId = hotel.hotelstonId || hotel.id?.replace("hotelston-", "");
      if (!rawId) return;

      if (imageCache.has(rawId)) {
        const cached = imageCache.get(rawId)!;
        if (cached.length > 0) {
          hotel.image = cached[0];
          hotel.images = cached;
        }
        return;
      }

      const images = await fetchHotelDetailsImages(rawId, creds);
      imageCache.set(rawId, images);
      if (images.length > 0) {
        hotel.image = images[0];
        hotel.images = images;
      }
    }));
  }
  console.log(`[hotelston] enriched ${hotelsToEnrich.length} hotels with images`);
}

// ── In-memory destination cache (persists across warm invocations) ──
let destinationCache: Map<string, string> | null = null;
let cacheLoadingPromise: Promise<Map<string, string>> | null = null;

async function loadDestinationCache(creds: { email: string; password: string; environment: string }): Promise<Map<string, string>> {
  if (destinationCache) return destinationCache;
  if (cacheLoadingPromise) return cacheLoadingPromise;

  cacheLoadingPromise = (async () => {
    const map = new Map<string, string>();
    try {
      const staticEndpoint = creds.environment === "production"
        ? "https://www.hotelston.com/ws/StaticDataServiceV2/StaticDataServiceHttpSoap11Endpoint/"
        : "https://dev.hotelston.com/ws/StaticDataServiceV2/StaticDataServiceHttpSoap11Endpoint/";

      const envelope = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:req="http://request.v2.staticdataservice.ws.hotelston.com/xsd"
  xmlns:typ="http://types.v2.staticdataservice.ws.hotelston.com/xsd">
  <soapenv:Header/>
  <soapenv:Body>
    <req:DestinationListRequest>
      <typ:loginDetails typ:email="${creds.email}" typ:password="${creds.password}"/>
    </req:DestinationListRequest>
  </soapenv:Body>
</soapenv:Envelope>`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const res = await fetch(staticEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          "SOAPAction": "urn:getDestinationList",
          "Accept-Encoding": "gzip",
        },
        body: envelope,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        console.error("[hotelston] destination list HTTP", res.status);
        return map;
      }

      const xml = await res.text();
      
      let cityBlocks = extractAllBlocks(xml, "city");
      if (cityBlocks.length === 0) {
        cityBlocks = extractAllBlocks(xml, "destination");
      }
      for (const cb of cityBlocks) {
        const name = extractAttr(cb, "city", "name") || extractAttr(cb, "destination", "name");
        const id = extractAttr(cb, "city", "id") || extractAttr(cb, "destination", "id");
        if (name && id) {
          map.set(name.toLowerCase().trim(), id);
        }
      }
      console.log(`[hotelston] cached ${map.size} destination cities`);
    } catch (e) {
      console.error("[hotelston] loadDestinationCache error:", e);
    }

    destinationCache = map;
    cacheLoadingPromise = null;
    return map;
  })();

  return cacheLoadingPromise;
}

// Resolve city with a hard timeout — returns null if cache isn't ready in time
async function resolveCityToDestinationIdFast(
  cityName: string,
  creds: { email: string; password: string; environment: string },
  timeoutMs = 5000
): Promise<string | null> {
  try {
    const result = await Promise.race([
      resolveCityToDestinationId(cityName, creds),
      new Promise<null>(resolve => setTimeout(() => resolve(null), timeoutMs)),
    ]);
    if (!result) {
      console.warn(`[hotelston] city resolution timed out after ${timeoutMs}ms for "${cityName}" (cold cache)`);
    }
    return result;
  } catch {
    return null;
  }
}

// City name aliases — maps common/colloquial names to Hotelston's actual destination names
const CITY_ALIASES: Record<string, string> = {
  "penang": "george town",
  "langkawi": "langkawi",
  "bali": "denpasar",
  "phuket": "phuket",
  "maldives": "male",
  "cox's bazar": "cox's bazar",
  "ko samui": "koh samui",
  "koh samui": "koh samui",
  "mumbai": "mumbai",
  "bombay": "mumbai",
  "calcutta": "kolkata",
  "madras": "chennai",
  "peking": "beijing",
  "saigon": "ho chi minh city",
  "ho chi minh": "ho chi minh city",
};

async function resolveCityToDestinationId(cityName: string, creds: { email: string; password: string; environment: string }): Promise<string | null> {
  const cache = await loadDestinationCache(creds);
  let needle = cityName.toLowerCase().trim();

  // Apply alias mapping before lookup
  if (CITY_ALIASES[needle]) {
    const alias = CITY_ALIASES[needle];
    console.log(`[hotelston] alias "${cityName}" -> "${alias}"`);
    needle = alias;
  }

  // Exact match
  if (cache.has(needle)) {
    const id = cache.get(needle)!;
    console.log(`[hotelston] resolved "${cityName}" -> destinationId=${id}`);
    return id;
  }

  // Partial match — require minimum 4 chars overlap and prefer longer matches
  let bestMatch: { name: string; id: string; score: number } | null = null;

  for (const [name, id] of cache) {
    // Skip tiny names that cause false positives (e.g. "gap" matching "singapore")
    if (name.length < 4 && !needle.startsWith(name)) continue;

    if (name.includes(needle) || needle.includes(name)) {
      // Score by how close the match is (longer overlap = better)
      const overlap = Math.min(name.length, needle.length);
      const score = overlap / Math.max(name.length, needle.length);
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = { name, id, score };
      }
    }
  }

  if (bestMatch && bestMatch.score >= 0.5) {
    console.log(`[hotelston] partial match "${cityName}" -> "${bestMatch.name}" destinationId=${bestMatch.id} (score=${bestMatch.score.toFixed(2)})`);
    return bestMatch.id;
  }

  console.warn(`[hotelston] no destination found for "${cityName}" (cache size: ${cache.size})`);
  return null;
}

// ── Search Hotels ──
interface SearchRequest {
  checkIn: string;
  checkOut: string;
  cityName?: string;
  destinationId?: string;
  hotelIds?: number[];
  adults?: number;
  children?: number;
  childAges?: number[];
  rooms?: number;
  clientNationality?: string;
}

// Build per-room XML elements for multi-room support (spec: multiple <room> elements with sequential seqNo)
function buildRoomXml(adults: number, children: number, childAges: number[], rooms: number): string {
  if (rooms <= 1) {
    const childAgesXml = childAges.map(age => `<typ:childAge>${age}</typ:childAge>`).join("");
    return `<typ:room typ:adults="${adults}" typ:children="${children}" typ:seqNo="0">${childAgesXml}</typ:room>`;
  }
  // Distribute adults/children across rooms
  const roomElements: string[] = [];
  const baseAdultsPerRoom = Math.floor(adults / rooms);
  let extraAdults = adults % rooms;
  let childIdx = 0;
  const childrenPerRoom = Math.floor(children / rooms);
  let extraChildren = children % rooms;

  for (let i = 0; i < rooms; i++) {
    const roomAdults = baseAdultsPerRoom + (extraAdults > 0 ? 1 : 0);
    if (extraAdults > 0) extraAdults--;
    const roomChildren = childrenPerRoom + (extraChildren > 0 ? 1 : 0);
    if (extraChildren > 0) extraChildren--;
    const roomChildAges = childAges.slice(childIdx, childIdx + roomChildren);
    childIdx += roomChildren;
    const childAgesXml = roomChildAges.map(age => `<typ:childAge>${age}</typ:childAge>`).join("");
    roomElements.push(`<typ:room typ:adults="${Math.max(roomAdults, 1)}" typ:children="${roomChildren}" typ:seqNo="${i}">${childAgesXml}</typ:room>`);
  }
  return roomElements.join("\n      ");
}

async function searchHotels(params: SearchRequest & { skipImages?: boolean }, creds: { email: string; password: string; profile: string; environment: string }) {
  let {
    checkIn, checkOut, destinationId, hotelIds, cityName,
    adults = 2, children = 0, childAges = [], rooms = 1, clientNationality = "BD",
    skipImages = false,
  } = params;

  // Auto-resolve cityName → destinationId with fast timeout first, then fallback to blocking resolution
  if (!destinationId && !hotelIds?.length && cityName) {
    const fastTimeoutMs = skipImages ? 8000 : 5000;
    let resolved = await resolveCityToDestinationIdFast(cityName, creds, fastTimeoutMs);

    if (!resolved) {
      console.warn(`[hotelston] fast city resolution missed for "${cityName}", retrying with blocking lookup`);
      resolved = await resolveCityToDestinationId(cityName, creds);
    }

    if (resolved) {
      destinationId = resolved;
    } else {
      return { success: false, error: `Could not resolve "${cityName}"`, hotels: [] };
    }
  }

  let hotelSelectorXml = "";
  if (hotelIds && hotelIds.length > 0) {
    // Spec: max 3000 hotel IDs per request
    const cappedIds = hotelIds.slice(0, 3000);
    const idsXml = cappedIds.map(id => `<typ:hotelId>${id}</typ:hotelId>`).join("");
    hotelSelectorXml = `<typ:hotelSelector><typ:hotelIds>${idsXml}</typ:hotelIds></typ:hotelSelector>`;
  } else if (destinationId) {
    hotelSelectorXml = `<typ:hotelSelector><typ:destinationId>${destinationId}</typ:destinationId></typ:hotelSelector>`;
  } else {
    throw new Error("Either destinationId, hotelIds, or cityName is required for Hotelston search");
  }

  // Build room elements (supports multi-room per v2 spec)
  const roomXml = buildRoomXml(adults, children, childAges, rooms);

  const soapBody = `<req:SearchHotelsRequest>
    <typ:customerSessionId>${Date.now()}</typ:customerSessionId>
    <typ:loginDetails typ:email="${creds.email}" typ:password="${creds.password}" typ:profile="${creds.profile}"/>
    <req:criteria>
      <typ:checkIn>${checkIn}</typ:checkIn>
      <typ:checkOut>${checkOut}</typ:checkOut>
      <typ:clientNationality>${clientNationality}</typ:clientNationality>
      ${hotelSelectorXml}
      ${roomXml}
    </req:criteria>
  </req:SearchHotelsRequest>`;

  const endpoint = getEndpoint(creds.environment);
  const responseXml = await callSoap(endpoint, "searchHotels", soapBody);

  // Log raw response for debugging
  console.log("[hotelston] search response length:", responseXml.length, "first 2000:", responseXml.substring(0, 2000));

  // Check success
  const success = extractTag(responseXml, "success");
  if (success !== "true") {
    const errMsg = extractAttr(responseXml, "error", "message") || extractTag(responseXml, "faultstring");
    console.error("[hotelston] search error:", errMsg, "| success tag value:", success);
    return { success: false, error: errMsg || "Search failed", hotels: [] };
  }

  // Parse hotels from response
  const hotels = parseHotelsFromXml(responseXml);

  // Only enrich with images if not skipped (skip during unified search for speed)
  if (!skipImages) {
    await enrichHotelsWithImages(hotels, creds);
  }

  return { success: true, hotels, count: hotels.length };
}

function parseHotelsFromXml(xml: string): any[] {
  const hotelBlocks = extractAllBlocks(xml, "hotel");
  const hotels: any[] = [];

  for (const block of hotelBlocks) {
    const hotelId = extractAttr(block, "hotel", "id");
    const hotelName = extractAttr(block, "hotel", "name");
    if (!hotelId || !hotelName) continue;

    // Extract star rating (from hotel details or search enrichment)
    const starRating = parseFloat(extractAttr(block, "hotel", "starRating") || "0");

    // Extract city info if available (from checkAvailability/booking responses)
    const cityBlock = extractAllBlocks(block, "city")[0];
    const hotelCity = cityBlock ? extractAttr(cityBlock, "city", "name") : "";

    // Parse rooms from channels
    const roomBlocks = extractAllBlocks(block, "room");
    const rooms: any[] = [];

    for (const roomBlock of roomBlocks) {
      const roomId = extractAttr(roomBlock, "room", "id");
      const price = parseFloat(extractAttr(roomBlock, "room", "price") || "0");
      const originalPrice = parseFloat(extractAttr(roomBlock, "room", "originalPrice") || String(price));
      const specialOffer = extractAttr(roomBlock, "room", "specialOffer") === "true";
      const seqNo = extractAttr(roomBlock, "room", "seqNo");

      // Board type
      const boardTypeId = extractAttr(roomBlock, "boardType", "id");
      const boardTypeName = extractAttr(roomBlock, "boardType", "name");
      const boardTypeGroupName = extractAttr(roomBlock, "boardType", "groupName");
      const boardTypeGroupId = extractAttr(roomBlock, "boardType", "groupId");

      // Room type
      const roomTypeId = extractAttr(roomBlock, "roomType", "id");
      const roomTypeName = extractAttr(roomBlock, "roomType", "name");
      const roomTypeHotelstonName = extractAttr(roomBlock, "roomType", "hotelstonName");

      // Cancellation — parse full policy with rules per v2 spec
      const cxlDate = extractAttr(roomBlock, "cancellationPolicy", "cxlDate");
      const cxlType = extractAttr(roomBlock, "cancellationPolicy", "type");
      const cxlRuleBlocks = extractAllBlocks(roomBlock, "cancellationRule");
      const cancellationRules = cxlRuleBlocks.map(rb => ({
        deadline: extractAttr(rb, "cancellationRule", "deadline"),
        penaltyPercent: parseFloat(extractAttr(rb, "cancellationRule", "penaltyPercent") || "0"),
      })).filter(r => r.deadline);

      // Special offers (v2: specificSpecialOffer)
      const specialOfferBlocks = extractAllBlocks(roomBlock, "specificSpecialOffer");
      const specialOffers = specialOfferBlocks.map(so => ({
        id: extractAttr(so, "specificSpecialOffer", "id"),
        name: extractAttr(so, "specificSpecialOffer", "name"),
        details: extractAttr(so, "specificSpecialOffer", "details"),
      })).filter(so => so.id);

      rooms.push({
        roomId,
        price,
        originalPrice,
        specialOffer,
        seqNo,
        boardTypeId,
        boardTypeName: boardTypeGroupName || boardTypeName,
        boardTypeGroupId,
        roomTypeId,
        roomTypeName,
        roomTypeHotelstonName: roomTypeHotelstonName || "",
        cancellationDate: cxlDate,
        cancellationType: cxlType,
        cancellationRules,
        refundable: cxlType !== "NON_REFUNDABLE",
        specialOffers,
        source: "hotelston",
      });
    }

    if (rooms.length > 0) {
      const lowestPrice = Math.min(...rooms.map(r => r.price));
      hotels.push({
        id: `hotelston-${hotelId}`,
        hotelstonId: hotelId,
        name: hotelName,
        price: lowestPrice,
        currency: "EUR",
        stars: starRating,
        city: hotelCity,
        rooms,
        mealBasis: rooms[0]?.boardTypeName || "",
        source: "hotelston",
      });
    }
  }

  return hotels;
}

// ── Check Availability ──
interface CheckAvailabilityRequest {
  checkIn: string;
  checkOut: string;
  hotelId: string;
  rooms: {
    roomId: string;
    roomTypeId: string;
    boardTypeId: string;
    adults: number;
    children: number;
    childAges?: number[];
    seqNo: number;
  }[];
  clientNationality?: string;
}

async function checkAvailability(params: CheckAvailabilityRequest, creds: any) {
  const { checkIn, checkOut, hotelId, rooms, clientNationality = "BD" } = params;

  const roomsXml = rooms.map(r => {
    const childAgesXml = (r.childAges || []).map(age => `<typ:childAge>${age}</typ:childAge>`).join("");
    return `<typ:room typ:adults="${r.adults}" typ:children="${r.children}" typ:seqNo="${r.seqNo}">
      ${childAgesXml}
      <typ:roomId>${r.roomId}</typ:roomId>
      <typ:boardTypeId>${r.boardTypeId}</typ:boardTypeId>
      <typ:roomTypeId>${r.roomTypeId}</typ:roomTypeId>
    </typ:room>`;
  }).join("");

  const soapBody = `<req:CheckAvailabilityRequest>
    <typ:customerSessionId>${Date.now()}</typ:customerSessionId>
    <typ:loginDetails typ:email="${creds.email}" typ:password="${creds.password}" typ:profile="${creds.profile}"/>
    <req:criteria>
      <typ:checkIn>${checkIn}</typ:checkIn>
      <typ:checkOut>${checkOut}</typ:checkOut>
      <typ:clientNationality>${clientNationality}</typ:clientNationality>
      <typ:hotelId>${hotelId}</typ:hotelId>
      ${roomsXml}
    </req:criteria>
  </req:CheckAvailabilityRequest>`;

  const endpoint = getEndpoint(creds.environment);
  const responseXml = await callSoap(endpoint, "checkAvailability", soapBody);

  const success = extractTag(responseXml, "success");
  if (success !== "true") {
    const errMsg = extractAttr(responseXml, "error", "message");
    return { success: false, error: errMsg || "Availability check failed" };
  }

  // Parse updated rooms with booking terms
  const hotels = parseHotelsFromXml(responseXml);
  const hotel = hotels[0];

  // Extract booking remarks
  const bookingRemarks = extractTag(responseXml, "bookingRemarks");

  return {
    success: true,
    available: !!hotel,
    hotel: hotel || null,
    bookingRemarks,
  };
}

// ── Book Hotel ──
interface BookHotelRequest {
  hotelId: string;
  checkIn: string;
  checkOut: string;
  agentReference: string;
  clientNationality?: string;
  testBooking?: boolean;
  contactPerson: {
    title: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  rooms: {
    roomId: string;
    roomTypeId: string;
    boardTypeId: string;
    price: number;
    seqNo: number;
    adults: { title: string; firstName: string; lastName: string }[];
    children?: { firstName: string; lastName: string; age: number }[];
  }[];
  specialRequests?: { id: string; value: string }[];
}

async function bookHotel(params: BookHotelRequest, creds: any) {
  const {
    hotelId, checkIn, checkOut, agentReference,
    clientNationality = "BD", testBooking = true,
    contactPerson, rooms, specialRequests = [],
  } = params;

  const roomsXml = rooms.map(r => {
    const adultsXml = r.adults.map(a =>
      `<typ:adult typ:title="${a.title}" typ:firstname="${a.firstName}" typ:lastname="${a.lastName}"/>`
    ).join("");
    const childrenXml = (r.children || []).map(c =>
      `<typ:child typ:firstname="${c.firstName}" typ:lastname="${c.lastName}" typ:age="${c.age}"/>`
    ).join("");

    return `<typ:room seqNo="${r.seqNo}">
      <typ:roomId>${r.roomId}</typ:roomId>
      <typ:roomTypeId>${r.roomTypeId}</typ:roomTypeId>
      <typ:boardTypeId>${r.boardTypeId}</typ:boardTypeId>
      <typ:price>${r.price}</typ:price>
      ${adultsXml}
      ${childrenXml}
    </typ:room>`;
  }).join("");

  const specialRequestsXml = specialRequests.map(sr =>
    `<typ:specialRequest typ:id="${sr.id}" typ:value="${sr.value}"/>`
  ).join("");

  const soapBody = `<req:BookHotelRequest>
    <typ:customerSessionId>${Date.now()}</typ:customerSessionId>
    <typ:loginDetails typ:email="${creds.email}" typ:password="${creds.password}" typ:profile="${creds.profile}"/>
    <typ:currency>EUR</typ:currency>
    <typ:hotelId>${hotelId}</typ:hotelId>
    <typ:checkIn>${checkIn}</typ:checkIn>
    <typ:checkOut>${checkOut}</typ:checkOut>
    <typ:agentReferenceNumber>${agentReference}</typ:agentReferenceNumber>
    <typ:testBooking>${testBooking}</typ:testBooking>
    <typ:clientNationality>${clientNationality}</typ:clientNationality>
    <typ:contactPerson typ:title="${contactPerson.title}" typ:firstname="${contactPerson.firstName}" typ:lastname="${contactPerson.lastName}" typ:email="${contactPerson.email}" typ:phone="${contactPerson.phone}"/>
    ${roomsXml}
    ${specialRequestsXml}
  </req:BookHotelRequest>`;

  const endpoint = getEndpoint(creds.environment);
  const responseXml = await callSoap(endpoint, "bookHotel", soapBody);

  const success = extractTag(responseXml, "success");
  if (success !== "true") {
    const errMsg = extractAttr(responseXml, "error", "message");
    const errCode = extractAttr(responseXml, "error", "code");
    return { success: false, error: errMsg || "Booking failed", errorCode: errCode };
  }

  const status = extractTag(responseXml, "status");
  const bookingReference = extractAttr(responseXml, "bookingDetails", "bookingReference") ||
    extractTag(responseXml, "bookingReference");
  const totalPrice = extractTag(responseXml, "price") || extractAttr(responseXml, "bookingDetails", "price");
  const cxlDate = extractTag(responseXml, "cxlDate") || extractAttr(responseXml, "bookingDetails", "cxlDate");

  return {
    success: true,
    status, // CONFIRMED, PRICE_CHANGED, CONFIRMATION_PENDING
    bookingReference,
    totalPrice: parseFloat(totalPrice) || 0,
    currency: "EUR",
    cancellationDate: cxlDate,
  };
}

// ── Cancel Booking ──
async function cancelHotelBooking(bookingReference: string, creds: any) {
  const soapBody = `<req:CancelHotelBookingRequest>
    <typ:customerSessionId>${Date.now()}</typ:customerSessionId>
    <typ:loginDetails typ:email="${creds.email}" typ:password="${creds.password}" typ:profile="${creds.profile}"/>
    <typ:bookingReference>${bookingReference}</typ:bookingReference>
  </req:CancelHotelBookingRequest>`;

  const endpoint = getEndpoint(creds.environment);
  const responseXml = await callSoap(endpoint, "cancelHotelBooking", soapBody);

  const success = extractTag(responseXml, "success");
  if (success !== "true") {
    const errMsg = extractAttr(responseXml, "error", "message");
    return { success: false, error: errMsg || "Cancellation failed" };
  }

  return { success: true, cancelled: true };
}

// ── Main handler ──
function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const action = body.action || "search";
    const sb = getSupabaseAdmin();

    // Test action
    if (body.test || action === "test") {
      try {
        const creds = await getCredentials(sb);
        // Just verify we can reach the endpoint
        const endpoint = getEndpoint(creds.environment);
        const testResp = await fetch(endpoint, { method: "GET" });
        return jsonResponse({
          success: true,
          message: `Hotelston ${creds.environment} endpoint reachable (HTTP ${testResp.status})`,
          environment: creds.environment,
        });
      } catch (e: any) {
        return jsonResponse({ success: false, error: e.message });
      }
    }

    const creds = await getCredentials(sb);
    console.log(`[hotelston] action=${action}, env=${creds.environment}`);

    if (action === "search") {
      const result = await searchHotels({
        checkIn: body.checkIn || body.checkinDate,
        checkOut: body.checkOut || body.checkoutDate,
        cityName: body.cityName,
        destinationId: body.destinationId,
        hotelIds: body.hotelIds,
        adults: body.adults || 2,
        children: body.children || 0,
        childAges: body.childAges || [],
        rooms: body.rooms || 1,
        clientNationality: body.clientNationality || "BD",
        skipImages: body.skipImages || false,
      }, creds);
      return jsonResponse(result);
    }

    if (action === "checkAvailability") {
      const result = await checkAvailability(body, creds);
      return jsonResponse(result);
    }

    if (action === "book") {
      const result = await bookHotel(body, creds);
      return jsonResponse(result);
    }

    if (action === "cancel") {
      const result = await cancelHotelBooking(body.bookingReference, creds);
      return jsonResponse(result);
    }

    return jsonResponse({ success: false, error: `Unknown action: ${action}` }, 400);

  } catch (e) {
    console.error("[hotelston] error:", e);
    return jsonResponse({ success: false, error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
