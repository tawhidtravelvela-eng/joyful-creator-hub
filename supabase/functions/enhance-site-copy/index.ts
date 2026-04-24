/**
 * enhance-site-copy — background AI polish for a freshly composed Custom Website.
 *
 * Takes wizard answers + the current homepage section content and asks the
 * Lovable AI Gateway to rewrite hero/why/newsletter copy in the brand voice.
 * Updates the home page in-place.
 *
 * Plan-gated: caller MUST verify the tenant's plan exposes `ai_copy` before
 * invoking — this function trusts the caller and writes blindly to the site
 * (RLS on custom_site_pages prevents writes outside the tenant via JWT).
 */
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

interface RequestBody {
  brandName: string;
  tagline?: string;
  audience?: string;
  region?: string;
  voice?: "friendly" | "luxury" | "professional" | "playful";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "AI gateway not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Auth required" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthenticated" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as RequestBody;
    if (!body?.brandName || body.brandName.length > 200) {
      return new Response(JSON.stringify({ error: "brandName required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve tenant + site + home page
    const { data: profile } = await supabase
      .from("profiles").select("tenant_id").eq("user_id", userId).maybeSingle();
    const tenantId = profile?.tenant_id;
    if (!tenantId) {
      return new Response(JSON.stringify({ error: "No tenant" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: site } = await supabase
      .from("custom_sites").select("id").eq("tenant_id", tenantId).maybeSingle();
    if (!site?.id) {
      return new Response(JSON.stringify({ error: "Site not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: homePage } = await supabase
      .from("custom_site_pages").select("id, sections").eq("site_id", site.id)
      .eq("is_home", true).maybeSingle();
    if (!homePage?.id) {
      return new Response(JSON.stringify({ error: "Home page missing" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sections = Array.isArray(homePage.sections) ? homePage.sections : [];
    const heroSection = sections.find((s: any) => s.type === "hero" || s.type === "search");
    if (!heroSection) {
      return new Response(JSON.stringify({ ok: true, skipped: "no hero" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const voice = body.voice || (body.audience === "luxury" ? "luxury" : "friendly");
    const systemPrompt =
      `You write punchy travel-website hero copy. Voice: ${voice}. ` +
      `Output ONLY JSON with keys: eyebrow (≤4 words), headline (≤10 words), subhead (≤22 words). ` +
      `Mention the brand naturally. Never use clichés like "explore the world" or "your journey awaits".`;

    const userPrompt = JSON.stringify({
      brand: body.brandName,
      tagline: body.tagline || null,
      region: body.region || null,
      audience: body.audience || "general travellers",
    });

    const aiRes = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (aiRes.status === 429 || aiRes.status === 402) {
      return new Response(JSON.stringify({ error: aiRes.status === 429 ? "Rate limited" : "Credits exhausted" }), {
        status: aiRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!aiRes.ok) {
      const t = await aiRes.text();
      return new Response(JSON.stringify({ error: "AI call failed", detail: t.slice(0, 500) }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiRes.json();
    const raw = aiJson?.choices?.[0]?.message?.content || "{}";
    let polish: { eyebrow?: string; headline?: string; subhead?: string } = {};
    try { polish = JSON.parse(raw); } catch { polish = {}; }

    if (!polish.headline) {
      return new Response(JSON.stringify({ ok: true, skipped: "no polish" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const updatedSections = sections.map((s: any) => {
      if (s.id !== heroSection.id) return s;
      return {
        ...s,
        content: {
          ...s.content,
          ...(polish.eyebrow ? { eyebrow: polish.eyebrow } : {}),
          ...(polish.headline ? { headline: polish.headline } : {}),
          ...(polish.subhead ? { subhead: polish.subhead } : {}),
        },
      };
    });

    await supabase.from("custom_site_pages")
      .update({ sections: updatedSections }).eq("id", homePage.id);

    return new Response(JSON.stringify({ ok: true, polished: polish }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});