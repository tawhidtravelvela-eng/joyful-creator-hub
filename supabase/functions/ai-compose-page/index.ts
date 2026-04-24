// Studio — AI Compose Page
// Takes a free-text prompt + tenant context and returns:
//   { skin_key, blocks[], rationale, design_tokens }
// Also debits 1 AI credit from the tenant's pool and writes a ledger row
// (which doubles as compose history).

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

// Keep this in sync with src/lib/skins/registry.ts and blockRegistry.tsx
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

const COMPOSE_TOOL = {
  type: "function",
  function: {
    name: "compose_homepage",
    description:
      "Compose a tenant homepage: pick the best skin, an ordered list of blocks, and short hero copy.",
    parameters: {
      type: "object",
      properties: {
        skin_key: {
          type: "string",
          enum: [...SKIN_KEYS],
          description: "Which skin best matches the prompt and enabled modules.",
        },
        blocks: {
          type: "array",
          minItems: 3,
          maxItems: 8,
          description:
            "Ordered block stack for the homepage. Always start with a hero.* block.",
          items: {
            type: "object",
            properties: {
              block_key: { type: "string", enum: [...BLOCK_KEYS] },
              content: {
                type: "object",
                description:
                  "Optional content overrides (e.g. headline, subheadline, cta_label).",
                properties: {
                  headline: { type: "string" },
                  subheadline: { type: "string" },
                  cta_label: { type: "string" },
                  cta_href: { type: "string" },
                },
              },
            },
            required: ["block_key"],
          },
        },
        hero_tagline: {
          type: "string",
          description: "Catchy 4-9 word tagline for the hero block.",
        },
        hero_subheadline: {
          type: "string",
          description: "1 sentence hero subheadline (max 140 chars).",
        },
        rationale: {
          type: "string",
          description: "Why these choices fit the prompt (1-2 sentences).",
        },
      },
      required: ["skin_key", "blocks", "hero_tagline", "rationale"],
    },
  },
};

const SYSTEM_PROMPT = `You are a senior travel-site designer composing a homepage for a white-label travel brand.

RULES
- Pick exactly one skin_key from the allowed enum.
- The first block MUST be a hero.* block matching the skin's vertical.
- Only use block_keys from the allowed enum. Never invent new keys.
- Only include blocks for modules that are ENABLED for this tenant. If "flights" is off, do not pick trending.flights or hero.search-flight, etc.
- Order blocks for conversion: hero → primary value prop → social proof → CTA → newsletter.
- Keep total blocks between 4 and 7.
- hero_tagline must be punchy, brand-appropriate, no emojis.
- Match the audience: b2c-* skins for consumers, b2b-corporate for company travel desks, hybrid-full when both consumer and agent flows are needed.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const {
      tenant_id,
      user_id,
      prompt,
      enabled_modules = {},
      audience,
      brand_name,
    } = body || {};

    if (!tenant_id || !prompt) {
      return json({ error: "tenant_id and prompt are required" }, 400);
    }

    // 1. Check & debit AI credits.
    const { data: credits } = await supabase
      .from("tenant_ai_credits")
      .select("monthly_allowance, used_this_period, top_up_balance, period_end")
      .eq("tenant_id", tenant_id)
      .maybeSingle();

    // Auto-create row if missing
    let row = credits;
    if (!row) {
      const { data: created } = await supabase
        .from("tenant_ai_credits")
        .insert({ tenant_id })
        .select("monthly_allowance, used_this_period, top_up_balance, period_end")
        .maybeSingle();
      row = created;
    }

    const allowance = Number(row?.monthly_allowance || 0);
    const used = Number(row?.used_this_period || 0);
    const topup = Number(row?.top_up_balance || 0);
    const poolRemaining = Math.max(0, allowance - used);
    const totalAvailable = poolRemaining + topup;

    if (totalAvailable < 1) {
      return json(
        {
          error: "Out of AI credits",
          message:
            "This tenant has no remaining AI credits this period. Top up to continue.",
          pool_remaining: poolRemaining,
          topup_balance: topup,
        },
        402,
      );
    }

    // 2. Build the user prompt and call the AI router.
    const enabledLabels = Object.entries(enabled_modules)
      .filter(([, v]) => v === true)
      .map(([k]) => k)
      .join(", ") || "general";

    const userPrompt = `Brand: ${brand_name || "(unnamed travel brand)"}
Audience: ${audience || "b2c"}
Enabled modules: ${enabledLabels}

User brief:
"""${String(prompt).slice(0, 1200)}"""

Compose the homepage now.`;

    const aiResult = await runAITask({
      taskKey: "studio-ai-compose",
      supabase,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      tools: [COMPOSE_TOOL],
      toolChoice: { type: "function", function: { name: "compose_homepage" } },
    });

    const args = aiResult.toolCall?.args;
    if (!args || !Array.isArray(args.blocks) || !args.skin_key) {
      return json(
        { error: "AI returned no usable composition", raw: aiResult.content || null },
        502,
      );
    }

    // 3. Inject hero copy into the first hero block.
    const blocks = args.blocks
      .filter((b: any) => b && BLOCK_KEYS.includes(b.block_key))
      .map((b: any, i: number) => {
        if (i === 0 && b.block_key.startsWith("hero.")) {
          return {
            block_key: b.block_key,
            content: {
              headline: args.hero_tagline,
              subheadline: args.hero_subheadline || undefined,
              ...(b.content || {}),
            },
          };
        }
        return { block_key: b.block_key, content: b.content || undefined };
      });

    // Guarantee a hero at index 0.
    if (!blocks.length || !blocks[0].block_key.startsWith("hero.")) {
      blocks.unshift({
        block_key: "hero.search-mixed",
        content: { headline: args.hero_tagline },
      });
    }

    // 4. Debit 1 credit (prefer pool, fall back to top-up).
    const chargeFromPool = poolRemaining >= 1;
    const newUsed = chargeFromPool ? used + 1 : used;
    const newTopup = chargeFromPool ? topup : topup - 1;

    await supabase
      .from("tenant_ai_credits")
      .update({
        used_this_period: newUsed,
        top_up_balance: newTopup,
        last_charged_at: new Date().toISOString(),
        total_lifetime_used: (Number(row?.total_lifetime_used || 0) || 0) + 1,
      } as any)
      .eq("tenant_id", tenant_id);

    await supabase.from("tenant_ai_credit_ledger").insert({
      tenant_id,
      user_id: user_id || null,
      operation: "studio_compose",
      amount_charged: 1,
      charged_from: chargeFromPool ? "pool" : "topup",
      prompt_summary: String(prompt).slice(0, 240),
      pool_balance_after: Math.max(0, allowance - newUsed),
      topup_balance_after: newTopup,
      metadata: {
        skin_key: args.skin_key,
        block_count: blocks.length,
        provider: aiResult.provider,
        model: aiResult.model,
        rationale: args.rationale,
      },
    });

    return json({
      success: true,
      skin_key: args.skin_key,
      blocks,
      rationale: args.rationale,
      provider: aiResult.provider,
      model: aiResult.model,
      credits: {
        pool_remaining: Math.max(0, allowance - newUsed),
        topup_balance: newTopup,
      },
    });
  } catch (e: any) {
    console.error("[ai-compose-page] error:", e?.message || e);
    return json({ error: e?.message || "Internal error" }, 500);
  }
});
