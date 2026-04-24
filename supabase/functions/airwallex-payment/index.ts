const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface CreatePayload {
  action: "create";
  amount: number;
  currency: string;
  bookingId: string;
  returnUrl: string;
}

interface ConfirmPayload {
  action: "confirm";
  intentId: string;
}

const AIRWALLEX_API =
  (Deno.env.get("AIRWALLEX_ENV") || "production") === "demo"
    ? "https://api-demo.airwallex.com"
    : "https://api.airwallex.com";

async function getToken(): Promise<string> {
  const clientId = Deno.env.get("AIRWALLEX_CLIENT_ID");
  const apiKey = Deno.env.get("AIRWALLEX_API_KEY");
  if (!clientId || !apiKey) throw new Error("Airwallex credentials not configured");

  const res = await fetch(`${AIRWALLEX_API}/api/v1/authentication/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-client-id": clientId,
      "x-api-key": apiKey,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Airwallex auth failed: ${res.status} ${body}`);
  }

  const data = await res.json();
  return data.token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const { action } = payload;

    if (action === "create") {
      const { amount, currency, bookingId, returnUrl } = payload as CreatePayload;
      if (!amount || !currency || !bookingId) {
        return new Response(
          JSON.stringify({ success: false, error: "Missing required fields" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const token = await getToken();

      // Create a PaymentIntent
      const intentRes = await fetch(`${AIRWALLEX_API}/api/v1/pa/payment_intents/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          request_id: crypto.randomUUID(),
          amount,
          currency: currency.toUpperCase(),
          merchant_order_id: bookingId,
          return_url: returnUrl,
          metadata: { booking_id: bookingId },
        }),
      });

      if (!intentRes.ok) {
        const errBody = await intentRes.text();
        console.error("Airwallex create intent error:", errBody);
        return new Response(
          JSON.stringify({ success: false, error: `Intent creation failed: ${intentRes.status}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const intent = await intentRes.json();

      return new Response(
        JSON.stringify({
          success: true,
          intentId: intent.id,
          clientSecret: intent.client_secret,
          currency: intent.currency,
          amount: intent.amount,
          status: intent.status,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "confirm") {
      const { intentId } = payload as ConfirmPayload;
      if (!intentId) {
        return new Response(
          JSON.stringify({ success: false, error: "Missing intentId" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const token = await getToken();

      const statusRes = await fetch(
        `${AIRWALLEX_API}/api/v1/pa/payment_intents/${intentId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!statusRes.ok) {
        const errBody = await statusRes.text();
        return new Response(
          JSON.stringify({ success: false, error: `Status check failed: ${statusRes.status}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const intentData = await statusRes.json();

      return new Response(
        JSON.stringify({
          success: true,
          status: intentData.status,
          intentId: intentData.id,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Airwallex edge function error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
