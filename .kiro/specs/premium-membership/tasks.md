# Implementation Plan: Premium Membership

## Overview

Implement the paid annual Premium Membership tier end-to-end: database schema migration, PostgreSQL functions, TypeScript server functions, reusable UI components, new routes, and modifications to existing pages. The plan follows a bottom-up order — schema first, then server functions, then components, then routes, then page integrations — so every layer builds on a stable foundation.

---

## Tasks

- [x] 1. Database migration — schema and enum changes
  - [x] 1.1 Create Supabase migration file `supabase/migrations/<timestamp>_premium_membership.sql`
    - Create `membership_tier` enum with values `standard`, `premium`, `gold`, `platinum`
    - Extend `ledger_kind` enum with `premium_upgrade` and `maintenance_ref_reward`
    - Extend `notification_kind` enum with `premium_activated`, `premium_expiring`, `premium_expired`
    - Add all new columns to `profiles`: `membership_tier`, `is_premium` (generated), `premium_activated_at`, `premium_expires_at`, `premium_fee_paid`, `premium_badge`
    - Add all new columns to `app_settings` (see Requirements 2.1–2.10) with CHECK constraints
    - Create `premium_upgrades` table with PK, FK, CHECK on `paid_from_wallet`, and all audit columns
    - Enable RLS on `premium_upgrades`; create user SELECT policy and service_role-only DML policy
    - _Requirements: 1.1–1.12, 2.1–2.10, 15.4, 16.1, 16.3, 16.4_

- [x] 2. Database migration — PostgreSQL functions
  - [x] 2.1 Implement `fn_upgrade_to_premium(p_user_id uuid)` as `SECURITY DEFINER`
    - Guard: read `premium_enabled`; raise exception if disabled
    - Read `premium_fee_usdt`, `premium_duration_days`, `premium_badge_name` from `app_settings`
    - Lock wallet row with `SELECT ... FOR UPDATE`; raise if balance < fee
    - Deduct fee from `wallets`; insert `premium_upgrades` row; update `profiles` (tier, activated_at, expires_at — extend from existing when renewing, not from now()); insert `ledger_entries` (kind `premium_upgrade`); insert `notifications` (kind `premium_activated`)
    - Wrap everything in a single transaction; reject `gold`/`platinum` via application-level guard
    - _Requirements: 1.11, 3.4, 3.5, 3.6, 3.9, 15.1, 15.2, 15.7_

  - [x] 2.2 Implement `fn_expire_premium()` — idempotent nightly job
    - Find all users where `membership_tier = 'premium'` AND `premium_expires_at <= now()`
    - For each: set `membership_tier = 'standard'`, set `premium_expires_at = NULL`
    - Insert `premium_expired` notification only if one has not already been sent today (check notifications table)
    - _Requirements: 4.1, 4.2, 4.6, 15.3_

  - [x] 2.3 Implement `fn_distribute_maintenance_refs(p_fee_id uuid)`
    - Walk up to 3 upline sponsors for the paying user
    - For each generation G (1, 2, 3): check `membership_tier IN ('premium','gold','platinum')` AND `premium_expires_at > now()`; if eligible, credit `fee_amount × maintenance_ref_genG_pct / 100` to sponsor's primary wallet; insert `ledger_entries` (kind `maintenance_ref_reward`)
    - Skip missing generations silently; use `COALESCE(pct, 0)`
    - Must run within the same transaction as `pay_maintenance_fee`
    - _Requirements: 7.1–7.9_

  - [x] 2.4 Update `fn_pay_affiliate_commissions` for tiered Gen2/Gen3 commissions
    - For each upline: check if non-expired premium before crediting Gen2/Gen3
    - Standard or expired premium: credit Gen1 only at `aff_gen1_pct`
    - Active premium: credit Gen1 at `aff_gen1_pct`, Gen2 at `referral_gen2_pct`, Gen3 at `referral_gen3_pct` (all from `app_settings`; use COALESCE)
    - _Requirements: 6.1–6.7_

- [x] 3. Checkpoint — migration review
  - Apply migration to local Supabase instance (`supabase db reset` or `supabase migration up`).
  - Verify enum values, generated column `is_premium`, CHECK constraints, and RLS policies are correct. Ask the user if questions arise.

- [x] 4. TypeScript types and pure formula helpers
  - [x] 4.1 Create TypeScript types in `src/lib/premium.functions.ts` (or a co-located `premium.types.ts` re-exported from it)
    - Define `MembershipTier`, `PremiumStatus`, `PremiumBenefitsSnapshot`, `PremiumConfig`, `PremiumAdminSettings`, `PremiumAdminSettingsInput`, `PremiumMetrics`, `PremiumError`
    - _Requirements: 11.1–11.6, 14.2_

  - [x] 4.2 Extract and implement pure formula helper functions (no DB I/O) for property testing
    - `computeFarmingReward(base, bonusPct, amount, isPremiumActive): number`
    - `computeFarmingRewardWithBooster(base, bonusPct, boosterMul, amount, isPremiumActive): number`
    - `computeReferralCommission(reapAmount, genGPct, generation, isUplinePremiumActive): number`
    - `computeMaintenanceRefReward(feeAmount, genGPct, isUplinePremiumActive): number`
    - `computeWithdrawalFee(amount, standardPct, premiumPct, isPremiumActive): number`
    - `computeDaysLeft(expiresAt: string | null): number`
    - Use `COALESCE`-equivalent (`?? 0`) for any nullable pct parameter
    - _Requirements: 5.1–5.7, 6.1–6.7, 7.1–7.8, 8.1–8.7, 4.4, 4.5_

  - [x] 4.3 Write property-based tests for formula helpers — Properties 9–13
    - **Property 9: Premium farming reward formula** — `computeFarmingReward` with premium active vs. standard
    - **Property 10: Booster stacks on top of premium bonus** — `computeFarmingRewardWithBooster`
    - **Property 11: Tier-based referral commission formula** — `computeReferralCommission` for all 3 generations × tier states
    - **Property 12: Maintenance fee referral reward formula** — `computeMaintenanceRefReward` for all 3 generations × tier states
    - **Property 13: Tier-based withdrawal fee formula** — `computeWithdrawalFee` for both tier states
    - Use `fc.float`, `fc.constantFrom`, `fc.integer` generators as described in the design
    - Tag each test: `// Feature: premium-membership, Property N: <property text>`
    - **Validates: Requirements 5.1, 5.2, 5.4, 5.7, 6.1–6.6, 7.1–7.8, 8.1–8.3, 8.7**
    - _File: `src/lib/premium.functions.test.ts`_

- [x] 5. Server functions — `src/lib/premium.functions.ts`
  - [x] 5.1 Implement `getPremiumConfig()` (unauthenticated)
    - Read all `PremiumConfig` fields from `app_settings`; return safe defaults if row missing
    - _Requirements: 11.2_

  - [x] 5.2 Implement `getPremiumStatus()` (authenticated)
    - Read `profiles` + `app_settings`; compute `days_left` via `computeDaysLeft`; return inline-expired-as-standard if `days_left <= 0`
    - _Requirements: 4.4, 4.5, 11.1_

  - [x] 5.3 Write property-based test for `getPremiumStatus` days_left — Property 8
    - **Property 8: `getPremiumStatus` days_left computation**
    - Generate arbitrary `expires_at` dates (past and future); assert `days_left = max(0, floor(...))` and tier coercion to `standard` when <= 0
    - **Validates: Requirements 4.4, 4.5**
    - _File: `src/lib/premium.functions.test.ts`_

  - [x] 5.4 Implement `upgradeToPremium()` (authenticated)
    - Call `fn_upgrade_to_premium` RPC; on success return updated `getPremiumStatus`; on failure return typed `PremiumError`
    - _Requirements: 3.4, 3.5, 3.6, 3.7, 3.9, 11.3_

  - [x] 5.5 Implement admin server functions: `adminGetPremiumSettings`, `adminUpdatePremiumSettings`, `adminGetPremiumMetrics`, `adminGrantPremium`, `adminRevokePremium`
    - All require `admin` role (use `requireSupabaseAuth` middleware)
    - `adminUpdatePremiumSettings`: validate all fields client-side before write; return field-level errors on violation; record `admin_audit_log` entry
    - `adminGetPremiumMetrics`: aggregate counts, conversion rate, total revenue, top-10 referrers
    - `adminGrantPremium`: insert `premium_upgrades` row with `amount_usdt = 0`; record `admin_audit_log`
    - `adminRevokePremium`: set `membership_tier = 'standard'`, clear `premium_expires_at`; record `admin_audit_log`
    - _Requirements: 11.4–11.8, 15.5, 15.6_

  - [x] 5.6 Write property-based test for `adminUpdatePremiumSettings` validation — Property 2
    - **Property 2: Upgrade validation rejects invalid settings inputs**
    - Generate payloads with at least one out-of-range field; assert rejection with field-level error and no persistence
    - **Validates: Requirements 2.16, 11.5**
    - _File: `src/lib/premium.functions.test.ts`_

- [x] 6. Checkpoint — server functions
  - Ensure all tests in `src/lib/premium.functions.test.ts` pass (`vitest --run`). Ask the user if questions arise.

- [x] 7. Reusable premium UI components
  - [x] 7.1 Implement `src/components/premium/PremiumBadge.tsx`
    - Accept `PremiumBadgeProps`: `name: string`, `color: string`, `expired?: boolean`, `className?: string`
    - Render badge with dynamic color; show "Expired" variant when `expired=true`
    - _Requirements: 9.7, 9.8, 16.2_

  - [x] 7.2 Implement `src/components/premium/UpgradeCTA.tsx`
    - Accept `UpgradeCTAProps`: `premiumFeeUsdt: number`, `className?: string`
    - Render call-to-action card linking to `/upgrade`
    - _Requirements: 9.2, 9.3_

- [x] 8. Notification metadata
  - [x] 8.1 Update `src/lib/notification-meta.ts`
    - Add entries for `premium_activated`, `premium_expiring`, `premium_expired`
    - Each entry includes `icon`, `tone`, and `to: '/upgrade'`
    - Match existing pattern in the file
    - _Requirements: 13.4, 13.5_

- [x] 9. New route — `/upgrade` page
  - [x] 9.1 Create `src/routes/_authenticated/upgrade.tsx`
    - Load `getPremiumConfig()` and `getPremiumStatus()` on mount
    - Standard / expired state: display fee, duration, benefits list, "Upgrade now" button with confirmation dialog (shows exact USDT deduction and expiry date)
    - Active premium state: display expiry date and "Renew" button (same confirmation flow)
    - `premium_enabled = false` state: display "Premium upgrades are not currently available" and disable both buttons
    - On upgrade success: transition to "Premium Active" state without page reload
    - _Requirements: 3.1–3.10_

  - [x] 9.2 Write unit tests for upgrade page states
    - Test: shows CTA when standard; shows Renew when active premium; shows disabled message when `premium_enabled = false`
    - Test: confirmation dialog displays correct fee and expiry date
    - _Requirements: 3.1, 3.2, 3.7, 3.8, 3.10_

- [x] 10. New route — `/admin/premium` page
  - [x] 10.1 Create `src/routes/_authenticated/admin/premium.tsx`
    - Role guard: redirect non-admin to `/dashboard`
    - Settings section: form pre-loaded from `adminGetPremiumSettings`; all fields from Requirement 2; submit calls `adminUpdatePremiumSettings`; show field-level validation errors inline
    - Metrics section: cards for Total Premium, Total Standard, Conversion Rate, Revenue; source from `adminGetPremiumMetrics`
    - Top Referrers table: display name, username, total commissions; "Revoke Premium" action per row behind confirmation dialog
    - Grant Premium form: user identifier input + days input; calls `adminGrantPremium`
    - _Requirements: 12.1–12.6_

  - [x] 10.2 Write unit tests for admin premium page
    - Test: non-admin is redirected
    - Test: settings form displays current values and shows field errors on invalid submit
    - Test: Grant Premium form calls server function with correct args
    - _Requirements: 12.1, 12.2, 12.5_

- [x] 11. Checkpoint — new routes
  - Ensure all tests pass and both new routes render without errors in the browser. Ask the user if questions arise.

- [x] 12. Modify existing pages and components
  - [x] 12.1 Update `src/routes/_authenticated/dashboard.tsx`
    - Import `PremiumBadge` and `UpgradeCTA`
    - Show `PremiumBadge` (with `name` and `color` from status) when user is active premium
    - Show `UpgradeCTA` when standard or expired premium
    - _Requirements: 9.1–9.3, 14.7_

  - [x] 12.2 Update `src/routes/_authenticated/profile.tsx`
    - Show `PremiumBadge` with formatted `premium_expires_at` for active premium members
    - Show `PremiumBadge` with `expired={true}` and expiry date for expired members
    - Show nothing premium-related for standard members
    - _Requirements: 9.4–9.6, 14.8_

  - [x] 12.3 Update `src/routes/_authenticated/withdraw.tsx`
    - Read tier-specific fee from `getPremiumStatus`
    - Display applicable fee percentage and estimated USDT fee before submission
    - _Requirements: 8.4–8.7, 14.9_

  - [x] 12.4 Update `src/routes/_authenticated/affiliate.tsx`
    - Standard / expired premium: show Gen2 and Gen3 sections locked with `—` and `UpgradeCTA`
    - Active premium: show live Gen2 and Gen3 commission totals
    - _Requirements: 6.8–6.9, 14.10_

  - [x] 12.5 Update `src/components/app-sidebar.tsx`
    - Show "Upgrade to Premium" item in the Earn group (linking to `/upgrade`) when standard or expired
    - Hide item when active premium
    - Derive visibility from session-loaded tier state; update reactively after upgrade
    - _Requirements: 10.1–10.5, 14.12_

  - [x] 12.6 Update `src/routes/_authenticated/admin/index.tsx`
    - Add "Premium" tile linking to `/admin/premium`, consistent with existing tile styling
    - _Requirements: 12.7, 14.11_

- [x] 13. Property-based tests — schema-level and lifecycle properties
  - [x] 13.1 Write property-based test for `is_premium` computed column — Property 1
    - **Property 1: `is_premium` computed column correctness**
    - Generate arbitrary `MembershipTier` values; assert `is_premium === (tier !== 'standard')`
    - **Validates: Requirements 1.3, 16.4**
    - _File: `src/lib/premium.functions.test.ts`_

  - [x] 13.2 Write property-based test for upgrade atomicity and field correctness — Property 3
    - **Property 3: Upgrade atomicity and field correctness**
    - For any wallet balance ≥ fee: assert all profile fields, upgrade row, and ledger row are set correctly after upgrade
    - **Validates: Requirements 3.4, 15.2**
    - _File: `src/lib/premium.functions.test.ts`_

  - [x] 13.3 Write property-based test for insufficient balance rejection — Property 4
    - **Property 4: Insufficient balance always rejects upgrade**
    - For any (balance, fee) where balance < fee: assert exception raised and all tables unchanged
    - **Validates: Requirements 3.5**
    - _File: `src/lib/premium.functions.test.ts`_

  - [x] 13.4 Write property-based test for renewal expiry extension — Property 5
    - **Property 5: Renewal extends from existing expiry date**
    - For any non-expired premium with `expires_at = T`: assert `new_expires_at = T + duration_days`
    - **Validates: Requirements 3.9**
    - _File: `src/lib/premium.functions.test.ts`_

  - [x] 13.5 Write property-based test for `fn_expire_premium` correctness — Property 6
    - **Property 6: Expiry function correctly transitions expired users only**
    - For any mix of expired/non-expired users: assert only expired users revert to standard
    - **Validates: Requirements 4.1**
    - _File: `src/lib/premium.functions.test.ts`_

  - [x] 13.6 Write property-based test for `fn_expire_premium` idempotency — Property 7
    - **Property 7: `fn_expire_premium` idempotency**
    - Assert second run in same UTC day produces no state changes and no duplicate notifications
    - **Validates: Requirements 4.6, 15.3**
    - _File: `src/lib/premium.functions.test.ts`_

- [x] 14. Final checkpoint — full test suite
  - Run `vitest --run` and ensure all tests pass. Verify no TypeScript errors (`tsc --noEmit`). Ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP; they validate correctness but are not required for the feature to function.
- Properties 1–8 (Tasks 13.1–13.6 and 5.3) involve either pure TypeScript logic or database state; mock the DB layer for unit runs and use a local Supabase instance for integration runs.
- Properties 9–13 (Task 4.3) test pure formula helpers — no Supabase connection required.
- All monetary values must go through `COALESCE(value, 0)` (SQL) or `?? 0` (TypeScript) to satisfy null-safety requirements 5.6, 7.8, 8.7.
- The migration must be applied before any server function tests that hit the DB.
- `fn_upgrade_to_premium` uses `SELECT ... FOR UPDATE` on the wallet row — ensure any test harness accounts for transaction isolation.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1", "2.2", "2.3", "2.4"] },
    { "id": 2, "tasks": ["4.1"] },
    { "id": 3, "tasks": ["4.2", "5.1", "5.2"] },
    { "id": 4, "tasks": ["4.3", "5.3", "5.4", "5.5"] },
    { "id": 5, "tasks": ["5.6", "7.1", "7.2", "8.1"] },
    { "id": 6, "tasks": ["9.1", "10.1"] },
    { "id": 7, "tasks": ["9.2", "10.2", "12.1", "12.2", "12.3", "12.4", "12.5", "12.6"] },
    { "id": 8, "tasks": ["13.1", "13.2", "13.3", "13.4", "13.5", "13.6"] }
  ]
}
```
