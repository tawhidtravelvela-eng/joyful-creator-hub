// Studio — AI Rewrite Page
// Rewrites every editable copy field across all blocks on a page in one batched call.
// Charges 5 credits, logs a ledger row.
//
// Body: { tenant_id, user_id, blocks: [{ block_key, content }], instruction?, brand_name?, tone? }
// Returns: { success, blocks: [{ block_key, content }], credits, provider, model }

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

const PAGE_REWRITE_TOOL = {
  type: "function",
  function: {
    name: "rewrite_page",
    description: "Rewrite copy for every block on a page.",
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

const COST = 5;

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
      blocks: inputBlocks,
      instruction,
      brand_name,
      tone,
      locked_block_keys,
    } = body || {};

    if (!tenant_id || !Array.isArray(inputBlocks) || inputBlocks.length === 0) {
      return json({ error: "tenant_id and non-empty blocks are required" }, 400);
    }

    // Locked blocks are skipped — they keep tenant's manual edits intact.
    const lockedSet = new Set<string>(
      Array.isArray(locked_block_keys)
        ? locked_block_keys.filter((k: unknown) => typeof k === "string")
        : [],
    );
    const editableBlocks = inputBlocks.filter(
      (b: any) => !lockedSet.has(b?.block_key),
    );
    if (editableBlocks.length === 0) {
      return json(
        {
          error: "All blocks locked",
          message:
            "Every block on this page is locked. Unlock at least one block before running an AI rewrite.",
        },
        400,
      );
    }

    // Credits check
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

    const system = `You are a senior copywriter for a white-label travel brand. Rewrite copy for every block on a page in one shot. Keep brand voice consistent across blocks. Plain text only, no markdown, no emojis.`;

    const user = `Brand: ${brand_name || "(unnamed travel brand)"}
Tone: ${tone || "warm, confident, modern"}
Instruction: ${instruction || "Make every block punchier, clearer and more on-brand."}

Current page blocks (JSON):
${JSON.stringify(editableBlocks.map((b: any) => ({ block_key: b.block_key, content: b.content || {} })), null, 2)}

Return the full rewritten block list via the rewrite_page tool. Preserve block_key order. Only fill fields that exist in the input content (don't invent new fields).`;

    const aiResult = await runAITask({
      taskKey: "studio-ai-rewrite-page",
      supabase,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      tools: [PAGE_REWRITE_TOOL],
      toolChoice: { type: "function", function: { name: "rewrite_page" } },
    });

    const result = aiResult.toolCall?.args?.blocks;
    if (!Array.isArray(result) || result.length === 0) {
      return json({ error: "AI returned no blocks", raw: aiResult.content || null }, 502);
    }

    // Merge: only overwrite fields the AI returned, drop unknown fields.
    // Locked blocks pass through untouched.
    const merged = inputBlocks.map((orig: any) => {
      if (lockedSet.has(orig.block_key)) {
        return { block_key: orig.block_key, content: orig.content || {} };
      }
      const ai = result.find((r: any) => r.block_key === orig.block_key);
      const allowed = ["headline", "subheadline", "cta_label", "title", "body", "description"];
      const aiContent = ai?.content || {};
      const next: Record<string, any> = { ...(orig.content || {}) };
      for (const k of allowed) {
        if (typeof aiContent[k] === "string" && aiContent[k].trim()) {
          next[k] = aiContent[k].trim();
        }
      }
      return { block_key: orig.block_key, content: next };
    });

    // Debit
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
      operation: "studio_rewrite_page",
      amount_charged: COST,
      charged_from: chargeFromPool ? "pool" : (fromPool > 0 ? "mixed" : "topup"),
      prompt_summary: `page rewrite: ${(instruction || "polish all copy").slice(0, 160)}`,
      pool_balance_after: Math.max(0, allowance - newUsed),
      topup_balance_after: newTopup,
      metadata: {
        block_count: inputBlocks.length,
        provider: aiResult.provider,
        model: aiResult.model,
      },
    });

    return json({
      success: true,
      blocks: merged,
      provider: aiResult.provider,
      model: aiResult.model,
      credits: {
        pool_remaining: Math.max(0, allowance - newUsed),
        topup_balance: newTopup,
      },
    });
  } catch (e: any) {
    console.error("[ai-rewrite-page] error:", e?.message || e);
    return json({ error: e?.message || "Internal error" }, 500);
  }
});