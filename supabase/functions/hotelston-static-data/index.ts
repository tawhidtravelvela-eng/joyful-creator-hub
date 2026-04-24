// Hotelston Static Data API v2 — SOAP integration
// Supports: getDestinationList, getHotelList, getHotelDetails, getNationalityList,
//           getBoardTypeList, getHotelFeatureList, getDistanceTypeList

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TEST_ENDPOINT = "https://dev.hotelston.com/ws/StaticDataServiceV2/StaticDataServiceHttpSoap11Endpoint/";
const PROD_ENDPOINT = "https://www.hotelston.com/ws/StaticDataServiceV2/StaticDataServiceHttpSoap11Endpoint/";

function getEndpoint(env: string): string {
  return env === "production" ? PROD_ENDPOINT : TEST_ENDPOINT;
}

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

async function getCredentials(sb: any) {
  const email = Deno.env.get("HOTELSTON_EMAIL");
  const password = Deno.env.get("HOTELSTON_PASSWORD");
  if (!email || !password) throw new Error("Hotelston credentials not configured.");
  const { data } = await sb.from("api_settings").select("settings").eq("provider", "hotelston_hotel").maybeSingle();
  const env = (data?.settings as any)?.environment || "test";
  return { email, password, environment: env };
}

// SOAP helpers
function buildEnvelope(body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:req="http://request.v2.staticdataservice.ws.hotelston.com/xsd"
  xmlns:typ="http://types.v2.staticdataservice.ws.hotelston.com/xsd">
  <soapenv:Header/>
  <soapenv:Body>${body}</soapenv:Body>
</soapenv:Envelope>`;
}

async function callSoap(endpoint: string, soapAction: string, body: string): Promise<string> {
  const envelope = buildEnvelope(body);
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      "SOAPAction": `urn:${soapAction}`,
      "Accept-Encoding": "gzip",
    },
    body: envelope,
  });
  if (!res.ok) {
    const txt = await res.text();
    console.error(`[hotelston-static] ${soapAction} HTTP ${res.status}:`, txt.slice(0, 500));
    throw new Error(`SOAP error: ${res.status}`);
  }
  return await res.text();
}

// XML helpers (namespace-aware)
function extractTag(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<(?:[\\w-]+:)?${tag}[^>]*>([^<]*)</(?:[\\w-]+:)?${tag}>`, "i"));
  return m ? m[1].trim() : "";
}

function extractAttr(xml: string, tag: string, attr: string): string {
  const m = xml.match(new RegExp(`<(?:[\\w-]+:)?${tag}[^>]*\\s(?:[\\w-]+:)?${attr}="([^"]*)"`, "i"));
  return m ? m[1] : "";
}

function extractAllBlocks(xml: string, tag: string): string[] {
  const results: string[] = [];
  const openRe = new RegExp(`<(?:[\\w-]+:)?${tag}[\\s>]`, "gi");
  let m;
  while ((m = openRe.exec(xml)) !== null) {
    const start = m.index;
    const closeRe = new RegExp(`</(?:[\\w-]+:)?${tag}>`, "gi");
    closeRe.lastIndex = start;
    const cm = closeRe.exec(xml);
    if (cm) {
      results.push(xml.substring(start, cm.index + cm[0].length));
      openRe.lastIndex = cm.index + cm[0].length;
    }
  }
  // Self-closing
  const scRe = new RegExp(`<(?:[\\w-]+:)?${tag}\\b[^>]*/\\s*>`, "gi");
  while ((m = scRe.exec(xml)) !== null) {
    if (!results.some(r => r.includes(m![0]))) results.push(m[0]);
  }
  return results;
}

function loginXml(creds: { email: string; password: string }): string {
  return `<typ:loginDetails typ:email="${creds.email}" typ:password="${creds.password}"/>`;
}

// ── Destination List ──
async function getDestinationList(creds: any) {
  const body = `<req:DestinationListRequest>${loginXml(creds)}</req:DestinationListRequest>`;
  const xml = await callSoap(getEndpoint(creds.environment), "getDestinationList", body);

  const success = extractTag(xml, "success");
  if (success !== "true") {
    const errMsg = extractAttr(xml, "error", "message");
    return { success: false, error: errMsg || "Failed to get destinations" };
  }

  // Parse country > city hierarchy
  const countries: any[] = [];
  const countryBlocks = extractAllBlocks(xml, "country");

  for (const cb of countryBlocks) {
    const countryId = extractAttr(cb, "country", "id");
    const countryName = extractAttr(cb, "country", "name");
    const isoCode = extractAttr(cb, "country", "isoCode");
    if (!countryId) continue;

    const cities: any[] = [];
    const cityBlocks = extractAllBlocks(cb, "city");
    for (const cityBlock of cityBlocks) {
      const cityId = extractAttr(cityBlock, "city", "id");
      const cityName = extractAttr(cityBlock, "city", "name");
      if (!cityId) continue;

      // Parse resorts within city
      const resorts: any[] = [];
      const resortBlocks = extractAllBlocks(cityBlock, "resort");
      for (const rb of resortBlocks) {
        resorts.push({
          id: extractAttr(rb, "resort", "id"),
          name: extractAttr(rb, "resort", "name"),
        });
      }

      cities.push({ id: cityId, name: cityName, resorts });
    }

    countries.push({ id: countryId, name: countryName, isoCode, cities });
  }

  return { success: true, countries, count: countries.length };
}

// ── Hotel List ──
async function getHotelList(creds: any, lastUpdate?: string) {
  const lastUpdateXml = lastUpdate ? `<req:lastUpdate>${lastUpdate}</req:lastUpdate>` : "";
  const body = `<req:HotelListRequest>${loginXml(creds)}${lastUpdateXml}</req:HotelListRequest>`;
  const xml = await callSoap(getEndpoint(creds.environment), "getHotelList", body);

  const success = extractTag(xml, "success");
  if (success !== "true") {
    const errMsg = extractAttr(xml, "error", "message");
    return { success: false, error: errMsg || "Failed to get hotel list" };
  }

  // Parse country > city > hotel hierarchy
  const hotels: any[] = [];
  const countryBlocks = extractAllBlocks(xml, "country");

  for (const cb of countryBlocks) {
    const countryName = extractAttr(cb, "country", "name");
    const isoCode = extractAttr(cb, "country", "isoCode");

    const cityBlocks = extractAllBlocks(cb, "city");
    for (const cityBlock of cityBlocks) {
      const cityId = extractAttr(cityBlock, "city", "id");
      const cityName = extractAttr(cityBlock, "city", "name");

      const hotelBlocks = extractAllBlocks(cityBlock, "hotel");
      for (const hb of hotelBlocks) {
        const hotelId = extractAttr(hb, "hotel", "id");
        const hotelName = extractAttr(hb, "hotel", "name");
        const deleted = extractAttr(hb, "hotel", "deleted") === "true";
        if (!hotelId) continue;

        hotels.push({
          id: hotelId,
          name: hotelName,
          cityId,
          cityName,
          countryName,
          countryCode: isoCode,
          deleted,
        });
      }
    }
  }

  return { success: true, hotels, count: hotels.length };
}

// ── Hotel Details ──
async function getHotelDetails(creds: any, hotelId: string) {
  const body = `<req:HotelDetailsRequest>${loginXml(creds)}<req:hotelId>${hotelId}</req:hotelId></req:HotelDetailsRequest>`;
  const xml = await callSoap(getEndpoint(creds.environment), "getHotelDetails", body);

  const success = extractTag(xml, "success");
  if (success !== "true") {
    const errMsg = extractAttr(xml, "error", "message");
    return { success: false, error: errMsg || "Failed to get hotel details" };
  }

  // Parse hotel details
  const hotelBlock = extractAllBlocks(xml, "hotel")[0] || "";
  if (!hotelBlock) return { success: true, hotel: null };

  const hotel: any = {
    id: extractAttr(hotelBlock, "hotel", "id"),
    name: extractAttr(hotelBlock, "hotel", "name"),
    starRating: parseFloat(extractTag(hotelBlock, "starRating") || "0"),
    address: extractTag(hotelBlock, "address") || "",
    phone: extractTag(hotelBlock, "phone") || "",
    email: extractTag(hotelBlock, "email") || "",
    website: extractTag(hotelBlock, "website") || "",
    remark: extractTag(hotelBlock, "remark") || "",
    checkIn: extractTag(hotelBlock, "checkIn") || "",
    checkOut: extractTag(hotelBlock, "checkOut") || "",
  };

  // City
  const cityBlock = extractAllBlocks(hotelBlock, "city")[0];
  if (cityBlock) {
    hotel.city = { id: extractAttr(cityBlock, "city", "id"), name: extractAttr(cityBlock, "city", "name") };
  }

  // Coordinates
  const coordBlock = extractAllBlocks(hotelBlock, "coordinates")[0];
  if (coordBlock) {
    hotel.latitude = parseFloat(extractTag(coordBlock, "latitude") || "0");
    hotel.longitude = parseFloat(extractTag(coordBlock, "longitude") || "0");
  }

  // Images
  const imageBlocks = extractAllBlocks(hotelBlock, "image");
  hotel.images = imageBlocks.map(ib => extractAttr(ib, "image", "url")).filter(Boolean);

  // Features
  const featureBlocks = extractAllBlocks(hotelBlock, "feature");
  hotel.features = featureBlocks.map(fb => ({
    id: extractAttr(fb, "feature", "id"),
    name: extractAttr(fb, "feature", "name"),
  }));

  // Descriptions
  const descBlocks = extractAllBlocks(hotelBlock, "description");
  hotel.descriptions = descBlocks.map(db => {
    const lang = extractAttr(db, "description", "lang");
    const text = db.replace(/<[^>]+>/g, "").trim();
    return { lang, text };
  });

  // Customer rating
  const ratingBlock = extractAllBlocks(hotelBlock, "customerRating")[0];
  if (ratingBlock) {
    hotel.customerRating = {
      overall: parseFloat(extractAttr(ratingBlock, "customerRating", "overall") || "0"),
      customerCount: parseInt(extractAttr(ratingBlock, "customerRating", "customerCount") || "0"),
    };
  }

  return { success: true, hotel };
}

// ── Nationality List ──
async function getNationalityList(creds: any) {
  const body = `<req:NationalityListRequest>${loginXml(creds)}</req:NationalityListRequest>`;
  const xml = await callSoap(getEndpoint(creds.environment), "getNationalityList", body);

  const success = extractTag(xml, "success");
  if (success !== "true") {
    const errMsg = extractAttr(xml, "error", "message");
    return { success: false, error: errMsg || "Failed to get nationalities" };
  }

  const nationalityBlocks = extractAllBlocks(xml, "nationality");
  const nationalities = nationalityBlocks.map(nb => ({
    code: extractAttr(nb, "nationality", "code"),
    name: extractAttr(nb, "nationality", "name"),
  })).filter(n => n.code);

  return { success: true, nationalities, count: nationalities.length };
}

// ── Board Type List ──
async function getBoardTypeList(creds: any) {
  const body = `<req:BoardTypeListRequest>${loginXml(creds)}</req:BoardTypeListRequest>`;
  const xml = await callSoap(getEndpoint(creds.environment), "getBoardTypeList", body);

  const success = extractTag(xml, "success");
  if (success !== "true") {
    const errMsg = extractAttr(xml, "error", "message");
    return { success: false, error: errMsg || "Failed to get board types" };
  }

  const groupBlocks = extractAllBlocks(xml, "boardTypeGroup");
  const groups = groupBlocks.map(gb => {
    const btBlocks = extractAllBlocks(gb, "boardType");
    return {
      id: extractAttr(gb, "boardTypeGroup", "id"),
      name: extractAttr(gb, "boardTypeGroup", "name"),
      boardTypes: btBlocks.map(bt => ({
        id: extractAttr(bt, "boardType", "id"),
        name: extractAttr(bt, "boardType", "name"),
      })),
    };
  });

  return { success: true, boardTypeGroups: groups };
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
    const action = body.action || "destinations";
    const sb = getSupabaseAdmin();
    const creds = await getCredentials(sb);
    console.log(`[hotelston-static] action=${action}, env=${creds.environment}`);

    switch (action) {
      case "destinations":
        return jsonResponse(await getDestinationList(creds));
      case "hotelList":
        return jsonResponse(await getHotelList(creds, body.lastUpdate));
      case "hotelDetails":
        if (!body.hotelId) return jsonResponse({ success: false, error: "hotelId required" }, 400);
        return jsonResponse(await getHotelDetails(creds, body.hotelId));
      case "nationalities":
        return jsonResponse(await getNationalityList(creds));
      case "boardTypes":
        return jsonResponse(await getBoardTypeList(creds));
      default:
        return jsonResponse({ success: false, error: `Unknown action: ${action}` }, 400);
    }
  } catch (e) {
    console.error("[hotelston-static] error:", e);
    return jsonResponse({ success: false, error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
