import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: rows } = await sb
      .from("api_settings")
      .select("provider, settings")
      .in("provider", ["currency_rates", "taxes_fees", "whitelabel_config"]);

    const result: Record<string, unknown> = {
      whitelabel_config: {
        setup_fee: 500,
        api_access_fee: 3000,
        whitelabel_currency_fees: {},
        api_access_currency_fees: {},
      },
    };

    for (const row of rows || []) {
      const s = row.settings as Record<string, unknown>;

      if (row.provider === "currency_rates") {
        result.currency_rates = {
          live_rates: s?.live_rates || {},
          last_fetched: s?.last_fetched || null,
          conversion_markup: (s as any)?.conversion_markup ?? 2,
          api_source_currencies: s?.api_source_currencies || {},
        };
      }

      if (row.provider === "taxes_fees") {
        result.taxes_fees = {
          tax_percentage: (s as any)?.tax_percentage ?? 0,
          convenience_fee_percentage: (s as any)?.convenience_fee_percentage ?? 0,
          service_fee: (s as any)?.service_fee ?? 0,
        };
      }

      if (row.provider === "whitelabel_config") {
        result.whitelabel_config = {
          setup_fee: (s as any)?.setup_fee ?? 500,
          api_access_fee: (s as any)?.api_access_fee ?? 3000,
          whitelabel_currency_fees: (s as any)?.whitelabel_currency_fees || {},
          api_access_currency_fees: (s as any)?.api_access_currency_fees || {},
        };
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
