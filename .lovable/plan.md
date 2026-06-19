# Plan

## 1. Points Value (PV) System

**Database (migration)**
- `pv_activities` — canonical list of trackable activities (code, label, default self/g1/g2/g3 points, active). Seeded with: `signup`, `email_verified`, `kyc_approved`, `cycle_started`, `cycle_reaped`, `coupon_redeemed`, `p2p_sent`, `deposit_approved`, `withdraw_approved`, `affiliate_signup`, `maintenance_paid`, `farming_deposit`, `farming_withdraw`.
- `pv_ledger` — append-only entries: `user_id`, `activity_code`, `points`, `generation (0–3)`, `source_user_id`, `ref_table`, `ref_id`, `created_at`.
- `profiles.pv_total numeric` — running sum maintained by trigger on `pv_ledger`.
- Function `award_pv(p_user uuid, p_activity text, p_ref_table text, p_ref_id uuid)` — looks up points for activity, credits the user (gen 0) + their 3 uplines (via `get_uplines`), inserts ledger rows, sends a `pv_earned` notification to each recipient.
- Wire `award_pv` into existing triggers (`handle_new_user`, `handle_email_verified`, `tg_notify_kyc`, `tg_notify_cycle`, `redeem_coupon`, `tg_notify_p2p`, `tg_notify_deposit_request`, `tg_notify_withdrawal_request`, `tg_notify_maintenance_fee`) and into the new farming transfer functions.
- Add `pv_earned` value to `notification_kind` enum.
- Admin RPCs: `admin_upsert_pv_activity`, `admin_set_pv_activity_active`.

**Backend / frontend**
- `src/lib/pv.functions.ts` — `listPvActivities`, `upsertPvActivity` (admin), `getMyPvSummary` (total + recent ledger).
- New admin page `src/routes/_authenticated/admin/pv.tsx` — table of activities with editable self / G1 / G2 / G3 inputs and active toggle.
- Add "Points (PV)" tile to `admin/index.tsx`.
- Dashboard: small PV badge showing user's total points (display only — no redemption).
- `notification-meta.ts`: add icon/tone/route for `pv_earned` → `/history`.

## 2. Withdraw From Farming Wallet (Seed → USDT)

- Migration: RPC `farming_to_primary(p_amount_seed numeric)` — same rate as Primary→Farming (`app_settings.seed_to_usdt`), no fee. Uses `wallet_adjust` to debit farming (kind `farming_withdraw`) and credit primary with USDT (kind `farming_to_primary`). Adds these to `ledger_kind` enum if missing.
- Sends notification `transfer_to_primary` (new enum value) and awards PV via `farming_withdraw` activity.
- `src/lib/farm.functions.ts`: add `transferToPrimary` server fn (requires passcode — see §3).
- `TransferToPrimaryDialog` component, mirrored on the wallet page next to the existing "Transfer to Farming" button. Also added on the farming page.

## 3. Transaction Passcode

**Storage** — 6-digit code is hashed with bcrypt and stored server-side; never returned to the client.
- Migration: `user_passcodes` table (`user_id PK`, `passcode_hash text`, `updated_at`). RLS: users may only `SELECT` existence (a flag), never the hash. Hashing/verification happens in server functions using `bcryptjs` (already worker-safe) — no plaintext in DB or logs.
- RPC `has_passcode(uid)` returns boolean for gating UI.

**Server fns (`src/lib/passcode.functions.ts`)**
- `hasPasscode()` — boolean for current user.
- `setPasscode({ code })` — only if none set, or with current code to change. Validates 6 digits, hashes, stores.
- `verifyPasscode({ code })` — internal helper used by withdraw / P2P / farming-withdraw flows. Rate-limited (5 attempts / 15 min via a small `passcode_attempts` table or in-row counter).
- Enforcement added to existing server fns: `withdraw_request`, `p2p_send`, new `farming_to_primary`. Transfers between a user's own wallets (`primary↔farming`) skip the check.

**UI**
- `PasscodeSetupDialog` (6-cell OTP input) and `PasscodePromptDialog` (verify on action).
- After login/registration, an `_authenticated/route.tsx`–level effect checks `hasPasscode()`. If false, open a blocking modal (cannot be dismissed; logout button available). Same modal triggerable from profile page ("Transaction passcode → Set / Change").
- Withdrawal, P2P send, and Farming→Primary dialogs gain a passcode field before submit.

## Files

**New**
- `supabase/migrations/<ts>_pv_and_passcode.sql`
- `src/lib/pv.functions.ts`, `src/lib/passcode.functions.ts`
- `src/routes/_authenticated/admin/pv.tsx`
- `src/components/wallet/TransferToPrimaryDialog.tsx`
- `src/components/passcode/PasscodeSetupDialog.tsx`
- `src/components/passcode/PasscodePromptDialog.tsx`
- `src/components/passcode/PasscodeGate.tsx` (mount in `_authenticated/route.tsx`)

**Edited**
- `src/routes/_authenticated/admin/index.tsx` (+ PV tile)
- `src/routes/_authenticated/wallet.tsx`, `src/routes/_authenticated/farm.tsx` (transfer-to-primary button)
- `src/routes/_authenticated/send.tsx`, `src/routes/_authenticated/withdraw.tsx` (passcode prompt)
- `src/routes/_authenticated/profile.tsx` (set/change passcode)
- `src/routes/_authenticated/route.tsx` (mount `PasscodeGate`)
- `src/lib/farm.functions.ts`, `src/lib/p2p.functions.ts`, withdrawal request fn (passcode verification + PV awards where applicable)
- `src/lib/notification-meta.ts` (`pv_earned`, `transfer_to_primary`)

## Notes
- Passcode hash uses bcryptjs; never stored, transmitted, or logged in plaintext.
- All admin RPCs gated by `has_role(uid,'admin')`.
- PV display-only for now — no redemption logic, simple to extend later.
