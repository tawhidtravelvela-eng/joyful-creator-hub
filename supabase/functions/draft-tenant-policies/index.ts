/**
 * draft-tenant-policies — generates AI-drafted policy markdown for a tenant.
 *
 * Input:
 *   { tenant_id, kinds?: string[], regenerate?: boolean }
 *   - kinds: subset of ['refund','cancellation','terms','payment','support','privacy']
 *   - if omitted, generates the FULL set (bulk first-time setup)
 *
 * Each policy is upserted on `tenant_policies` (one row per kind per tenant)
 * as a `draft` — the tenant must explicitly publish it.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

type Kind = "refund" | "cancellation" | "terms" | "payment" | "support" | "privacy";
const ALL_KINDS: Kind[] = ["refund", "cancellation", "terms", "payment", "support", "privacy"];

const KIND_META: Record<Kind, { title: string; slug: string; sort: number; brief: string }> = {
  terms:        { title: "Booking Terms & Conditions", slug: "terms",         sort: 10,
    brief: "Defines the agreement between the traveller and the agency for any booking made — covers booking confirmation, payment, traveller responsibilities, liability, force majeure, and governing law." },
  refund:       { title: "Refund Policy",              slug: "refund",        sort: 20,
    brief: "Explains when and how refunds are processed for cancelled or unused services — refund timelines, methods, deductions, and supplier-dependent items." },
  cancellation: { title: "Cancellation Policy",        slug: "cancellation",  sort: 30,
    brief: "Outlines cancellation rules per product type (flights, hotels, tours, transfers), notice windows, applicable fees, and how to initiate a cancellation." },
  payment:      { title: "Payment Instructions",       slug: "payment",       sort: 40,
    brief: "Explains accepted payment methods, currencies, deposit/balance schedule, security of payment data, and what happens if a payment fails." },
  support:      { title: "Customer Support Policy",    slug: "support",       sort: 50,
    brief: "Sets expectations for support availability — channels (email/WhatsApp/phone), response times, escalation, and out-of-hours emergency contact." },
  privacy:      { title: "Privacy Policy",             slug: "privacy",       sort: 60,
    brief: "GDPR-aware policy explaining what personal data is collected, why, who it's shared with (suppliers, payment processors), retention, user rights, and contact for data requests." },
};

function buildSystemPrompt(): string {
  return [
    "You are a senior travel-industry legal/operations writer.",
    "Draft a clear, professional, traveller-friendly policy in MARKDOWN.",
    "",
    "Hard rules:",
    "• Tone: clear, calm, fair — never legalese-heavy. Aim for ~400-700 words.",
    "• Use short paragraphs and bullet lists. Use H2 (##) headings, no H1 (the title is shown separately).",
    "• Always include: a one-sentence summary at the top, then sections, then a 'Contact' section at the bottom using the tenant's contact info.",
    "• Be specific to TRAVEL: mention flights/hotels/tours/transfers as relevant. Acknowledge supplier-imposed restrictions.",
    "• If the tenant's region implies regulation (EU → GDPR, UK → UK-GDPR, India → DPDP), tailor language accordingly without naming a specific jurisdiction unless given.",
    "• Never invent specific monetary amounts, day counts, or jurisdictions unless the tenant provided them — use placeholders like 'within X business days' instead.",
    "• End with: '_Last updated: <today's date>_' on its own line.",
    "• Output ONLY the markdown — no preamble, no code fences.",
  ].join("\n");
}

function buildUserPrompt(args: {
  kind: Kind;
  tenantName: string;
  region?: string;
  audience?: string;
  contact: { email?: string; phone?: string; whatsapp?: string };
  brandVoice?: string;
  productFocus?: string;
}): string {
  const meta = KIND_META[args.kind];
  const contactLines = [
    args.contact.email    ? `Email: ${args.contact.email}` : null,
    args.contact.phone    ? `Phone: ${args.contact.phone}` : null,
    args.contact.whatsapp ? `WhatsApp: ${args.contact.whatsapp}` : null,
  ].filter(Boolean).join("\n") || "(no contact provided — use a generic 'contact us' placeholder)";

  return [
    `Draft the **${meta.title}** for the travel agency below.`,
    "",
    `Brief: ${meta.brief}`,
    "",
    `Agency name: ${args.tenantName}`,
    args.region        ? `Operating region: ${args.region}` : "",
    args.audience      ? `Target traveller: ${args.audience}` : "",
    args.productFocus  ? `Primary services: ${args.productFocus}` : "",
    args.brandVoice    ? `Brand voice: ${args.brandVoice}` : "",
    "",
    "Contact info to use in the closing section:",
    contactLines,
  ].filter(Boolean).join("\n");
}

async function generateOne(args: {
  apiKey: string;
  kind: Kind;
  tenantName: string;
  region?: string;
  audience?: string;
  contact: { email?: string; phone?: string; whatsapp?: string };
  brandVoice?: string;
  productFocus?: string;
}): Promise<{ md: string; model: string }> {
  const model = "google/gemini-3-flash-preview";
  const resp = await fetch(LOVABLE_AI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${args.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: buildSystemPrompt() },
        { role: "user",   content: buildUserPrompt(args) },
      ],
      temperature: 0.5,
    }),
  });
  if (resp.status === 429) throw new Error("Rate limit reached. Try again in a minute.");
  if (resp.status === 402) throw new Error("AI credits exhausted. Add credits in Settings → Workspace → Usage.");
  if (!resp.ok) {
    const t = await resp.text();
    console.error("[draft-tenant-policies] gateway error:", resp.status, t.slice(0, 300));
    throw new Error("AI gateway error");
  }
  const data = await resp.json();
  const md = data?.choices?.[0]?.message?.content?.trim();
  if (!md) throw new Error("AI returned empty content");
  return { md, model };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const tenantId = String(body?.tenant_id || "").trim();
    if (!tenantId) {
      return new Response(JSON.stringify({ error: "tenant_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate caller is a tenant admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Use the security-definer function to confirm admin status
    const { data: isAdmin } = await supabase.rpc("is_tenant_admin_of", { _tenant_id: tenantId });
    const { data: isSuper } = await supabase.rpc("has_role", { _user_id: userId, _role: "super_admin" });
    if (!isAdmin && !isSuper) {
      return new Response(JSON.stringify({ error: "Access denied" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve which kinds to generate
    const requested: Kind[] = Array.isArray(body?.kinds) && body.kinds.length > 0
      ? body.kinds.filter((k: any): k is Kind => ALL_KINDS.includes(k))
      : ALL_KINDS;
    if (requested.length === 0) {
      return new Response(JSON.stringify({ error: "No valid policy kinds requested" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pull tenant context (name) and any custom_site brand context
    const { data: tenant } = await supabase
      .from("tenants").select("name, brand_name").eq("id", tenantId).maybeSingle();
    const { data: site } = await supabase
      .from("custom_sites")
      .select("site_name, contact_email, contact_phone, contact_whatsapp, region_focus, audience, product_focus, brand_kit")
      .eq("tenant_id", tenantId).maybeSingle();

    const tenantName: string =
      (site as any)?.site_name || (tenant as any)?.brand_name || (tenant as any)?.name || "Our agency";
    const contact = {
      email:    (site as any)?.contact_email || undefined,
      phone:    (site as any)?.contact_phone || undefined,
      whatsapp: (site as any)?.contact_whatsapp || undefined,
    };
    const brandVoice = (site as any)?.brand_kit?.brand_voice?.tone_line || undefined;

    // Generate sequentially to avoid hammering the gateway / rate limits
    const results: Array<{ kind: Kind; ok: boolean; error?: string }> = [];
    for (const kind of requested) {
      try {
        const { md, model } = await generateOne({
          apiKey, kind,
          tenantName,
          region:       (site as any)?.region_focus || undefined,
          audience:     (site as any)?.audience || undefined,
          productFocus: (site as any)?.product_focus || undefined,
          brandVoice,
          contact,
        });

        const meta = KIND_META[kind];
        // Upsert: keep published_md untouched, only refresh draft_md
        const { error: upsertErr } = await supabase
          .from("tenant_policies")
          .upsert({
            tenant_id: tenantId,
            policy_kind: kind,
            title: meta.title,
            slug: meta.slug,
            sort_order: meta.sort,
            draft_md: md,
            status: "draft",
            last_generated_at: new Date().toISOString(),
            last_generated_by: userId,
            generation_model: model,
            generation_input: {
              region: (site as any)?.region_focus,
              audience: (site as any)?.audience,
              product_focus: (site as any)?.product_focus,
            },
          }, { onConflict: "tenant_id,policy_kind" });
        if (upsertErr) throw upsertErr;
        results.push({ kind, ok: true });
      } catch (e) {
        console.error(`[draft-tenant-policies] failed for ${kind}:`, e);
        results.push({ kind, ok: false, error: e instanceof Error ? e.message : String(e) });
      }
    }

    const okCount = results.filter((r) => r.ok).length;
    return new Response(JSON.stringify({ success: okCount > 0, generated: okCount, results }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[draft-tenant-policies] fatal:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});