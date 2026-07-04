# Requirements Document

## Introduction

The Premium Membership feature introduces a paid annual tier for the VFarmers platform. Users may upgrade from the default Standard Farmer tier to Premium Farmer by paying a configurable fee (default 12 USDT/year). Premium members receive enhanced farming returns, referral commissions across three downline generations, a share of maintenance fees collected from their referrals, a lower withdrawal fee, and a visible premium badge. Super Admins configure all monetary parameters through new settings panels and gain analytics metrics on membership adoption and revenue. The schema is designed to accommodate future tiers (Gold Farmer, Platinum Farmer) without structural redesign.

This feature touches the database (new enum, new columns on `profiles` and `app_settings`, new `premium_upgrades` audit table, extended enum values), existing Supabase database functions (farming reward calculation, affiliate commission distribution, maintenance fee distribution, withdrawal fee calculation), new server functions in `src/lib/premium.functions.ts`, new UI routes and components, and modifications to several existing pages and the app sidebar.

---

## Glossary

- **Standard_Farmer**: The default membership tier assigned to every new user. Provides base farming returns, Generation 1 referral commissions only, 0% maintenance fee referral rewards, and the standard withdrawal fee.
- **Premium_Farmer**: The paid annual membership tier. Provides enhanced farming returns, Generation 1–3 referral commissions, maintenance fee referral rewards from Generations 1–3, and the premium withdrawal fee.
- **Membership_Tier**: A database enum with values `standard`, `premium`, `gold` (reserved), `platinum` (reserved) stored on `profiles.membership_tier`.
- **Premium_Badge**: A configurable label and color displayed on a user's dashboard, profile, and public-facing pages when the user holds the Premium_Farmer tier.
- **Premium_Upgrade**: A single payment transaction that activates the Premium_Farmer tier for a configurable number of days (default 365). Each upgrade is recorded in the `premium_upgrades` audit table.
- **Premium_Farming_Bonus_Pct**: A configurable percentage added on top of the base farming cycle reward for Premium_Farmer users. Stored in `app_settings.premium_farming_bonus_pct`.
- **Base_Farm_Return**: The per-cycle reward percentage configured in `app_settings` and applied via boosters.
- **Referral_Generation**: The ordinal position of a downline user relative to a sponsor. Generation 1 (direct referral), Generation 2 (referral's referral), Generation 3 (three levels below the sponsor).
- **Maintenance_Ref_Reward**: A share of a downline member's maintenance fee payment credited to the upline sponsor. Configurable independently for Generations 1, 2, and 3.
- **Primary_Wallet**: The USDT-denominated wallet used for deposits, withdrawals, P2P transfers, maintenance fees, and premium upgrade payments.
- **Farming_Wallet**: The Seed-denominated wallet used for farming cycles.
- **Admin_Settings**: The admin-accessible `app_settings` single-row configuration table and its associated UI at `/admin/settings` and `/admin/premium`.
- **fn_upgrade_to_premium**: The `SECURITY DEFINER` PostgreSQL function that charges the premium fee, records the upgrade, updates the user's tier, and sends a notification.
- **fn_expire_premium**: A nightly scheduled PostgreSQL function that reverts expired Premium_Farmer users back to Standard_Farmer.
- **fn_pay_affiliate_commissions**: The existing PostgreSQL function that distributes referral commissions on cycle reap events; to be rewritten to respect tier-gated generation access.
- **fn_distribute_maintenance_refs**: A new PostgreSQL function triggered on maintenance fee payment that credits Maintenance_Ref_Rewards to eligible Premium_Farmer uplines.
- **Super_Admin**: A platform operator with the `admin` role, able to access the Admin Console and configure all settings.
- **Upgrade_Page**: The authenticated route at `/upgrade` that presents premium benefits and allows a user to initiate a Premium_Upgrade.

---

## Requirements

### Requirement 1: Membership Tier Data Model

**User Story:** As a Super_Admin, I want membership tier data stored cleanly in the database, so that all system components can reliably derive a user's current tier and expiry status.

#### Acceptance Criteria

1. THE Database SHALL define a `membership_tier` enum with values `standard`, `premium`, `gold`, and `platinum`.
2. THE `profiles` table SHALL contain a `membership_tier` column of type `membership_tier` with a default value of `standard` and a `NOT NULL` constraint.
3. THE `profiles` table SHALL contain an `is_premium` column as a generated boolean stored column that equals `true` when `membership_tier` is `premium`, `gold`, or `platinum`, and `false` otherwise.
4. THE `profiles` table SHALL contain a `premium_activated_at` column of type `timestamptz` that is nullable; it SHALL be `NULL` when `membership_tier` is `standard`.
5. THE `profiles` table SHALL contain a `premium_expires_at` column of type `timestamptz` that is nullable; a `NULL` value explicitly means no active premium expiry is set (i.e. the user is Standard_Farmer).
6. THE `profiles` table SHALL contain a `premium_fee_paid` column of type `numeric(18,6)` that is nullable, recording the USDT amount paid at the most recent upgrade.
7. THE `profiles` table SHALL contain a `premium_badge` column of type `text` that is nullable, storing the badge label snapshot at upgrade time.
8. THE Database SHALL define a `premium_upgrades` table with columns: `id` (UUID primary key), `user_id` (FK to `profiles.id`, NOT NULL), `amount_usdt` (numeric(18,6), NOT NULL), `paid_from_wallet` (text NOT NULL, constrained to values `primary` or `farming`), `tier` (type `membership_tier`, NOT NULL), `activated_at` (timestamptz, NOT NULL), `expires_at` (timestamptz, NOT NULL), and `tx_ref` (text, nullable).
9. THE `ledger_kind` enum SHALL be extended with values `premium_upgrade` and `maintenance_ref_reward`.
10. THE `notification_kind` enum SHALL be extended with values `premium_activated`, `premium_expiring`, and `premium_expired`.
11. THE `gold` and `platinum` values of the `membership_tier` enum SHALL NOT be assignable by any user-facing RPC, server function, or admin function in the current release; a database-level CHECK constraint or equivalent enforcement SHALL reject any attempt to set `membership_tier` to `gold` or `platinum` via application code paths.
12. WHEN a new user profile is created, THE `membership_tier` column SHALL default to `standard` and `premium_expires_at` SHALL default to `NULL`.


---

### Requirement 2: Admin Configuration — Premium Settings

**User Story:** As a Super_Admin, I want to configure all premium membership parameters from Admin Settings, so that no monetary or display value is hardcoded in the application.

#### Acceptance Criteria

1. THE `app_settings` table SHALL contain a `premium_enabled` column of type `boolean` with default `true`.
2. THE `app_settings` table SHALL contain a `premium_fee_usdt` column of type `numeric` with default `12`; the value SHALL be ≥ 0.
3. THE `app_settings` table SHALL contain a `premium_duration_days` column of type `integer` with default `365`; the value SHALL be ≥ 1.
4. THE `app_settings` table SHALL contain a `premium_badge_name` column of type `text` with default `'Premium Farmer'`.
5. THE `app_settings` table SHALL contain a `premium_badge_color` column of type `text` with default `'#F5C518'`.
6. THE `app_settings` table SHALL contain a `premium_farming_bonus_pct` column of type `numeric` with default `0.5`; the value SHALL be between 0 and 100 inclusive.
7. THE `app_settings` table SHALL contain a `withdrawal_fee_standard_pct` column of type `numeric` with default `5`; the value SHALL be between 0 and 100 inclusive.
8. THE `app_settings` table SHALL contain a `withdrawal_fee_premium_pct` column of type `numeric` with default `2`; the value SHALL be between 0 and 100 inclusive.
9. THE `app_settings` table SHALL contain `referral_gen2_pct` and `referral_gen3_pct` columns of type `numeric` each defaulting to `0`; both values SHALL be between 0 and 100 inclusive.
10. THE `app_settings` table SHALL contain `maintenance_ref_gen1_pct`, `maintenance_ref_gen2_pct`, and `maintenance_ref_gen3_pct` columns of type `numeric`, each defaulting to `0`; all values SHALL be between 0 and 100 inclusive.
11. WHEN a Super_Admin submits the Admin Premium Settings form, THE System SHALL update all premium-related `app_settings` fields (criteria 1–10) in a single atomic database write.
12. IF `premium_enabled` is `false`, THEN THE Upgrade_Page SHALL render an "upgrades unavailable" message and the "Upgrade now" and "Renew" buttons SHALL be disabled and non-interactive.
13. IF `premium_enabled` is `false` AND `fn_upgrade_to_premium` is called, THEN THE function SHALL raise an exception with the message `'Premium membership upgrades are currently disabled'` and SHALL make no changes to the database.
14. WHEN `adminUpdatePremiumSettings` is called by a user without the `admin` role, THE server function SHALL return an `Unauthorized` error and SHALL NOT apply any settings change.
15. THE `premium_farming_bonus_pct` value SHALL NOT be hardcoded anywhere in the application codebase; THE System SHALL always read it from `app_settings` at runtime.
16. WHEN `adminUpdatePremiumSettings` receives a percentage value outside the range 0–100 or a `premium_fee_usdt` value less than 0 or a `premium_duration_days` value less than 1, THE server function SHALL return a validation error identifying the invalid field and SHALL NOT persist any of the submitted values.


---

### Requirement 3: Premium Upgrade Flow

**User Story:** As a Standard_Farmer, I want to upgrade to Premium by paying the annual fee from my Primary Wallet, so that I can immediately access enhanced platform benefits.

#### Acceptance Criteria

1. WHEN a Standard_Farmer navigates to `/upgrade`, THE Upgrade_Page SHALL display the current `premium_fee_usdt` amount and `premium_duration_days` sourced live from `app_settings`.
2. THE Upgrade_Page SHALL list all Premium_Farmer benefits: enhanced farming returns, Generation 1–3 referral commissions, maintenance fee referral rewards, reduced withdrawal fee, and the Premium_Badge.
3. WHEN a Standard_Farmer clicks "Upgrade now", THE System SHALL present a confirmation dialog showing the exact USDT fee that will be deducted from the Primary_Wallet and the resulting expiry date.
4. WHEN a Standard_Farmer confirms the upgrade and the Primary_Wallet balance is sufficient, THE `fn_upgrade_to_premium` function SHALL atomically: deduct `premium_fee_usdt` from the user's Primary_Wallet; insert a row into `premium_upgrades`; set `profiles.membership_tier` to `premium`; set `profiles.premium_activated_at` to the current timestamp; set `profiles.premium_expires_at` to `now() + (premium_duration_days * interval '1 day')`; set `profiles.premium_fee_paid` to the fee amount; set `profiles.premium_badge` to the current `premium_badge_name`; and insert a `ledger_kind = 'premium_upgrade'` entry in `ledger_entries`.
5. IF a user's Primary_Wallet balance is less than `premium_fee_usdt` at confirmation time, THEN THE `fn_upgrade_to_premium` function SHALL reject the request, return the error `'Insufficient Primary Wallet balance'`, and make no changes to any table.
6. WHEN the upgrade succeeds, THE System SHALL send a `premium_activated` notification to the upgrading user.
7. WHEN the upgrade succeeds, THE Upgrade_Page SHALL transition to a "Premium Active" state showing the `premium_expires_at` date without requiring a page reload.
8. WHEN a Premium_Farmer with a non-expired membership navigates to `/upgrade`, THE Upgrade_Page SHALL display the current expiry date and a "Renew" button, not the initial upgrade flow.
9. WHEN a Premium_Farmer clicks "Renew" and confirms and the wallet balance is sufficient, THE `fn_upgrade_to_premium` function SHALL extend `premium_expires_at` by `premium_duration_days` from the existing `premium_expires_at` value (not from `now()`), insert a new row in `premium_upgrades`, and deduct the fee.
10. IF `premium_enabled` is `false`, THEN THE Upgrade_Page SHALL display `'Premium upgrades are not currently available'` and both the "Upgrade now" and "Renew" buttons SHALL be disabled.

---

### Requirement 4: Premium Expiry

**User Story:** As a platform operator, I want Premium memberships to expire automatically after the configured duration, so that users must renew annually to retain premium benefits.

#### Acceptance Criteria

1. WHEN the nightly schedule triggers `fn_expire_premium` (run at or shortly after UTC midnight), THE function SHALL set `profiles.membership_tier = 'standard'` and clear `profiles.premium_expires_at` to `NULL` for every user whose `premium_expires_at <= now()`.
2. WHEN `fn_expire_premium` transitions a user to `standard`, THE System SHALL send a `premium_expired` notification to that user within the same function execution.
3. WHEN a Premium_Farmer's `premium_expires_at` is within 7 calendar days of the current timestamp, THE System SHALL send a `premium_expiring` notification to that user no more than once per 24-hour window.
4. THE `getPremiumStatus` server function SHALL compute `days_left` as `FLOOR((premium_expires_at - now()) / interval '1 day')` and SHALL return `tier = 'standard'` and `days_left = 0` when the computed value is 0 or negative, regardless of whether `fn_expire_premium` has run.
5. WHEN a user's premium status is evaluated inline and `premium_expires_at <= now()`, THE System SHALL treat and return the user as Standard_Farmer without waiting for the nightly expiry job.
6. THE `fn_expire_premium` function SHALL be idempotent: running it multiple times within the same UTC day SHALL NOT send duplicate `premium_expired` notifications to users already reverted to `standard` in that day's run.


---

### Requirement 5: Premium Farming Bonus

**User Story:** As a Premium_Farmer, I want to receive higher farming returns than Standard Farmers, so that my premium membership provides tangible financial benefit.

#### Acceptance Criteria

1. WHEN a farming cycle is reaped by a Premium_Farmer with a non-expired membership, THE farming reward calculation SHALL apply the formula: `Reward = Base_Farm_Return × (1 + premium_farming_bonus_pct / 100)`.
2. WHEN a farming cycle is reaped by a Standard_Farmer, THE farming reward calculation SHALL apply only the `Base_Farm_Return` with no bonus multiplier.
3. THE `premium_farming_bonus_pct` SHALL be read from `app_settings` at the time the cycle is reaped; it SHALL NOT be stored in the cycle record at start time.
4. WHEN a booster is applied to a farming cycle for a Premium_Farmer, THE booster multiplier SHALL be applied to the full premium-boosted rate (i.e. boosters stack on top of the premium bonus).
5. THE System SHALL NOT hardcode any numeric value for the Premium Farming Bonus; THE farming reward function SHALL always read `premium_farming_bonus_pct` from `app_settings`.
6. IF `premium_farming_bonus_pct` is `NULL` in `app_settings` at reap time, THE System SHALL treat it as `0` and apply no bonus.
7. WHEN a Premium_Farmer's membership has expired at the time of reap, THE System SHALL apply only the `Base_Farm_Return` with no bonus, identical to the Standard_Farmer calculation.

---

### Requirement 6: Tiered Referral Commissions

**User Story:** As a Premium_Farmer, I want to earn referral commissions from three downline generations, so that my expanded network generates greater income than a Standard Farmer receives.

#### Acceptance Criteria

1. WHEN a cycle-reap commission event is triggered for a Standard_Farmer's Generation 1 downline, THE `fn_pay_affiliate_commissions` function SHALL credit the Standard_Farmer with a commission calculated as `reap_amount × aff_gen1_pct / 100`.
2. WHEN a cycle-reap commission event is triggered for a Standard_Farmer's Generation 2 or Generation 3 downline, THE `fn_pay_affiliate_commissions` function SHALL NOT credit the Standard_Farmer with any commission for those generations.
3. WHEN a cycle-reap commission event is triggered for a Premium_Farmer's Generation 1 downline, THE `fn_pay_affiliate_commissions` function SHALL credit the Premium_Farmer at `aff_gen1_pct`.
4. WHEN a cycle-reap commission event is triggered for a Premium_Farmer's Generation 2 downline, THE `fn_pay_affiliate_commissions` function SHALL credit the Premium_Farmer at `referral_gen2_pct` read from `app_settings`.
5. WHEN a cycle-reap commission event is triggered for a Premium_Farmer's Generation 3 downline, THE `fn_pay_affiliate_commissions` function SHALL credit the Premium_Farmer at `referral_gen3_pct` read from `app_settings`.
6. IF an upline is Premium_Farmer but `premium_expires_at <= now()` at commission time, THEN THE System SHALL treat that upline as Standard_Farmer and SHALL NOT pay Gen 2 or Gen 3 commissions to them.
7. THE `aff_gen1_pct`, `referral_gen2_pct`, and `referral_gen3_pct` values SHALL be read from `app_settings` at payout time; they SHALL NOT be hardcoded.
8. WHEN a Standard_Farmer views the Affiliate page, THE page SHALL display Generation 2 and Generation 3 earnings sections in a locked/disabled state showing `—` rather than real totals, accompanied by an "Upgrade to Premium" CTA.
9. WHEN a Premium_Farmer views the Affiliate page, THE page SHALL display live Generation 2 and Generation 3 commission totals alongside the Generation 1 total.


---

### Requirement 7: Maintenance Fee Referral Rewards

**User Story:** As a Premium_Farmer, I want to receive a configurable share of maintenance fees paid by my downline (Generations 1–3), so that my premium membership rewards me for building an active network.

#### Acceptance Criteria

1. WHEN a user pays a maintenance fee, THE `fn_distribute_maintenance_refs` function SHALL walk up to three upline sponsors of the paying user.
2. WHEN an upline sponsor at Generation 1 is a Premium_Farmer with a non-expired membership, THE function SHALL credit that sponsor's Primary_Wallet with `(fee_amount × maintenance_ref_gen1_pct / 100)` and insert a `ledger_kind = 'maintenance_ref_reward'` entry in `ledger_entries`.
3. WHEN an upline sponsor at Generation 2 is a Premium_Farmer with a non-expired membership, THE function SHALL credit that sponsor's Primary_Wallet with `(fee_amount × maintenance_ref_gen2_pct / 100)` and insert a corresponding `ledger_kind = 'maintenance_ref_reward'` entry.
4. WHEN an upline sponsor at Generation 3 is a Premium_Farmer with a non-expired membership, THE function SHALL credit that sponsor's Primary_Wallet with `(fee_amount × maintenance_ref_gen3_pct / 100)` and insert a corresponding `ledger_kind = 'maintenance_ref_reward'` entry.
5. WHEN an upline sponsor at any generation is a Standard_Farmer or is a Premium_Farmer with an expired membership, THE function SHALL not credit that sponsor and SHALL not insert a ledger entry for that generation.
6. WHEN the referral chain contains fewer than 3 uplines, THE function SHALL credit only the available uplines and SHALL silently skip the missing generations without error.
7. THE `maintenance_ref_gen1_pct`, `maintenance_ref_gen2_pct`, and `maintenance_ref_gen3_pct` values SHALL be read from `app_settings` at distribution time.
8. IF any maintenance referral percentage in `app_settings` is `NULL`, THE System SHALL treat it as `0` and make no credit for that generation.
9. THE `fn_distribute_maintenance_refs` function SHALL execute within the same atomic database transaction as the `pay_maintenance_fee` operation; if any part fails, the entire transaction SHALL roll back.

---

### Requirement 8: Tiered Withdrawal Fee

**User Story:** As a user, I want the withdrawal fee applied to my request to reflect my membership tier, so that Premium_Farmer users pay a lower fee as part of their membership benefit.

#### Acceptance Criteria

1. WHEN a Standard_Farmer submits a withdrawal request, THE withdrawal fee deducted SHALL equal `withdrawal_amount × withdrawal_fee_standard_pct / 100`.
2. WHEN a Premium_Farmer with a non-expired membership submits a withdrawal request, THE withdrawal fee deducted SHALL equal `withdrawal_amount × withdrawal_fee_premium_pct / 100`.
3. WHEN a Premium_Farmer's membership has expired at withdrawal time, THE withdrawal fee deducted SHALL equal `withdrawal_amount × withdrawal_fee_standard_pct / 100`.
4. WHEN a user views the Withdraw page, THE page SHALL display the applicable fee percentage and the estimated fee amount in USDT before the user submits the request.
5. THE `withdrawal_fee_standard_pct` and `withdrawal_fee_premium_pct` values SHALL be read from `app_settings` at request processing time; they SHALL NOT be hardcoded.
6. THE existing single `withdraw_fee_pct` field in `app_settings` SHALL be superseded by `withdrawal_fee_standard_pct` and `withdrawal_fee_premium_pct`; all withdrawal fee logic SHALL be updated to read from the tier-specific fields.
7. IF either tier-specific fee field is `NULL` in `app_settings`, THE System SHALL fall back to `0` for that tier's fee calculation.


---

### Requirement 9: Premium Badge Display

**User Story:** As a Premium_Farmer, I want my premium status and badge to be visible on my dashboard, profile, and public pages, so that other users and I can immediately recognise the premium tier.

#### Acceptance Criteria

1. WHEN a Premium_Farmer with a non-expired membership views the Dashboard, THE Dashboard SHALL display a Premium Badge next to the user's name using the current `premium_badge_name` and `premium_badge_color` values from `app_settings`.
2. WHEN a Standard_Farmer views the Dashboard, THE Dashboard SHALL display an "Upgrade to Premium" CTA card in place of the Premium Badge.
3. WHEN a Premium_Farmer whose membership has expired views the Dashboard, THE Dashboard SHALL display the "Upgrade to Premium" CTA card, not the badge.
4. WHEN a Premium_Farmer with a non-expired membership views the Profile page, THE Profile_Page SHALL display the Premium Badge and the formatted `premium_expires_at` date.
5. WHEN a Premium_Farmer whose membership has expired views the Profile page, THE Profile_Page SHALL display the badge with an "Expired" indicator and the `premium_expires_at` date.
6. WHEN a Standard_Farmer views the Profile page, THE Profile_Page SHALL not display any premium badge or expiry date.
7. THE Premium Badge component SHALL accept `name` and `color` as required props and SHALL render consistently across Dashboard, Profile, and any future pages.
8. WHEN `premium_badge_name` or `premium_badge_color` is updated by a Super_Admin, THE badge display SHALL reflect the updated values on the next data fetch or page reload.

---

### Requirement 10: Sidebar Navigation

**User Story:** As a Standard_Farmer, I want a prominent "Upgrade to Premium" link in the sidebar, so that the upgrade path is discoverable at all times.

#### Acceptance Criteria

1. WHEN a Standard_Farmer is authenticated, THE App_Sidebar SHALL display an "Upgrade to Premium" navigation item in the Earn group linking to `/upgrade`.
2. WHEN a Premium_Farmer with a non-expired membership is authenticated, THE App_Sidebar SHALL NOT display the "Upgrade to Premium" navigation item.
3. WHEN a Premium_Farmer whose membership has expired is authenticated, THE App_Sidebar SHALL display the "Upgrade to Premium" navigation item.
4. WHEN a user completes an upgrade on the `/upgrade` page, THE sidebar SHALL update to hide the "Upgrade to Premium" item without requiring a full page reload.
5. THE sidebar item visibility SHALL be derived from the user's current membership tier and expiry state fetched at session load.

---

### Requirement 11: Server Functions

**User Story:** As a developer, I want a dedicated set of server functions for premium membership operations, so that the UI layer has a clean, typed interface for all premium-related data and actions.

#### Acceptance Criteria

1. THE `getPremiumStatus` server function SHALL return: `tier` (Membership_Tier), `expires_at` (nullable ISO timestamp), `days_left` (integer ≥ 0), `badge_name`, `badge_color`, and a `benefits` snapshot of current configured values from `app_settings`.
2. THE `getPremiumConfig` server function SHALL return the current `premium_fee_usdt`, `premium_duration_days`, `premium_badge_name`, `premium_badge_color`, `premium_farming_bonus_pct`, `referral_gen2_pct`, `referral_gen3_pct`, `withdrawal_fee_premium_pct`, and `premium_enabled` without requiring authentication.
3. THE `upgradeToPremium` server function SHALL call the `fn_upgrade_to_premium` RPC and return the updated `getPremiumStatus` result on success, or a typed error on failure.
4. THE `adminGetPremiumSettings` server function SHALL return all premium-related `app_settings` fields and SHALL require the `admin` role.
5. THE `adminUpdatePremiumSettings` server function SHALL validate all fields (fee ≥ 0, percentages 0–100, duration ≥ 1) before writing; it SHALL require the `admin` role and reject invalid values with a field-level error.
6. THE `adminGetPremiumMetrics` server function SHALL return: total Premium_Farmer count, total Standard_Farmer count, premium conversion rate, total USDT revenue from `premium_upgrades`, and the top 10 users by total commissions earned as a Premium_Farmer.
7. THE `adminGrantPremium` server function SHALL grant Premium status for a specified number of days without charging the user's wallet, writing a `premium_upgrades` row with `amount_usdt = 0`; it SHALL require the `admin` role.
8. THE `adminRevokePremium` server function SHALL immediately set `membership_tier = 'standard'` and `premium_expires_at = NULL` for the target user; it SHALL require the `admin` role.
9. ALL server functions that mutate user data SHALL use the `requireSupabaseAuth` middleware and verify role permissions before executing any database write.


---

### Requirement 12: Admin Premium Page

**User Story:** As a Super_Admin, I want a dedicated Admin Premium page with settings, metrics, and user management tools, so that I can monitor and control the premium membership system from one place.

#### Acceptance Criteria

1. THE `/admin/premium` route SHALL be accessible only to users with the `admin` role; non-admin or unauthenticated requests SHALL redirect to `/dashboard`.
2. THE Admin_Premium_Page SHALL display a settings form pre-loaded with current values from `adminGetPremiumSettings`, covering all fields in Requirement 2.
3. THE Admin_Premium_Page SHALL display metric cards: Total Premium Members, Total Standard Members, Premium Conversion Rate, and Revenue Generated from Membership Fees, sourced from `adminGetPremiumMetrics`.
4. THE Admin_Premium_Page SHALL display a Top Premium Referrers table showing display name, username, and total commission earned.
5. THE Admin_Premium_Page SHALL provide a "Grant Premium" form accepting a user identifier and a number of days, calling `adminGrantPremium`.
6. THE Admin_Premium_Page SHALL provide a "Revoke Premium" action per row in the top referrers table, calling `adminRevokePremium` after a confirmation dialog.
7. THE Admin Console home page (`/admin`) SHALL display a "Premium" tile linking to `/admin/premium`, consistent with existing tile styling.

---

### Requirement 13: Notifications

**User Story:** As a user, I want to receive in-app notifications for premium membership lifecycle events, so that I am informed about activation, approaching expiry, and expiry of my membership.

#### Acceptance Criteria

1. WHEN a Premium_Upgrade completes successfully, THE Notification_System SHALL send a `premium_activated` notification to the upgrading user containing the `premium_expires_at` date.
2. WHEN a Premium_Farmer's `premium_expires_at` is within 7 days of the current timestamp, THE Notification_System SHALL send a `premium_expiring` notification to that user no more than once per 24-hour window.
3. WHEN `fn_expire_premium` transitions a user to Standard_Farmer, THE Notification_System SHALL send a `premium_expired` notification to that user.
4. THE `notification-meta.ts` module SHALL define `icon`, `tone`, and `to` (deep-link) entries for `premium_activated`, `premium_expiring`, and `premium_expired`, consistent with existing notification meta patterns.
5. THE `premium_activated`, `premium_expiring`, and `premium_expired` notifications SHALL each deep-link to `/upgrade`.

---

### Requirement 14: Code Organisation

**User Story:** As a developer, I want all premium-related code organized in clearly named files consistent with the existing project structure, so that the codebase remains navigable and maintainable.

#### Acceptance Criteria

1. THE System SHALL include a Supabase migration at `supabase/migrations/<timestamp>_premium_membership.sql` containing all DDL and function changes from Requirements 1, 2, 4, 5, 6, 7, and 8.
2. THE System SHALL include `src/lib/premium.functions.ts` containing all server functions from Requirement 11.
3. THE System SHALL include `src/routes/_authenticated/upgrade.tsx` implementing the Upgrade_Page per Requirement 3.
4. THE System SHALL include `src/routes/_authenticated/admin/premium.tsx` implementing the Admin_Premium_Page per Requirement 12.
5. THE System SHALL include `src/components/premium/PremiumBadge.tsx` implementing the reusable badge component per Requirement 9.
6. THE System SHALL include `src/components/premium/UpgradeCTA.tsx` implementing the upgrade CTA card per Requirement 9 criterion 2.
7. THE `src/routes/_authenticated/dashboard.tsx` SHALL be modified per Requirements 9 and 10.
8. THE `src/routes/_authenticated/profile.tsx` SHALL be modified per Requirement 9.
9. THE `src/routes/_authenticated/withdraw.tsx` SHALL be modified per Requirement 8.
10. THE `src/routes/_authenticated/affiliate.tsx` SHALL be modified per Requirement 6 criteria 8–9.
11. THE `src/routes/_authenticated/admin/index.tsx` SHALL be modified to add the Premium tile per Requirement 12 criterion 7.
12. THE `src/components/app-sidebar.tsx` SHALL be modified per Requirement 10.
13. THE `src/lib/notification-meta.ts` SHALL be modified to add entries per Requirement 13 criterion 4.

---

### Requirement 15: Security and Data Integrity

**User Story:** As a platform operator, I want the premium membership system to be secure and consistent, so that fees cannot be bypassed and tier state cannot be corrupted.

#### Acceptance Criteria

1. THE `fn_upgrade_to_premium` function SHALL be defined with `SECURITY DEFINER` and SHALL validate wallet balance before deducting any funds.
2. THE `fn_upgrade_to_premium` function SHALL execute wallet deduction, `premium_upgrades` insert, `profiles` update, and `ledger_entries` insert within a single atomic transaction; any failure SHALL roll back all changes.
3. THE `fn_expire_premium` function SHALL be idempotent; multiple executions within the same UTC day SHALL NOT produce duplicate notifications or double-revert already-standard users.
4. THE `premium_upgrades` table SHALL have RLS: each user can SELECT only their own rows; INSERT/UPDATE/DELETE is restricted to `service_role`.
5. THE `adminGrantPremium` and `adminRevokePremium` server functions SHALL each record an entry in `admin_audit_log` with `action`, `actor_id`, and `target_user_id`.
6. WHEN `adminUpdatePremiumSettings` is called, THE System SHALL record an entry in `admin_audit_log`.
7. THE `fn_upgrade_to_premium` function SHALL verify `premium_enabled = true` in `app_settings` at execution time and SHALL raise an exception if premium is disabled.

---

### Requirement 16: Future-Tier Extensibility

**User Story:** As a product architect, I want the database schema and server layer to accommodate future membership tiers without structural redesign, so that Gold Farmer and Platinum Farmer can be activated by adding configuration rather than rewriting the schema.

#### Acceptance Criteria

1. THE `membership_tier` enum SHALL include `gold` and `platinum` values from day one.
2. THE Premium Badge component SHALL accept `name` and `color` as props, not constants, so any future tier can reuse it.
3. THE `premium_upgrades` table SHALL include a `tier` column of type `membership_tier` so future tiers share the same audit table.
4. THE `is_premium` generated column SHALL evaluate to `true` for `gold` and `platinum` tiers as well, so premium-gated logic automatically applies to future higher tiers.
