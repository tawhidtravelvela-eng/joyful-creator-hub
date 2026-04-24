import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function sortParams(params: Record<string, string>): string {
  return Object.keys(params)
    .sort()
    .filter((k) => params[k] !== "" && params[k] !== undefined)
    .map((k) => `${k}=${params[k]}`)
    .join("&");
}

async function rsaSign(content: string, privateKeyPem: string): Promise<string> {
  const pemBody = privateKeyPem
    .replace(/-----BEGIN (RSA )?PRIVATE KEY-----/g, "")
    .replace(/-----END (RSA )?PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");

  const binaryKey = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(content)
  );

  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

async function rsaVerify(content: string, signature: string, publicKeyPem: string): Promise<boolean> {
  const pemBody = publicKeyPem
    .replace(/-----BEGIN PUBLIC KEY-----/g, "")
    .replace(/-----END PUBLIC KEY-----/g, "")
    .replace(/\s/g, "");

  const binaryKey = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "spki",
    binaryKey.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );

  const sigBytes = Uint8Array.from(atob(signature), (c) => c.charCodeAt(0));
  return crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    sigBytes.buffer,
    new TextEncoder().encode(content)
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Auth check
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await anonClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, amount, bookingId, callbackURL, trade_no } = body;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Load Alipay settings
    const { data: settingsRow } = await supabase
      .from("api_settings")
      .select("settings")
      .eq("provider", "site_payment")
      .maybeSingle();

    const settings = (settingsRow?.settings as Record<string, any>) || {};
    const appId = settings.alipay_app_id;
    const privateKey = settings.alipay_private_key;
    const alipayPublicKey = settings.alipay_public_key;
    const sandbox = settings.alipay_sandbox !== false;

    if (!appId || !privateKey) {
      return new Response(JSON.stringify({ error: "Alipay not configured" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const gateway = sandbox
      ? "https://openapi-sandbox.dl.alipaydev.com/gateway.do"
      : "https://openapi.alipay.com/gateway.do";

    if (action === "create") {
      if (!amount || amount <= 0 || !bookingId) {
        return new Response(JSON.stringify({ error: "Invalid amount or bookingId" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const timestamp = new Date().toISOString().replace("T", " ").substring(0, 19);
      const outTradeNo = `ALP${Date.now()}${bookingId.replace(/[^a-zA-Z0-9]/g, "").substring(0, 20)}`;

      const bizContent = JSON.stringify({
        out_trade_no: outTradeNo,
        total_amount: amount.toFixed(2),
        subject: `Booking ${bookingId}`,
        product_code: "FAST_INSTANT_TRADE_PAY",
      });

      const params: Record<string, string> = {
        app_id: appId,
        method: "alipay.trade.page.pay",
        charset: "utf-8",
        sign_type: "RSA2",
        timestamp,
        version: "1.0",
        biz_content: bizContent,
        return_url: callbackURL || "",
        notify_url: `${supabaseUrl}/functions/v1/alipay-payment`,
      };

      const signContent = sortParams(params);
      const sign = await rsaSign(signContent, privateKey);
      params.sign = sign;

      // Build the full redirect URL
      const queryString = Object.entries(params)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join("&");

      const payURL = `${gateway}?${queryString}`;

      return new Response(JSON.stringify({
        success: true,
        payURL,
        outTradeNo,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "query") {
      // Query trade status
      if (!trade_no) {
        return new Response(JSON.stringify({ error: "Missing trade_no" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const timestamp = new Date().toISOString().replace("T", " ").substring(0, 19);
      const bizContent = JSON.stringify({ out_trade_no: trade_no });

      const params: Record<string, string> = {
        app_id: appId,
        method: "alipay.trade.query",
        charset: "utf-8",
        sign_type: "RSA2",
        timestamp,
        version: "1.0",
        biz_content: bizContent,
      };

      const signContent = sortParams(params);
      const sign = await rsaSign(signContent, privateKey);
      params.sign = sign;

      const queryString = Object.entries(params)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join("&");

      const res = await fetch(`${gateway}?${queryString}`);
      const data = await res.json();
      const tradeResponse = data?.alipay_trade_query_response;

      return new Response(JSON.stringify({
        success: tradeResponse?.code === "10000",
        trade_status: tradeResponse?.trade_status,
        trade_no: tradeResponse?.trade_no,
        total_amount: tradeResponse?.total_amount,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle Alipay async notification (notify_url callback - POST from Alipay servers)
    if (action === "notify" || req.method === "POST" && !body.action) {
      // Alipay sends form-encoded data to notify_url
      // For edge function, we parse it from the body
      const tradeStatus = body.trade_status;
      const outTradeNo = body.out_trade_no;
      const tradeNo = body.trade_no;
      const totalAmount = body.total_amount;

      if (tradeStatus === "TRADE_SUCCESS" || tradeStatus === "TRADE_FINISHED") {
        // Verify signature if public key is available
        if (alipayPublicKey) {
          const signFromAlipay = body.sign;
          const signType = body.sign_type;
          const verifyParams = { ...body };
          delete verifyParams.sign;
          delete verifyParams.sign_type;
          const verifyContent = sortParams(verifyParams);

          const valid = await rsaVerify(verifyContent, signFromAlipay, alipayPublicKey);
          if (!valid) {
            return new Response("fail", {
              headers: { ...corsHeaders, "Content-Type": "text/plain" },
            });
          }
        }

        // Credit wallet or update booking
        // Find booking by trade number pattern
        return new Response("success", {
          headers: { ...corsHeaders, "Content-Type": "text/plain" },
        });
      }

      return new Response("success", {
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
