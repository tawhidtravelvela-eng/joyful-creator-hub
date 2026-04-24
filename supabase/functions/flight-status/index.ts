const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── 15-minute in-memory cache ──
const CACHE_TTL = 15 * 60 * 1000;
const cache = new Map<string, { data: any; expires: number }>();

function getCached(key: string) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) { cache.delete(key); return null; }
  return entry.data;
}

function setCache(key: string, data: any) {
  cache.set(key, { data, expires: Date.now() + CACHE_TTL });
  if (cache.size > 200) {
    const now = Date.now();
    for (const [k, v] of cache) { if (now > v.expires) cache.delete(k); }
  }
}

// ── Helper: extract ICAO callsign from IATA flight number ──
// e.g. BS326 → UBG326 (needs airline ICAO mapping or we get it from other providers)
function buildIcaoCallsign(iataFlight: string, icaoFromProviders: string): string {
  return icaoFromProviders || iataFlight;
}

// ── AeroDataBox provider ──
async function fetchFromAeroDataBox(cleanFlight: string, date: string, rapidApiKey: string) {
  const url = `https://aerodatabox.p.rapidapi.com/flights/number/${cleanFlight}/${date}`;
  console.log(`[flight-status] AeroDataBox GET ${url}`);

  const apiRes = await fetch(url, {
    headers: { "x-rapidapi-host": "aerodatabox.p.rapidapi.com", "x-rapidapi-key": rapidApiKey },
  });

  if (apiRes.status === 429 || apiRes.status === 402 || apiRes.status === 403) {
    const text = await apiRes.text();
    console.warn(`[flight-status] AeroDataBox exhausted (${apiRes.status}): ${text}`);
    return { exhausted: true, flights: [] };
  }

  const responseText = await apiRes.text();

  if (!apiRes.ok) {
    console.error(`[flight-status] AeroDataBox error ${apiRes.status}: ${responseText}`);
    return { error: `AeroDataBox API returned ${apiRes.status}`, flights: [] };
  }

  let flights: any[];
  try { flights = JSON.parse(responseText); } catch {
    return { error: "Invalid AeroDataBox response", flights: [] };
  }

  if (!Array.isArray(flights) || flights.length === 0) {
    return { flights: [], source: "aerodatabox" };
  }

  const parsed = flights.map((f: any) => ({
    flight_number: f.number || cleanFlight,
    callsign: f.callSign || "",
    airline: {
      name: f.airline?.name || "",
      iata: f.airline?.iata || "",
      icao: f.airline?.icao || "",
    },
    status: f.status || "Unknown",
    last_updated_utc: f.lastUpdatedUtc || "",
    departure: {
      airport: f.departure?.airport?.name || "",
      short_name: f.departure?.airport?.shortName || "",
      code: f.departure?.airport?.iata || "",
      icao: f.departure?.airport?.icao || "",
      city: f.departure?.airport?.municipalityName || "",
      country_code: f.departure?.airport?.countryCode || "",
      location: f.departure?.airport?.location || null,
      timezone: f.departure?.airport?.timeZone || "",
      terminal: f.departure?.terminal || "",
      gate: f.departure?.gate || "",
      scheduled_utc: f.departure?.scheduledTime?.utc || "",
      scheduled_local: f.departure?.scheduledTime?.local || "",
      actual_utc: f.departure?.actualTime?.utc || "",
      actual_local: f.departure?.actualTime?.local || "",
      predicted_utc: f.departure?.predictedTime?.utc || "",
      predicted_local: f.departure?.predictedTime?.local || "",
      runway_utc: f.departure?.runwayTime?.utc || "",
      runway_local: f.departure?.runwayTime?.local || "",
      quality: f.departure?.quality || [],
    },
    arrival: {
      airport: f.arrival?.airport?.name || "",
      short_name: f.arrival?.airport?.shortName || "",
      code: f.arrival?.airport?.iata || "",
      icao: f.arrival?.airport?.icao || "",
      city: f.arrival?.airport?.municipalityName || "",
      country_code: f.arrival?.airport?.countryCode || "",
      location: f.arrival?.airport?.location || null,
      timezone: f.arrival?.airport?.timeZone || "",
      terminal: f.arrival?.terminal || "",
      gate: f.arrival?.gate || "",
      baggage_belt: f.arrival?.baggageBelt || "",
      scheduled_utc: f.arrival?.scheduledTime?.utc || "",
      scheduled_local: f.arrival?.scheduledTime?.local || "",
      actual_utc: f.arrival?.actualTime?.utc || "",
      actual_local: f.arrival?.actualTime?.local || "",
      predicted_utc: f.arrival?.predictedTime?.utc || "",
      predicted_local: f.arrival?.predictedTime?.local || "",
      runway_utc: f.arrival?.runwayTime?.utc || "",
      runway_local: f.arrival?.runwayTime?.local || "",
      quality: f.arrival?.quality || [],
    },
    distance: f.greatCircleDistance ? {
      km: f.greatCircleDistance.km,
      miles: f.greatCircleDistance.mile,
      nm: f.greatCircleDistance.nm,
    } : null,
    aircraft: {
      model: f.aircraft?.model || "",
      registration: f.aircraft?.reg || "",
      mode_s: f.aircraft?.modeS || "",
    },
    codeshare_status: f.codeshareStatus || "",
    is_cargo: f.isCargo || false,
  }));

  return { flights: parsed, source: "aerodatabox" };
}

// ── AirLabs provider ──
async function fetchFromAirLabs(cleanFlight: string, _date: string, apiKey: string) {
  const url = `https://airlabs.co/api/v9/flight?flight_iata=${cleanFlight}&api_key=${apiKey}`;
  console.log(`[flight-status] AirLabs GET flight for ${cleanFlight}`);

  const apiRes = await fetch(url);
  const responseText = await apiRes.text();

  if (!apiRes.ok) {
    console.error(`[flight-status] AirLabs error ${apiRes.status}: ${responseText}`);
    return { error: `AirLabs API returned ${apiRes.status}`, flights: [] };
  }

  let body: any;
  try { body = JSON.parse(responseText); } catch {
    return { error: "Invalid AirLabs response", flights: [] };
  }

  if (body.error) {
    console.error(`[flight-status] AirLabs API error:`, body.error);
    return { error: body.error.message || "AirLabs error", flights: [] };
  }

  const resp = body.response;
  const results = Array.isArray(resp) ? resp : (resp && typeof resp === "object" ? [resp] : []);
  if (results.length === 0) {
    return { flights: [], source: "airlabs" };
  }

  const parsed = results.map((f: any) => ({
    flight_number: f.flight_iata || cleanFlight,
    callsign: f.flight_icao || "",
    airline: {
      name: f.airline_iata || "",
      iata: f.airline_iata || "",
      icao: f.airline_icao || "",
    },
    status: f.status || "Unknown",
    last_updated_utc: "",
    departure: {
      airport: f.dep_name || "",
      short_name: f.dep_name || "",
      code: f.dep_iata || "",
      icao: f.dep_icao || "",
      city: f.dep_city || "",
      country_code: "",
      location: null,
      timezone: f.dep_time_zone || "",
      terminal: f.dep_terminal || "",
      gate: f.dep_gate || "",
      scheduled_utc: f.dep_time_utc || "",
      scheduled_local: f.dep_time || "",
      actual_utc: f.dep_actual_utc || "",
      actual_local: f.dep_actual || "",
      predicted_utc: f.dep_estimated_utc || "",
      predicted_local: f.dep_estimated || "",
      runway_utc: "",
      runway_local: "",
      quality: [],
    },
    arrival: {
      airport: f.arr_name || "",
      short_name: f.arr_name || "",
      code: f.arr_iata || "",
      icao: f.arr_icao || "",
      city: f.arr_city || "",
      country_code: "",
      location: null,
      timezone: f.arr_time_zone || "",
      terminal: f.arr_terminal || "",
      gate: f.arr_gate || "",
      baggage_belt: f.arr_baggage || "",
      scheduled_utc: f.arr_time_utc || "",
      scheduled_local: f.arr_time || "",
      actual_utc: f.arr_actual_utc || "",
      actual_local: f.arr_actual || "",
      predicted_utc: f.arr_estimated_utc || "",
      predicted_local: f.arr_estimated || "",
      runway_utc: "",
      runway_local: "",
      quality: [],
    },
    distance: null,
    aircraft: {
      model: "",
      registration: "",
      mode_s: "",
    },
    codeshare_status: f.cs_flight_iata ? "Codeshare" : "IsOperator",
    is_cargo: false,
  }));

  return { flights: parsed, source: "airlabs" };
}

// ── OpenSky Network provider (FREE — no API key needed) ──
// Two endpoints:
//   1. /routes?callsign=X  → route (list of ICAO airport codes)
//   2. /states/all?callsign=X → live position, altitude, velocity, heading

interface OpenSkyData {
  route: { dep_icao: string; arr_icao: string; operator_icao: string } | null;
  live: {
    icao24: string;
    callsign: string;
    origin_country: string;
    longitude: number | null;
    latitude: number | null;
    baro_altitude: number | null;    // meters
    geo_altitude: number | null;     // meters
    velocity: number | null;         // m/s
    true_track: number | null;       // heading in degrees
    vertical_rate: number | null;    // m/s
    on_ground: boolean;
    squawk: string | null;
    last_contact: number;
  } | null;
  error?: string;
}

async function fetchFromOpenSky(callsign: string): Promise<OpenSkyData> {
  const trimmedCallsign = callsign.replace(/\s+/g, "").toUpperCase();
  console.log(`[flight-status] OpenSky querying callsign: ${trimmedCallsign}`);

  const TIMEOUT = 5000; // 5s timeout — OpenSky is best-effort enrichment
  const fetchWithTimeout = (url: string) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT);
    return fetch(url, {
      headers: { "Accept": "application/json" },
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));
  };

  // Query route and states in parallel
  const [routeRes, statesRes] = await Promise.all([
    fetchWithTimeout(`https://opensky-network.org/api/routes?callsign=${trimmedCallsign}`)
      .catch((e) => { console.warn(`[flight-status] OpenSky routes failed: ${e.message}`); return null; }),
    fetchWithTimeout(`https://opensky-network.org/api/states/all?callsign=${trimmedCallsign}`)
      .catch((e) => { console.warn(`[flight-status] OpenSky states failed: ${e.message}`); return null; }),
  ]);

  let route: OpenSkyData["route"] = null;
  let live: OpenSkyData["live"] = null;

  // Parse route
  if (routeRes && routeRes.ok) {
    try {
      const routeBody = await routeRes.json();
      // routeBody.route is an array of ICAO airport codes: ["ZGGG", "VGHS"]
      if (routeBody.route && Array.isArray(routeBody.route) && routeBody.route.length >= 2) {
        route = {
          dep_icao: routeBody.route[0],
          arr_icao: routeBody.route[routeBody.route.length - 1],
          operator_icao: routeBody.operatorIata || routeBody.callsign?.substring(0, 3) || "",
        };
        console.log(`[flight-status] OpenSky route: ${route.dep_icao} → ${route.arr_icao}`);
      }
    } catch (e) {
      console.warn(`[flight-status] OpenSky route parse error: ${(e as Error).message}`);
    }
  } else if (routeRes) {
    const text = await routeRes.text().catch(() => "");
    console.warn(`[flight-status] OpenSky routes status ${routeRes.status}: ${text.substring(0, 200)}`);
  }

  // Parse states (live tracking)
  if (statesRes && statesRes.ok) {
    try {
      const statesBody = await statesRes.json();
      // statesBody.states is array of arrays: [icao24, callsign, origin_country, ...]
      if (statesBody.states && statesBody.states.length > 0) {
        const s = statesBody.states[0]; // first matching state vector
        live = {
          icao24: s[0] || "",
          callsign: (s[1] || "").trim(),
          origin_country: s[2] || "",
          longitude: s[5],
          latitude: s[6],
          baro_altitude: s[7],
          geo_altitude: s[13],
          velocity: s[9],
          true_track: s[10],
          vertical_rate: s[11],
          on_ground: s[8] === true,
          squawk: s[14] || null,
          last_contact: s[4] || 0,
        };
        console.log(`[flight-status] OpenSky live: lat=${live.latitude}, lon=${live.longitude}, alt=${live.baro_altitude}m, speed=${live.velocity}m/s, heading=${live.true_track}°, on_ground=${live.on_ground}`);
      }
    } catch (e) {
      console.warn(`[flight-status] OpenSky states parse error: ${(e as Error).message}`);
    }
  } else if (statesRes) {
    const text = await statesRes.text().catch(() => "");
    console.warn(`[flight-status] OpenSky states status ${statesRes.status}: ${text.substring(0, 200)}`);
  }

  return { route, live };
}

// ── Merge all providers: AeroDataBox + AirLabs + OpenSky ──
function mergeAllProviders(
  adbFlights: any[],
  alFlights: any[],
  openSky: OpenSkyData,
): { flights: any[]; source: string } {
  // Determine base flights (priority: AeroDataBox > AirLabs)
  let baseFlights: any[] = [];
  let routeSource = "none";

  if (adbFlights.length > 0) {
    baseFlights = adbFlights;
    routeSource = "aerodatabox";
  } else if (alFlights.length > 0) {
    baseFlights = alFlights;
    routeSource = "airlabs";
  }

  if (baseFlights.length === 0 && !openSky.live) {
    return { flights: [], source: "none" };
  }

  // If we only have OpenSky data and no flights from other providers,
  // create a minimal flight entry
  if (baseFlights.length === 0 && openSky.live) {
    const minimalFlight: any = {
      flight_number: openSky.live.callsign,
      callsign: openSky.live.callsign,
      airline: { name: "", iata: "", icao: openSky.live.callsign.substring(0, 3) },
      status: openSky.live.on_ground ? "On Ground" : "In Flight",
      departure: { code: openSky.route?.dep_icao || "", icao: openSky.route?.dep_icao || "" },
      arrival: { code: openSky.route?.arr_icao || "", icao: openSky.route?.arr_icao || "" },
      live_tracking: buildLiveTracking(openSky.live),
      _sources: { route: "opensky", realtime: "opensky" },
    };
    return { flights: [minimalFlight], source: "opensky" };
  }

  // Merge data onto base flights
  const sources: string[] = [routeSource];
  const merged = baseFlights.map((base) => {
    const result = { ...base };

    // === Overlay AirLabs real-time data if AeroDataBox is the base ===
    if (routeSource === "aerodatabox" && alFlights.length > 0) {
      const al = alFlights.find((a) => a.flight_number === base.flight_number) || alFlights[0];
      if (al) {
        if (!sources.includes("airlabs")) sources.push("airlabs");
        result.status = al.status && al.status !== "Unknown" ? al.status : result.status;
        result.departure = {
          ...result.departure,
          terminal: al.departure.terminal || result.departure.terminal,
          gate: al.departure.gate || result.departure.gate,
          actual_utc: al.departure.actual_utc || result.departure.actual_utc,
          actual_local: al.departure.actual_local || result.departure.actual_local,
          predicted_utc: al.departure.predicted_utc || result.departure.predicted_utc,
          predicted_local: al.departure.predicted_local || result.departure.predicted_local,
        };
        result.arrival = {
          ...result.arrival,
          terminal: al.arrival.terminal || result.arrival.terminal,
          gate: al.arrival.gate || result.arrival.gate,
          baggage_belt: al.arrival.baggage_belt || result.arrival.baggage_belt,
          actual_utc: al.arrival.actual_utc || result.arrival.actual_utc,
          actual_local: al.arrival.actual_local || result.arrival.actual_local,
          predicted_utc: al.arrival.predicted_utc || result.arrival.predicted_utc,
          predicted_local: al.arrival.predicted_local || result.arrival.predicted_local,
        };

        // Cross-validate route
        const routeMatch = result.departure.code === al.departure.code &&
                           result.arrival.code === al.arrival.code;
        result._route_match_airlabs = routeMatch;
        if (!routeMatch) {
          console.log(`[flight-status] Route mismatch: base=${result.departure.code}→${result.arrival.code}, airlabs=${al.departure.code}→${al.arrival.code}`);
        }
      }
    }

    // === Overlay OpenSky route validation ===
    if (openSky.route) {
      if (!sources.includes("opensky")) sources.push("opensky");
      // OpenSky uses ICAO codes — compare with our ICAO fields
      const depIcao = result.departure.icao || "";
      const arrIcao = result.arrival.icao || "";
      const oskyRouteMatch = depIcao === openSky.route.dep_icao && arrIcao === openSky.route.arr_icao;
      result._route_match_opensky = oskyRouteMatch;
      result._opensky_route = {
        dep_icao: openSky.route.dep_icao,
        arr_icao: openSky.route.arr_icao,
      };
      if (!oskyRouteMatch && depIcao && arrIcao) {
        console.log(`[flight-status] OpenSky route validation: base=${depIcao}→${arrIcao}, opensky=${openSky.route.dep_icao}→${openSky.route.arr_icao}, match=${oskyRouteMatch}`);
      }
    }

    // === Overlay OpenSky live tracking data ===
    if (openSky.live) {
      if (!sources.includes("opensky")) sources.push("opensky");
      result.live_tracking = buildLiveTracking(openSky.live);

      // If flight is in the air but status is still "Expected", update it
      if (!openSky.live.on_ground && result.status === "Expected") {
        result.status = "In Flight";
      }
    }

    result._cross_validated = sources.length > 1;
    result._sources = {
      route: routeSource,
      realtime: alFlights.length > 0 ? "airlabs" : routeSource,
      tracking: openSky.live ? "opensky" : null,
      route_validation: openSky.route ? "opensky" : null,
      providers_used: [...sources],
    };

    return result;
  });

  const sourceLabel = sources.length > 1 ? "cross-validated" : sources[0];
  return { flights: merged, source: sourceLabel };
}

function buildLiveTracking(live: NonNullable<OpenSkyData["live"]>) {
  return {
    latitude: live.latitude,
    longitude: live.longitude,
    altitude_meters: live.baro_altitude,
    altitude_feet: live.baro_altitude != null ? Math.round(live.baro_altitude * 3.28084) : null,
    geo_altitude_meters: live.geo_altitude,
    speed_ms: live.velocity,
    speed_kmh: live.velocity != null ? Math.round(live.velocity * 3.6) : null,
    speed_knots: live.velocity != null ? Math.round(live.velocity * 1.94384) : null,
    heading: live.true_track,
    vertical_rate_ms: live.vertical_rate,
    on_ground: live.on_ground,
    squawk: live.squawk,
    icao24: live.icao24,
    origin_country: live.origin_country,
    last_contact_utc: live.last_contact ? new Date(live.last_contact * 1000).toISOString() : null,
    source: "opensky",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { flight_number, date } = await req.json();

    if (!flight_number || !date) {
      return new Response(JSON.stringify({ success: false, error: "Missing flight_number or date" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleanFlight = flight_number.replace(/\s+/g, "").toUpperCase();
    const cacheKey = `${cleanFlight}_${date}`;

    // Check cache first
    const cached = getCached(cacheKey);
    if (cached) {
      console.log(`[flight-status] Cache hit: ${cacheKey}`);
      return new Response(JSON.stringify({ ...cached, cached: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const airLabsKey = Deno.env.get("AIRLABS_API_KEY");
    const rapidApiKey = Deno.env.get("RAPIDAPI_KEY");

    // ── Strategy: AirLabs + OpenSky first. Only call AeroDataBox if AirLabs fails ──
    // This saves AeroDataBox quota for when it's actually needed.

    // Step 1: AirLabs + OpenSky in parallel (primary)
    const [alResult, openSkyResult] = await Promise.all([
      airLabsKey
        ? fetchFromAirLabs(cleanFlight, date, airLabsKey).catch((e) => {
            console.error("[flight-status] AirLabs fetch failed:", e.message);
            return { flights: [] as any[], error: e.message };
          })
        : Promise.resolve({ flights: [] as any[], error: "No AIRLABS_API_KEY" }),
      fetchFromOpenSky(cleanFlight).catch((e) => {
        console.warn(`[flight-status] OpenSky failed: ${e.message}`);
        return { route: null, live: null, error: e.message } as OpenSkyData;
      }),
    ]);

    // Try OpenSky ICAO retry if reachable but no data
    let openSky = openSkyResult;
    const openSkyReachable = !openSkyResult.error?.includes("timed out") && !openSkyResult.error?.includes("aborted") && !openSkyResult.error?.includes("Connection");
    if (openSkyReachable && !openSky.live && !openSky.route) {
      const icaoCallsign = alResult.flights?.[0]?.callsign || "";
      if (icaoCallsign && icaoCallsign !== cleanFlight) {
        console.log(`[flight-status] Retrying OpenSky with ICAO callsign: ${icaoCallsign}`);
        openSky = await fetchFromOpenSky(icaoCallsign).catch(() => ({ route: null, live: null }));
      }
    }

    // Step 2: Call AeroDataBox if:
    //   A) AirLabs returned no data (primary fallback), OR
    //   B) AirLabs has data but OpenSky failed (use ADB as route validator)
    let adbResult: { flights: any[]; error?: string; exhausted?: boolean } = { flights: [] };
    const airLabsHasData = alResult.flights.length > 0;
    const openSkyFailed = !openSky.route && !openSky.live;

    if (rapidApiKey && (!airLabsHasData || (airLabsHasData && openSkyFailed))) {
      const reason = !airLabsHasData ? "AirLabs empty/failed" : "OpenSky failed, using ADB as validator";
      console.log(`[flight-status] Calling AeroDataBox: ${reason}`);
      adbResult = await fetchFromAeroDataBox(cleanFlight, date, rapidApiKey).catch((e) => {
        console.error("[flight-status] AeroDataBox fetch failed:", e.message);
        return { flights: [] as any[], error: e.message };
      });

      // Also retry OpenSky with ADB callsign if needed
      if (openSkyReachable && !openSky.live && !openSky.route && adbResult.flights?.[0]?.callsign) {
        const adbCallsign = adbResult.flights[0].callsign;
        if (adbCallsign && adbCallsign !== cleanFlight) {
          openSky = await fetchFromOpenSky(adbCallsign).catch(() => ({ route: null, live: null }));
        }
      }
    }

    console.log(`[flight-status] Results — AirLabs: ${alResult.flights.length}, AeroDataBox: ${adbResult.flights.length}, OpenSky: route=${!!openSky.route}, live=${!!openSky.live}`);

    const { flights, source } = mergeAllProviders(adbResult.flights, alResult.flights, openSky);

    let result: any;
    if (flights.length > 0) {
      result = { success: true, flights, count: flights.length, source };
    } else {
      result = { success: true, flights: [], count: 0, message: "No flights found" };
    }

    setCache(cacheKey, result);

    return new Response(JSON.stringify({ ...result, cached: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[flight-status] Error:", e);
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});