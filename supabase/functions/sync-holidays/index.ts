import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ISO 3166-1 alpha-2 codes for all 230+ countries Calendarific supports
const ALL_COUNTRIES = [
  "AF","AL","DZ","AS","AD","AO","AG","AR","AM","AU","AT","AZ","BS","BH","BD",
  "BB","BY","BE","BZ","BJ","BM","BT","BO","BA","BW","BR","BN","BG","BF","BI",
  "KH","CM","CA","CV","CF","TD","CL","CN","CO","KM","CG","CD","CR","CI","HR",
  "CU","CW","CY","CZ","DK","DJ","DM","DO","EC","EG","SV","GQ","ER","EE","SZ",
  "ET","FJ","FI","FR","GA","GM","GE","DE","GH","GR","GD","GT","GN","GW","GY",
  "HT","HN","HK","HU","IS","IN","ID","IR","IQ","IE","IL","IT","JM","JP","JO",
  "KZ","KE","KI","KP","KR","KW","KG","LA","LV","LB","LS","LR","LY","LI","LT",
  "LU","MO","MG","MW","MY","MV","ML","MT","MH","MR","MU","MX","FM","MD","MC",
  "MN","ME","MA","MZ","MM","NA","NR","NP","NL","NZ","NI","NE","NG","MK","NO",
  "OM","PK","PW","PS","PA","PG","PY","PE","PH","PL","PT","QA","RO","RU","RW",
  "KN","LC","VC","WS","SM","ST","SA","SN","RS","SC","SL","SG","SK","SI","SB",
  "SO","ZA","SS","ES","LK","SD","SR","SE","CH","SY","TW","TJ","TZ","TH","TL",
  "TG","TO","TT","TN","TR","TM","TV","UG","UA","AE","GB","US","UY","UZ","VU",
  "VE","VN","YE","ZM","ZW"
];

// Rate-limit helper: wait between batches
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const calKey = Deno.env.get("CALENDARIFIC_API_KEY");
  if (!calKey) {
    return new Response(JSON.stringify({ error: "CALENDARIFIC_API_KEY not set" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear + 1];

  // Check which countries already have data for this year
  const { data: existingRows } = await sb.from("high_demand_dates")
    .select("country")
    .eq("fetched_year", currentYear);

  const alreadyCached = new Set((existingRows || []).map((r: any) => r.country));
  const countriesToFetch = ALL_COUNTRIES.filter((cc) => !alreadyCached.has(cc));

  if (countriesToFetch.length === 0) {
    return new Response(JSON.stringify({
      message: "All countries already cached for this year",
      cached: alreadyCached.size,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // ── Monthly budget guard: max 480 Calendarific calls (hard cap, 20 buffer) ──
  const MONTHLY_CAP = 480;

  // Count Calendarific calls already made this month by checking how many
  // countries were fetched with fetched_year = currentYear this calendar month
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const { count: callsThisMonth } = await sb.from("high_demand_dates")
    .select("*", { count: "exact", head: true })
    .eq("fetched_year", currentYear)
    .gte("created_at", monthStart.toISOString());
  
  // Each country = 2 API calls (current year + next year)
  // Estimate calls already used: distinct countries cached this month × 2
  const { data: monthCountries } = await sb.from("high_demand_dates")
    .select("country")
    .eq("fetched_year", currentYear)
    .gte("created_at", monthStart.toISOString());
  const distinctThisMonth = new Set((monthCountries || []).map((r: any) => r.country)).size;
  const estimatedCallsUsed = distinctThisMonth * 2;
  const remainingBudget = Math.max(0, MONTHLY_CAP - estimatedCallsUsed);

  if (remainingBudget < 2) {
    return new Response(JSON.stringify({
      message: "Monthly API budget exhausted — will retry next month",
      estimated_calls_used: estimatedCallsUsed,
      cap: MONTHLY_CAP,
      countries_pending: countriesToFetch.length,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // Limit countries to what fits in remaining budget (2 calls per country)
  const maxCountries = Math.floor(remainingBudget / 2);
  const limitedCountries = countriesToFetch.slice(0, maxCountries);

  let totalCached = 0;
  let apiCalls = 0;
  let failedCountries: string[] = [];

  console.log(`[sync-holidays] Budget: ${remainingBudget} calls remaining, processing ${limitedCountries.length}/${countriesToFetch.length} countries`);

  // Process ONE country at a time with 1.1s delay (Calendarific: 1 req/sec)
  for (const cc of limitedCountries) {
    // Double-check budget mid-run
    if (apiCalls >= remainingBudget) {
      console.log(`[sync-holidays] Hit budget cap at ${apiCalls} calls, stopping`);
      failedCountries.push(...limitedCountries.slice(limitedCountries.indexOf(cc)));
      break;
    }

    const rows: any[] = [];
    let countryFailed = false;

    for (const year of years) {
      try {
        apiCalls++;
        const url = `https://calendarific.com/api/v2/holidays?api_key=${calKey}&country=${cc}&year=${year}&type=national`;
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) { countryFailed = true; continue; }
        const json = await res.json();
        const holidays = json?.response?.holidays;
        if (Array.isArray(holidays)) {
          for (const h of holidays) {
            const dateStr = h.date?.iso?.split("T")[0];
            if (dateStr) rows.push({ date: dateStr, label: h.name || "Holiday", country: cc, fetched_year: currentYear });
          }
        }
      } catch { countryFailed = true; }
      // Rate limit: 1.1s between each API call
      await sleep(1100);
    }

    // Nager.Date fallback if Calendarific failed (free, doesn't count toward budget)
    if (rows.length === 0 && countryFailed) {
      for (const year of years) {
        try {
          const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${cc}`, { signal: AbortSignal.timeout(3000) });
          if (!res.ok) continue;
          const holidays: { date: string; localName: string; name: string }[] = await res.json();
          for (const h of holidays) rows.push({ date: h.date, label: h.localName || h.name, country: cc, fetched_year: currentYear });
        } catch {}
      }
    }

    if (rows.length === 0) {
      failedCountries.push(cc);
      continue;
    }

    // Deduplicate by date
    const deduped = new Map<string, any>();
    for (const r of rows) deduped.set(r.date, r);
    const uniqueRows = [...deduped.values()];

    try {
      await sb.from("high_demand_dates").delete().eq("country", cc).lt("fetched_year", currentYear);
      const { error } = await sb.from("high_demand_dates").upsert(uniqueRows, { onConflict: "date,country", ignoreDuplicates: true });
      if (!error) totalCached += uniqueRows.length;
      else console.warn(`[sync-holidays] upsert error for ${cc}:`, error.message);
    } catch (e: any) { console.warn(`[sync-holidays] DB error for ${cc}:`, e.message); }
  }

  const result = {
    message: `Synced holidays for ${currentYear} & ${currentYear + 1}`,
    countries_processed: limitedCountries.length,
    countries_skipped: alreadyCached.size,
    countries_deferred: countriesToFetch.length - limitedCountries.length,
    holidays_cached: totalCached,
    api_calls_used: apiCalls,
    budget_remaining: Math.max(0, remainingBudget - apiCalls),
    monthly_cap: MONTHLY_CAP,
    failed_countries: failedCountries,
  };

  console.log("[sync-holidays]", JSON.stringify(result));

  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
