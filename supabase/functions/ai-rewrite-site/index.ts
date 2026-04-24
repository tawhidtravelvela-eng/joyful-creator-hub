// Studio — AI Rewrite Site
// Rewrites copy across every page composition for a tenant. Auto-snapshots first.
// Charges 30 credits.
//
// Body: { tenant_id, user_id, instruction?, brand_name?, tone? }
// Returns: { success, pages_rewritten, snapshot_id, credits, provider, model }

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

const SITE_REWRITE_TOOL = {
  type: "function",
  function: {
    name: "rewrite_site",
    description: "Rewrite copy for every block across the whole site.",
    parameters: {
      type: "object",
      properties: {
        blocks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              block_key: { type: "string" },
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
            required: ["block_key", "content"],
          },
        },
      },
      required: ["blocks"],
    },
  },
};

const COST = 30;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const { tenant_id, user_id, instruction, brand_name, tone } = body || {};

    if (!tenant_id) {
      return json({ error: "tenant_id is required" }, 400);
    }

    // Credits
    const { data: credits } = await supabase
      .from("tenant_ai_credits")
      .select("monthly_allowance, used_this_period, top_up_balance, total_lifetime_used")
      .eq("tenant_id", tenant_id)
      .maybeSingle();

    let row = credits;
    if (!row) {
      const { data: created } = await supabase
        .from("tenant_ai_credits")
        .insert({ tenant_id })
        .select("monthly_allowance, used_this_period, top_up_balance, total_lifetime_used")
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

    // 1. Load every page composition for this tenant.
    const { data: pages, error: pagesErr } = await supabase
      .from("tenant_page_composition")
      .select("id, page_slug, block_instances, locked_block_keys")
      .eq("tenant_id", tenant_id);
    if (pagesErr) throw pagesErr;
    if (!pages || pages.length === 0) {
      return json({ error: "No pages to rewrite" }, 404);
    }

    // Load skin config (single row per tenant) for snapshot context.
    const { data: skinCfg } = await supabase
      .from("tenant_skin_config")
      .select(
        "skin_key, primary_color, accent_color, background_color, font_heading, font_body, border_radius, density, enabled_modules",
      )
      .eq("tenant_id", tenant_id)
      .maybeSingle();

    // 2. Auto-snapshot before any changes.
    const pageCompositionMap: Record<string, any> = {};
    pages.forEach((p: any) => {
      pageCompositionMap[p.page_slug] = Array.isArray(p.block_instances)
        ? p.block_instances
        : [];
    });
    const { data: snap } = await supabase
      .from("tenant_site_snapshots")
      .insert({
        tenant_id,
        label: `Auto · before AI site rewrite · ${new Date().toLocaleString()}`,
        trigger_source: "pre_site_rewrite",
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
        page_composition: pageCompositionMap,
        enabled_modules: skinCfg?.enabled_modules || null,
        created_by: user_id || null,
      })
      .select("id")
      .maybeSingle();

    // 3. Flatten every block across pages and ask AI to rewrite once.
    // Locked blocks are excluded from the AI request and left untouched on save.
    const flat: { page_id: string; idx: number; block_key: string; content: any }[] = [];
    (pages as any[]).forEach((p) => {
      const arr = (Array.isArray(p.block_instances) ? p.block_instances : []) as any[];
      const locked = new Set<string>(
        Array.isArray(p.locked_block_keys) ? p.locked_block_keys : [],
      );
      arr.forEach((b, idx) => {
        if (locked.has(b?.block_key)) return;
        flat.push({ page_id: p.id, idx, block_key: b.block_key, content: b.content || {} });
      });
    });

    if (flat.length === 0) {
      return json(
        {
          error: "No editable blocks",
          message:
            "Every block across the site is locked. Unlock at least one block before running a site-wide AI rewrite.",
        },
        400,
      );
    }

    const system = `You are a senior copywriter for a white-label travel brand. Rewrite the copy for every block across the entire site in a single consistent voice. Plain text only, no markdown, no emojis.`;
    const user = `Brand: ${brand_name || "(unnamed travel brand)"}
Tone: ${tone || "warm, confident, modern"}
Instruction: ${instruction || "Refresh all site copy. Make it punchy, modern and cohesive."}

Site blocks (in order, JSON):
${JSON.stringify(flat.map((f) => ({ block_key: f.block_key, content: f.content })), null, 2)}

Return the same number of blocks in the same order via the rewrite_site tool. Only fill fields that already exist in the input content. Keep brand voice consistent.`;

    const aiResult = await runAITask({
      taskKey: "studio-ai-rewrite-site",
      supabase,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      tools: [SITE_REWRITE_TOOL],
      toolChoice: { type: "function", function: { name: "rewrite_site" } },
    });

    const result = aiResult.toolCall?.args?.blocks;
    if (!Array.isArray(result) || result.length === 0) {
      return json({ error: "AI returned no blocks", raw: aiResult.content || null }, 502);
    }

    // 4. Merge per-page and save back.
    const allowed = ["headline", "subheadline", "cta_label", "title", "body", "description"];
    let pagesUpdated = 0;
    for (const p of pages as any[]) {
      const arr = (Array.isArray(p.block_instances) ? p.block_instances : []) as any[];
      const locked = new Set<string>(
        Array.isArray(p.locked_block_keys) ? p.locked_block_keys : [],
      );
      const updated = arr.map((b, idx) => {
        if (locked.has(b?.block_key)) return b;
        // Find matching flat entry, then matching AI result by index alignment.
        const flatIdx = flat.findIndex((f) => f.page_id === p.id && f.idx === idx);
        if (flatIdx < 0) return b;
        const ai = result[flatIdx];
        if (!ai || !ai.content) return b;
        const next = { ...(b.content || {}) };
        for (const k of allowed) {
          if (typeof ai.content[k] === "string" && ai.content[k].trim()) {
            next[k] = ai.content[k].trim();
          }
        }
        return { ...b, content: next };
      });
      const { error: upErr } = await supabase
        .from("tenant_page_composition")
        .update({
          block_instances: updated as any,
          last_ai_edit_at: new Date().toISOString(),
          last_edited_by: user_id || null,
        } as any)
        .eq("id", p.id);
      if (!upErr) pagesUpdated++;
    }

    // 5. Debit
    const chargeFromPool = poolRemaining >= COST;
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
        total_lifetime_used: (Number(row?.total_lifetime_used || 0) || 0) + COST,
      } as any)
      .eq("tenant_id", tenant_id);

    await supabase.from("tenant_ai_credit_ledger").insert({
      tenant_id,
      user_id: user_id || null,
      operation: "studio_rewrite_site",
      amount_charged: COST,
      charged_from: chargeFromPool ? "pool" : (fromPool > 0 ? "mixed" : "topup"),
      prompt_summary: `site rewrite: ${(instruction || "refresh all").slice(0, 160)}`,
      pool_balance_after: Math.max(0, allowance - newUsed),
      topup_balance_after: newTopup,
      metadata: {
        pages_updated: pagesUpdated,
        block_count: flat.length,
        snapshot_id: snap?.id || null,
        provider: aiResult.provider,
        model: aiResult.model,
      },
    });

    return json({
      success: true,
      pages_rewritten: pagesUpdated,
      snapshot_id: snap?.id || null,
      provider: aiResult.provider,
      model: aiResult.model,
      credits: {
        pool_remaining: Math.max(0, allowance - newUsed),
        topup_balance: newTopup,
      },
    });
  } catch (e: any) {
    console.error("[ai-rewrite-site] error:", e?.message || e);
    return json({ error: e?.message || "Internal error" }, 500);
  }
});