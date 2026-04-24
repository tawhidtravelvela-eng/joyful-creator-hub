import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { passport_country } = await req.json();
    if (!passport_country || typeof passport_country !== "string" || passport_country.length !== 2) {
      return new Response(JSON.stringify({ error: "passport_country must be a 2-letter ISO code" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const code = passport_country.toUpperCase();
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Check if already fetched and not expired
    const { data: fetchLog } = await sb
      .from("visa_fetch_log")
      .select("*")
      .eq("passport_country", code)
      .single();

    if (fetchLog && new Date(fetchLog.next_refresh_at) > new Date()) {
      const { data: cached } = await sb
        .from("visa_requirements")
        .select("*")
        .eq("passport_country", code);

      return new Response(JSON.stringify({
        source: "cache",
        passport_country: code,
        fetched_at: fetchLog.fetched_at,
        next_refresh_at: fetchLog.next_refresh_at,
        count: cached?.length || 0,
        requirements: cached || [],
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch from RapidAPI — /v2/visa/map returns all destinations for one passport
    const rapidApiKey = Deno.env.get("RAPIDAPI_KEY");
    if (!rapidApiKey) {
      return new Response(JSON.stringify({ error: "RAPIDAPI_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiUrl = "https://visa-requirement.p.rapidapi.com/v2/visa/map";
    console.log(`[visa] Fetching map for passport=${code}`);

    const apiRes = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-rapidapi-key": rapidApiKey,
        "x-rapidapi-host": "visa-requirement.p.rapidapi.com",
      },
      body: JSON.stringify({ passport: code }),
    });

    if (!apiRes.ok) {
      const errText = await apiRes.text();
      console.error(`[visa] API error ${apiRes.status}: ${errText}`);
      return new Response(JSON.stringify({ error: `API returned ${apiRes.status}`, details: errText }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiData = await apiRes.json();
    console.log(`[visa] API response keys:`, Object.keys(apiData));

    // Map color codes to our categories
    // 🟩 green = visa_free, 🟦 blue = evisa, 🟨 yellow = eta, 🟥 red = visa_required
    function mapStatus(color: string, category?: string): string {
      const c = (color || "").toLowerCase();
      const cat = (category || "").toLowerCase();
      if (c === "green" || cat.includes("visa free") || cat.includes("visa on arrival") || cat.includes("freedom")) return "visa_free";
      if (c === "blue" || cat.includes("evisa") || cat.includes("e-visa")) return "evisa";
      if (c === "yellow" || cat.includes("eta") || cat.includes("electronic travel")) return "eta";
      return "visa_required";
    }

    const rows: { passport_country: string; destination_country: string; destination_name: string; visa_status: string }[] = [];

    // API returns { passport: "BD", colors: { green: "BB,BS,...", blue: "AF,AG,...", yellow: "CI,KE,...", red: "AD,AE,..." } }
    const colorMap: Record<string, string> = {
      green: "visa_free",
      blue: "evisa",
      yellow: "eta",
      red: "visa_required",
    };

    const dataObj = apiData.data || apiData;
    const colors = dataObj.colors || dataObj;
    console.log(`[visa] data keys:`, Object.keys(dataObj), `colors keys:`, Object.keys(colors));
    for (const [color, countryCodes] of Object.entries(colors)) {
      const status = colorMap[color] || "visa_required";
      const codes = (countryCodes as string).split(",").map((c: string) => c.trim()).filter(Boolean);
      for (const destCode of codes) {
        rows.push({
          passport_country: code,
          destination_country: destCode.toUpperCase(),
          destination_name: destCode.toUpperCase(), // We only get codes, no names from this endpoint
          visa_status: status,
        });
      }
    }

    console.log(`[visa] Parsed ${rows.length} visa requirements for ${code}`);

    if (rows.length > 0) {
      await sb.from("visa_requirements").delete().eq("passport_country", code);

      for (let i = 0; i < rows.length; i += 100) {
        const batch = rows.slice(i, i + 100);
        const { error: insertErr } = await sb.from("visa_requirements").insert(batch);
        if (insertErr) console.error(`[visa] Insert error batch ${i}:`, insertErr.message);
      }

      await sb.from("visa_fetch_log").upsert({
        passport_country: code,
        fetched_at: new Date().toISOString(),
        next_refresh_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        record_count: rows.length,
      }, { onConflict: "passport_country" });
    }

    return new Response(JSON.stringify({
      source: "api",
      passport_country: code,
      count: rows.length,
      requirements: rows,
      raw_sample: Object.entries(colors).slice(0, 3),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: unknown) {
    console.error("[visa] Error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
