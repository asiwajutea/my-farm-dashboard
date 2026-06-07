# VFarmers — Rename + Phased Build Plan

## Part 1 — Global Rename: VFarm → VFarmers

Replace every user-facing occurrence of "VFarm" with "VFarmers". Keep the green "Farm" / "Farmers" accent styling (`V<span class="text-primary">Farmers</span>`).

Files to update:
- `src/routes/index.tsx` — nav brand, hero copy, footer, all meta tags (title, description, og:*)
- `src/routes/auth.tsx` — brand mark, page title, "Welcome back / Become a Farmer" copy, terms line
- `src/routes/_authenticated/dashboard.tsx` — top-bar brand, greeting, copy
- `src/routes/__root.tsx` — default site title / og:site_name if set
- `src/components/Ticker.tsx` — any "VFarm" text
- `index.html` (if title present) and `package.json` `name` field stays lowercase but description (if any) updated
- Asset filename `src/assets/vfarm-logo.png` — keep as-is (internal only); alt text becomes "VFarmers"

The word "Farmer/Farmers" referring to a member stays as is — it was already the member term. Only the brand "VFarm" → "VFarmers".

---

## Part 2 — Phased Build Plan

Each phase is independently shippable, type-checks clean, and leaves the app in a working state. Phases are sequential; within a phase, work can parallelize.

### ✅ Phase 0 — Foundation (DONE)
Landing page, dark theme tokens, Lovable Cloud enabled, Email+Password+Google auth, `profiles` table with RLS, protected `/dashboard` shell.

---

### Phase 1 — Identity & Profile
**Goal:** Farmer has a real identity and can edit it.

- Extend `profiles`: `username` (unique, citext), `phone`, `country`, `avatar_url`, `kyc_status` enum (`unverified|pending|verified|rejected`), `referral_code` (unique), `referred_by` (fk profiles).
- `handle_new_user` trigger generates `referral_code` and copies `display_name`.
- Routes: `/_authenticated/profile` (view + edit form), avatar upload to Storage bucket `avatars` (public read, owner write).
- Header avatar menu with Profile / Sign out.

### Phase 2 — Wallets & Ledger (core money model)
**Goal:** Every Farmer has Primary + Farming wallets backed by an immutable ledger.

Tables:
- `wallets` (id, user_id, kind enum `primary|farming`, balance_seed numeric(20,8), updated_at) — one row per (user, kind), auto-created on signup.
- `ledger_entries` (id, user_id, wallet_id, kind enum `deposit|withdraw|transfer_in|transfer_out|cycle_lock|cycle_reap|reward|p2p_in|p2p_out|coupon|fee|adjustment`, amount_seed numeric, ref_table, ref_id, created_at).
- `app_settings` (singleton: seed_rate_usdt, p2p_fee_bps, withdraw_fee_bps, min_cycle_amount, cycle_duration_hours default 24, booster definitions jsonb).

Server functions (`createServerFn` + `requireSupabaseAuth`):
- `getWallets`, `getLedger(walletId, cursor)`, `transferBetweenWallets({from, to, amount})` — atomic via Postgres function `wallet_transfer()` that writes ledger + updates balances in one tx.

UI:
- Dashboard reads real balances.
- `/_authenticated/wallet/[kind]` shows balance + ledger history.
- Internal transfer modal (Primary ↔ Farming, fee-free, instant).

### Phase 3 — Deposits & Withdrawals (manual/admin first)
**Goal:** Get Seeds in and out without yet integrating a PSP.

- `deposit_requests` and `withdrawal_requests` tables (user_id, amount, method, status enum `pending|approved|rejected`, admin_note, proof_url).
- User submits request with optional proof upload (Storage `proofs` bucket, owner-write/admin-read).
- Admin approval (Phase 7) credits/debits via `wallet_transfer()`.
- Until admin tools land, expose a service-role-only server route to credit test deposits.

### Phase 4 — Farming Cycles
**Goal:** Core farming loop.

Tables:
- `cycles` (id, user_id, amount_seed, duration_hours, reward_bps, booster_id nullable, status enum `active|matured|reaped|cancelled`, started_at, matures_at, reaped_at).
- `boosters` (id, code, label, duration_hours, reward_bps, cost_seed, active bool) — seeded with 1d (default), 3d, 5d, 7d.

Server functions:
- `startCycle({amount, boosterId?})` — validates min amount, debits Farming wallet (ledger `cycle_lock`), creates cycle.
- `reapCycle({id})` — only if `now() >= matures_at`, credits principal + reward (ledger `cycle_reap` + `reward`), marks reaped.
- `listCycles()`.

UI:
- Dashboard "active cycle" card with countdown.
- `/_authenticated/farm` — start cycle form, booster picker, list of active/past cycles, Reap button.

### Phase 5 — P2P Transfers & Coupons
**Goal:** Farmer-to-Farmer movement.

- `p2p_transfers` (sender, receiver, amount, fee, note, status) — atomic transfer via `p2p_transfer()` SQL fn; fee from `app_settings.p2p_fee_bps`.
- Recipient lookup by `username` or `referral_code`.
- `coupons` (code unique, amount_seed, max_redemptions, redemptions_count, expires_at, created_by, active).
- `coupon_redemptions` (coupon_id, user_id unique-per-coupon, redeemed_at).
- UI: `/_authenticated/send`, `/_authenticated/coupons` (redeem code).

### Phase 6 — Escrow (P2P trades)
**Goal:** Safe trade with held funds.

- `escrows` (id, seller, buyer, amount_seed, status enum `funded|released|disputed|refunded|cancelled`, terms text, created_at, resolved_at).
- `escrow_events` audit log.
- Lifecycle: seller funds (lock from Farming wallet) → buyer confirms off-platform → either party releases / either party disputes → admin resolves (Phase 7).
- UI: `/_authenticated/escrow` (list + create + detail).

### Phase 7 — Admin Console
**Goal:** Operations & moderation.

- `user_roles` table + `app_role` enum (`admin`, `moderator`, `user`) + `has_role()` SECURITY DEFINER fn (per platform rules).
- Layout `src/routes/_authenticated/admin/route.tsx` guarded by `has_role(uid,'admin')`; otherwise 403.
- Pages:
  - `/admin` overview (KPIs: total farmers, circulating Seeds, active cycles, payouts 7d).
  - `/admin/farmers` (search, view, freeze, adjust balance with audit reason).
  - `/admin/requests` (approve/reject deposits & withdrawals).
  - `/admin/cycles` (force-mature, cancel).
  - `/admin/escrow` (resolve disputes).
  - `/admin/settings` (`app_settings`: seed_rate, fees, min amounts, booster catalog).
  - `/admin/coupons` (create/disable).
  - `/admin/audit` (all admin actions logged to `admin_audit`).

### Phase 8 — Notifications & Realtime
- `notifications` table (user_id, kind, title, body, read_at, created_at, payload jsonb).
- DB triggers on cycle reap / p2p in / deposit approval / escrow events insert a row.
- Supabase Realtime subscription per logged-in user → bell badge + toast.
- `/_authenticated/notifications` list.

### Phase 9 — Compliance & Trust
- Public routes: `/terms`, `/privacy`, `/risk-disclosure`, `/aml` (each its own route file with proper head meta — no hash anchors).
- Signup must accept ToS + Risk Disclosure (checkbox; store `tos_accepted_at`, `risk_accepted_at` on profile).
- KYC stub: `/_authenticated/verify` — upload ID + selfie to `kyc` bucket (private, admin-read), sets `kyc_status='pending'`; admin approves in `/admin/farmers`.
- Anti-fraud basics: rate-limit sign-ins (server route + simple counter), block sign-up from disposable email regex, log auth events.
- Replace any "guaranteed return" language with "community rewards based on ecosystem performance".

### Phase 10 — Public Stats, SEO & Polish
- Public `/api/public/stats` route returns aggregate ecosystem numbers; landing Ticker + StatCards consume it.
- Per-route `head()` meta with canonical + og:url for every public page (landing, auth, terms, privacy, risk).
- JSON-LD Organization on root; FAQPage on landing if FAQ section added.
- Sitemap + robots.
- Loading skeletons everywhere, empty states, error boundaries on every route with a loader.

### Phase 11 — Payments Integration (defer until business decides PSP)
Only when the user selects a provider (Stripe/Paddle/crypto on-ramp). Will plug into Phase 3 deposit/withdraw flows.

---

## Build-Safety Rules Applied to Every Phase

1. Each migration includes `GRANT` for `authenticated` + `service_role` (and `anon` only when policy allows).
2. RLS enabled on every public table; policies written same migration.
3. Money mutations go through SECURITY DEFINER Postgres functions that update balances + insert ledger rows in a single transaction.
4. All server logic uses `createServerFn` with `requireSupabaseAuth`; `attachSupabaseAuth` middleware already wired in `src/start.ts`.
5. No protected `loader` on a public route (would break SSR prerender).
6. New route files created BEFORE any `<Link to=...>` references them.
7. No `process.env.*` at module scope in client-imported files — only inside `.handler()`.
8. Public webhooks/cron only under `src/routes/api/public/*` with signature verification.

---

## What I'd Build Next After Approval
Part 1 (rename) + Phase 1 (profile expansion) in the first build pass — small, safe, sets up identity for everything that follows.