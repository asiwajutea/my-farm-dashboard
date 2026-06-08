
# Affiliate System + Header Logged-In State

## 1. Database (single migration, awaits approval)

**Extend `app_settings`** with affiliate config:
- `aff_gen1_pct`, `aff_gen2_pct`, `aff_gen3_pct` — cycle commission %s
- `aff_basis` enum (`profit` | `profit_plus_capital`) — admin-toggleable, default `profit`
- `maint_fee_seed` (monthly amount), `maint_fee_day` (1–28)
- `aff_maint_gen1_pct`, `aff_maint_gen2_pct`, `aff_maint_gen3_pct`

**New tables**
- `affiliate_commissions` — `user_id` (earner), `from_user_id` (downline), `generation` 1/2/3, `source` enum (`cycle` | `maintenance`), `source_id`, `basis_amount`, `pct`, `amount`, `paid_at`. RLS: owner SELECT, service_role ALL.
- `maintenance_fees` — `user_id`, `period_start`, `period_end`, `amount`, `status` enum (`due` | `paid` | `waived` | `overdue`), `paid_at`. RLS: owner SELECT, admin ALL.

**Helper**: `get_uplines(_user_id uuid) returns table(user_id uuid, generation int)` — walks `profiles.referred_by` up to 3 levels.

**RPCs (SECURITY DEFINER)**
- `pay_cycle_commissions(p_cycle_id)` — called inside `reap_cycle`. Reads `aff_basis`; basis = reward (or reward+principal). Iterates uplines, inserts `affiliate_commissions`, credits each earner's primary wallet via `wallet_adjust` with new ledger kind `affiliate_commission`.
- `pay_maintenance_fee(p_fee_id)` — debits payer's primary wallet, marks fee paid, then pays uplines using `aff_maint_*` pcts.
- `admin_run_monthly_maintenance()` — admin-only; creates `due` rows for active farmers for the current period. (Hook to cron later.)
- Update `handle_new_user()` trigger: read `raw_user_meta_data->>'referral_code'` and resolve to `profiles.referred_by` at signup.

New `ledger_kind` enum value: `affiliate_commission`, `maintenance_fee`.

## 2. Server Functions (`src/lib/affiliate.functions.ts`)
- `lookupReferrer(code)` — public-readable RPC returning `{ display_name, username, avatar_url }` for a valid code (used live on the signup form).
- `getMyAffiliateSummary()` — totals earned, downline counts per generation, last 20 commissions.
- `getMyDownlines()` — paginated list grouped by generation.
- `getMyMaintenanceStatus()` + `payMaintenanceFee(feeId)`.
- Admin: `adminSetAffiliateSettings(...)`, `adminRunMonthlyMaintenance()`, `adminListCommissions()`.

## 3. UI

**Signup (`src/routes/auth.tsx`)**
- Add "Affiliate code (optional)" field. Pre-fill from `?ref=CODE` query param.
- On blur/change, call `lookupReferrer` → show inline card "Referred by **Display Name** (@username)" with avatar; red message if invalid.
- Pass `referral_code` in `signUp` user metadata so the trigger links `referred_by`.

**New page `/affiliate`** (sidebar entry under Earn)
- Summary cards: total earned, gen1/2/3 downlines, this-month commissions.
- **Share link block**: `https://<site>/auth?ref=<code>` with copy button + WhatsApp/Telegram/X/Facebook share buttons preloaded with a catchy sales message ("I'm growing Seeds on VFarmers 🌱 — join me with my code and start earning. {link}"). Editable message field.
- Downline tree (3 tabs by generation).
- Commission history table.
- Maintenance fee panel: current due, pay button, history.

**Admin (`/admin/settings`)** — replace placeholder with form for: affiliate gen %s, profit basis toggle, maintenance fee amount/day, maintenance gen %s. Plus a "Run monthly maintenance now" button.
**Admin (`/admin/affiliates`)** — new page: top earners, all commissions, downline lookup.

**Header**
- Landing (`src/routes/index.tsx`): on mount check `supabase.auth.getSession()`. If signed in → hide "Sign in" / "Become a Farmer", show avatar + name chip + primary "Go to Dashboard" button. Signed-out → unchanged.
- Authenticated `AppTopbar` is already correct (avatar + name).

## 4. Files

**Create**
- `supabase/migrations/<ts>_affiliate.sql`
- `src/lib/affiliate.functions.ts`
- `src/routes/_authenticated/affiliate.tsx`
- `src/routes/_authenticated/admin/affiliates.tsx`
- `src/components/affiliate/ShareLink.tsx`, `ReferrerPreview.tsx`

**Edit**
- `src/routes/auth.tsx` (referral field + preview + metadata)
- `src/routes/index.tsx` (logged-in-aware header)
- `src/components/app-sidebar.tsx` (Affiliate link; Affiliates under Admin)
- `src/routes/_authenticated/admin/settings.tsx` (real form)
- `src/integrations/supabase/types.ts` regenerates after migration

## 5. Order of execution
1. Submit migration → wait for approval.
2. Build server fns + UI + header changes.
3. Verify: signup with `?ref=`, reap cycle credits uplines, admin run maintenance creates fees, paying a fee credits uplines.

## Assumptions
- Commissions paid instantly into the earner's **primary** wallet (USDT-denominated Seed).
- Maintenance fee charged in Seed from the primary wallet; auto-marked `overdue` after 7 days (cron later).
- No self-referral; circular chains blocked by `referred_by` check at signup.
- Generation counted by chain depth, not date.
