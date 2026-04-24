// Studio — AI Rebuild Site
// Re-generates the entire homepage from updated brand inputs:
//   1. Snapshots current state (pre_rebuild)
//   2. Picks fresh skin + block stack via AI
//   3. Generates fresh hero/title/CTA copy for each block
//   4. Replaces the "home" page composition
//   5. Updates skin config (skin_key + design tokens if provided)
//   6. Charges 50 credits
//
// Body: {
//   tenant_id, user_id,
//   brand_name?, tagline?, audience?, region?, tone?,
//   products?: { flights?, hotels?, tours?, transfers? },
//   primary_color?, accent_color?
// }
//
// Hard cap: 1 rebuild per 24h per tenant (prevents accidental runaway spend).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { runAITask } from "../_shared/aiRouter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const SKIN_KEYS = [
  "b2c-flight",
  "b2c-hotel",
  "b2c-tour",
  "b2c-general",
  "hybrid-full",
  "b2b-corporate",
] as const;

const BLOCK_KEYS = [
  "hero.search-flight",
  "hero.search-hotel",
  "hero.search-tour",
  "hero.search-mixed",
  "hero.corporate-marketing",
  "hero.hybrid-split",
  "trending.flights",
  "destination.popular",
  "destination.hotel-cities",
  "feature.why-choose-us",
  "feature.agent-benefits",
  "feature.dual-track",
  "testimonial.standard",
  "newsletter.signup",
  "stat.bar",
  "cta.agent-signup",
  "cta.agent-signup-rich",
] as const;

const REBUILD_TOOL = {
  type: "function",
  function: {
    name: "rebuild_site",
    description:
      "Pick a skin and an ordered block stack with fresh hero copy for the rebuilt homepage.",
    parameters: {
      type: "object",
      properties: {
        skin_key: { type: "string", enum: [...SKIN_KEYS] },
        rationale: {
          type: "string",
          description: "1–2 sentence reason for the chosen skin & stack.",
        },
        blocks: {
          type: "array",
          minItems: 4,
          maxItems: 9,
          items: {
            type: "object",
            properties: {
              block_key: { type: "string", enum: [...BLOCK_KEYS] },
              content: {
                type: "object",
                properties: {
                  headline: { type: "string" },
                  subheadline: { type: "string" },
                  cta_label: { type: "string" },
                  title: { type: "string" },
                  body: { type: "string" },
                  description: { type: "string" },
                },
              },
            },
            required: ["block_key"],
          },
        },
      },
      required: ["skin_key", "blocks"],
    },
  },
};

const COST = 50;
const COOLDOWN_HOURS = 24;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const {
      tenant_id,
      user_id,
      brand_name,
      tagline,
      audience,
      region,
      tone,
      products,
      primary_color,
      accent_color,
    } = body || {};

    if (!tenant_id) return json({ error: "tenant_id is required" }, 400);

    // 0. Plan gate — full rebuilds are a paid-plan feature. Tenants on
    // plans without `allow_full_rebuild` are blocked here so the cost
    // never hits the AI gateway.
    const { data: tenantRow } = await supabase
      .from("tenants")
      .select("plan_key")
      .eq("id", tenant_id)
      .maybeSingle();
    const planKey = (tenantRow as any)?.plan_key;
    if (planKey) {
      const { data: plan } = await supabase
        .from("b2b_plans")
        .select("allow_full_rebuild, display_name")
        .eq("plan_key", planKey)
        .maybeSingle();
      if (plan && (plan as any).allow_full_rebuild === false) {
        return json(
          {
            error: "Plan does not allow full rebuild",
            message: `Full site rebuild isn't included in the ${(plan as any).display_name || planKey} plan. Upgrade to unlock this action.`,
          },
          403,
        );
      }
    }

    // 1. Cooldown — block if last rebuild was < 24h ago.
    const cutoff = new Date(Date.now() - COOLDOWN_HOURS * 3600 * 1000).toISOString();
    const { data: recent } = await supabase
      .from("tenant_ai_credit_ledger")
      .select("id, created_at")
      .eq("tenant_id", tenant_id)
      .eq("operation", "studio_rebuild_site")
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (recent) {
      return json(
        {
          error: "Rebuild cooldown",
          message: `Only one full rebuild per ${COOLDOWN_HOURS}h. Last rebuild was at ${new Date(recent.created_at).toLocaleString()}.`,
        },
        429,
      );
    }

    // 2. Credits check.
    const { data: credits } = await supabase
      .from("tenant_ai_credits")
      .select(
        "monthly_allowance, used_this_period, top_up_balance, total_lifetime_used",
      )
      .eq("tenant_id", tenant_id)
      .maybeSingle();
    let row = credits;
    if (!row) {
      const { data: created } = await supabase
        .from("tenant_ai_credits")
        .insert({ tenant_id })
        .select(
          "monthly_allowance, used_this_period, top_up_balance, total_lifetime_used",
        )
        .maybeSingle();
      row = created;
    }
    const allowance = Number(row?.monthly_allowance || 0);
    const used = Number(row?.used_this_period || 0);
    const topup = Number(row?.top_up_balance || 0);
    const poolRemaining = Math.max(0, allowance - used);
    const totalAvailable = poolRemaining + topup;
    if (totalAvailable < COST) {
      return json(
        {
          error: "Out of AI credits",
          message: `Need ${COST} credits, have ${totalAvailable}. Top up to continue.`,
        },
        402,
      );
    }

    // 3. Snapshot current state.
    const { data: skinCfg } = await supabase
      .from("tenant_skin_config")
      .select(
        "skin_key, primary_color, accent_color, background_color, font_heading, font_body, border_radius, density, enabled_modules",
      )
      .eq("tenant_id", tenant_id)
      .maybeSingle();

    const { data: pages } = await supabase
      .from("tenant_page_composition")
      .select("page_slug, block_instances")
      .eq("tenant_id", tenant_id);

    const pageMap: Record<string, any> = {};
    (pages || []).forEach((p: any) => {
      pageMap[p.page_slug] = Array.isArray(p.block_instances)
        ? p.block_instances
        : [];
    });

    const { data: snap } = await supabase
      .from("tenant_site_snapshots")
      .insert({
        tenant_id,
        label: `Auto · before AI site rebuild · ${new Date().toLocaleString()}`,
        trigger_source: "pre_rebuild",
        skin_key: skinCfg?.skin_key || null,
        design_tokens: skinCfg
          ? {
              primary_color: skinCfg.primary_color,
              accent_color: skinCfg.accent_color,
              background_color: skinCfg.background_color,
              font_heading: skinCfg.font_heading,
              font_body: skinCfg.font_body,
              border_radius: skinCfg.border_radius,
              density: skinCfg.density,
            }
          : null,
        page_composition: pageMap,
        enabled_modules: skinCfg?.enabled_modules || null,
        created_by: user_id || null,
      })
      .select("id")
      .maybeSingle();

    // 4. Ask AI to rebuild.
    const enabledModules = (skinCfg?.enabled_modules as Record<string, boolean>) || {};
    const productList = products || {};
    const has = (k: string) =>
      enabledModules[k] === true || (productList as any)[k] === true;
    const enabled = ["flights", "hotels", "tours", "transfers"].filter(has);

    const system =
      "You are a senior brand designer for white-label travel sites. Pick the best skin and block stack for the brand, then write fresh, on-brand hero copy. Plain text only, no markdown, no emojis. Keep voice consistent across blocks.";
    const user = `REBUILD this travel brand's homepage from scratch.

Brand name: ${brand_name || "(unnamed travel brand)"}
Tagline: ${tagline || "(none provided)"}
Target audience: ${audience || "general"}
Region focus: ${region || "(no specific region)"}
Tone of voice: ${tone || "warm, confident, modern"}
Enabled products: ${enabled.length ? enabled.join(", ") : "general travel"}

Rules:
- Pick the single best skin_key for this brand
- Order blocks logically: hero first, then trending/destination, then trust/feature, then CTA/newsletter
- Only include blocks that match the enabled products
- For each block, write headline + subheadline + cta_label where applicable
- Hero headline: punchy, ≤8 words. Subheadline: 1 sentence, ≤18 words.

Use the rebuild_site tool to return your answer.`;

    const aiResult = await runAITask({
      taskKey: "studio-ai-rebuild-site",
      supabase,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      tools: [REBUILD_TOOL],
      toolChoice: { type: "function", function: { name: "rebuild_site" } },
    });

    const args = aiResult.toolCall?.args || {};
    const skinKey: string = SKIN_KEYS.includes(args.skin_key)
      ? args.skin_key
      : skinCfg?.skin_key || "b2c-general";
    const aiBlocks: any[] = Array.isArray(args.blocks) ? args.blocks : [];
    if (aiBlocks.length === 0) {
      return json(
        { error: "AI returned no blocks", raw: aiResult.content || null },
        502,
      );
    }

    const cleanBlocks = aiBlocks
      .filter((b) => BLOCK_KEYS.includes(b.block_key))
      .map((b) => ({
        block_key: b.block_key,
        enabled: true,
        content: b.content || {},
      }));

    if (cleanBlocks.length === 0) {
      return json({ error: "AI returned no valid blocks" }, 502);
    }

    // 5. Update skin config (upsert) with new skin_key + brand colors.
    const skinUpdate: Record<string, any> = {
      tenant_id,
      skin_key: skinKey,
    };
    if (primary_color) skinUpdate.primary_color = primary_color;
    if (accent_color) skinUpdate.accent_color = accent_color;
    await supabase
      .from("tenant_skin_config")
      .upsert(skinUpdate, { onConflict: "tenant_id" });

    // 6. Replace home page composition.
    await supabase
      .from("tenant_page_composition")
      .upsert(
        {
          tenant_id,
          page_slug: "home",
          block_instances: cleanBlocks as any,
          page_title:
            tagline ? `${brand_name || "Travel"} — ${tagline}` : null,
          last_ai_edit_at: new Date().toISOString(),
          last_edited_by: user_id || null,
          is_published: true,
        } as any,
        { onConflict: "tenant_id,page_slug" },
      );

    // 7. Debit credits.
    const fromPool = Math.min(COST, poolRemaining);
    const fromTopup = COST - fromPool;
    const newUsed = used + fromPool;
    const newTopup = topup - fromTopup;

    await supabase
      .from("tenant_ai_credits")
      .update({
        used_this_period: newUsed,
        top_up_balance: newTopup,
        last_charged_at: new Date().toISOString(),
        total_lifetime_used:
          (Number(row?.total_lifetime_used || 0) || 0) + COST,
      } as any)
      .eq("tenant_id", tenant_id);

    await supabase.from("tenant_ai_credit_ledger").insert({
      tenant_id,
      user_id: user_id || null,
      operation: "studio_rebuild_site",
      amount_charged: COST,
      charged_from:
        fromTopup === 0 ? "pool" : fromPool === 0 ? "topup" : "mixed",
      prompt_summary: `rebuild: ${(brand_name || "site").slice(0, 80)} · ${audience || "general"} · ${enabled.join("+")}`,
      pool_balance_after: Math.max(0, allowance - newUsed),
      topup_balance_after: newTopup,
      metadata: {
        skin_key: skinKey,
        block_count: cleanBlocks.length,
        snapshot_id: snap?.id || null,
        provider: aiResult.provider,
        model: aiResult.model,
        rationale: args.rationale || null,
        brand_name: brand_name || null,
        audience: audience || null,
        region: region || null,
      },
    });

    return json({
      success: true,
      skin_key: skinKey,
      blocks: cleanBlocks,
      rationale: args.rationale || null,
      snapshot_id: snap?.id || null,
      provider: aiResult.provider,
      model: aiResult.model,
      credits: {
        pool_remaining: Math.max(0, allowance - newUsed),
        topup_balance: newTopup,
      },
    });
  } catch (e: any) {
    console.error("[ai-rebuild-site] error:", e?.message || e);
    return json({ error: e?.message || "Internal error" }, 500);
  }
});
