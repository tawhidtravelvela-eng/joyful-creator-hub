

# Tenant Self-Serve Redesign + AI Credits

## What you're asking for

Paid tenants should be able to **rebuild, restyle, and re-skin their site** as often as they want — using a metered pool of AI credits (worth $10–20) included in their plan. When they exhaust the pool, they can top up.

This sits **on top of** the Skin System v1 we already approved — it's the "ongoing edit" experience after the initial site is generated.

---

## Capability tiers (what tenants can change)

| Action | AI cost (est.) | Where |
|---|---|---|
| Switch skin (ota-classic ↔ luxury-editorial ↔ …) | Free | Studio → Design |
| Edit a single slot's copy manually | Free | Studio → Content |
| AI-rewrite one slot (e.g. "punchier hero headline") | ~$0.01 | Inline ✨ button per slot |
| AI-rewrite a whole page's slots | ~$0.05 | Page editor → "Regenerate copy" |
| AI-rewrite the whole site's copy | ~$0.30 | Studio → "Regenerate all copy" |
| Change brand inputs + full re-skin & re-copy | ~$0.50 | Studio → "Rebuild site" |
| Restore previous version | Free | Studio → History |

All AI actions debit a **per-tenant credit pool** denominated in USD (so the model/provider can change without breaking the UX).

---

## Plan grants (built into existing `b2b_plans`)

Add a monthly USD AI allowance to each plan tier:

| Plan | Monthly AI credit | Top-up |
|---|---|---|
| Starter | $5 | Pay-as-you-go |
| Growth | $15 | Pay-as-you-go |
| Pro | $25 | Pay-as-you-go |
| Enterprise | $50 | Custom |

Numbers are placeholders — you confirm during build. Unused credit rolls over **one month** then expires.

---

## Database changes

Add to `b2b_plans`:
- `monthly_ai_credit_usd numeric default 0`
- `allow_full_rebuild boolean default true`

New table `tenant_ai_credits`:
- `tenant_id uuid pk`
- `balance_usd numeric` (current pool)
- `granted_this_period_usd numeric`
- `period_start date`, `period_end date`
- `updated_at`

New table `tenant_ai_usage_log`:
- `id, tenant_id, user_id, action` (slot_rewrite|page_rewrite|site_rewrite|rebuild)
- `cost_usd numeric, model text, tokens_in int, tokens_out int`
- `target` (skin_key / page_id / slot_key)
- `created_at`

New table `tenant_site_history` (for restore):
- `id, tenant_id, snapshot jsonb` (skin_key + slot_overrides + brand)
- `reason text` (manual_save | pre_rebuild | pre_full_rewrite)
- `created_by, created_at`

RPCs:
- `tenant_ai_credit_charge(_tenant uuid, _amount numeric, _action text, _target text, _meta jsonb)` → debits pool, logs usage, raises if insufficient
- `tenant_ai_credit_refresh(_tenant uuid)` → grants monthly allowance if period expired
- `tenant_site_snapshot(_tenant uuid, _reason text)` → captures current state into history

---

## Edge functions (new / updated)

1. **`ai-rewrite-slot`** — single slot rewrite. Charges ~$0.01.
2. **`ai-rewrite-page`** — all slots on one page. Charges ~$0.05.
3. **`ai-rewrite-site`** — every page's slots. Charges ~$0.30. Takes pre-snapshot.
4. **`ai-rebuild-site`** — re-runs the initial unique-site generator (skin pick + slots) using updated brand inputs. Charges ~$0.50. Takes pre-snapshot.
5. **`tenant-ai-credit-topup`** — debits wallet, credits AI pool (USD-for-USD).

All call Lovable AI Gateway with `google/gemini-3-flash-preview`. Cost is computed from token usage × posted gateway rate, then rounded up to a tenant-facing fixed bucket so pricing stays predictable.

---

## Studio UI additions

**Studio → Design tab**
- Skin picker grid (5 cards) — switch instantly, free
- "Rebuild entire site with AI" button → opens dialog with brand-input form + cost estimate + "this will snapshot first"

**Studio → Content tab**
- Per-slot inline ✨ "Rewrite with AI" button
- Per-page "Regenerate this page" button
- Site-wide "Regenerate all copy" button

**Studio → AI Credits tab (new)**
- Big number: current balance ($X.XX of $Y.YY this period, resets MMM DD)
- Recent usage log (date · action · cost · who)
- "Top up credits" → opens wallet-debit dialog ($5 / $10 / $25 / custom)
- Plan upgrade nudge if balance low

**Studio → History tab (new)**
- List of snapshots with timestamp + reason + "Restore" button
- Auto-snapshot before any AI rewrite-site / rebuild action
- Manual "Save current as snapshot" button (free)
- Keep last 20 snapshots per tenant

---

## Guardrails

- Hard cap: 1 full rebuild per 24h (prevent runaway spend on accident)
- Soft cap: warn at 80% of monthly allowance
- Hard stop: action blocked at $0 balance with clear "top up or upgrade" CTA
- Every AI action shows estimated cost before running and actual cost after
- Snapshots are restore-only (no merge/diff in v1)
- Locked slots (tenant-edited manually) skip AI rewrite unless explicitly opted in

---

## Where this plugs into the approved Skin System plan

- **Phase 0 (foundation)**: also create `tenant_ai_credits`, `tenant_ai_usage_log`, `tenant_site_history` tables and the credit RPCs
- **Phase 1 (`ota-classic` build)**: Studio v2 includes the Design / Content / AI Credits / History tabs from day 1
- **Phase 2+**: each new skin auto-inherits the same self-serve experience

No changes to the Skins architecture itself — this is a metering + history layer wrapped around it.

---

## Open decisions

1. **Monthly credit amounts per plan** — confirm $5 / $15 / $25 / $50 or your own numbers
2. **Rollover policy** — 1 month, none, or unlimited
3. **Top-up source** — debit existing tenant wallet (recommended, already built) or separate Stripe charge
4. **History retention** — last 20 snapshots, or last 90 days, or both
5. **Free actions** — should manual slot edits, skin switches, and snapshot restores really be unlimited & free? (recommended yes)

Once you answer those, I'll fold this into the Phase 0 migration and build it alongside the Skin foundation.

