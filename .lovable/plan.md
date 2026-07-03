## Premium Membership System

Builds a full Premium tier per the spec: paid annual upgrade, expanded referral generations, higher farming returns, maintenance-fee sharing, lower withdrawal fees, admin controls, and analytics.

### 1. Database (single migration)

**New enum** `membership_tier`: `standard`, `premium`, `gold` (reserved), `platinum` (reserved).

**`profiles` — add columns**
- `membership_tier membership_tier not null default 'standard'`
- `is_premium boolean generated always as (membership_tier = 'premium') stored`
- `premium_activated_at timestamptz`
- `premium_expires_at timestamptz`
- `premium_fee_paid numeric(18,6)`
- `premium_badge text`

**`app_settings` — add columns** (single row config)
- `premium_enabled bool default true`
- `premium_fee_usdt numeric default 12`
- `premium_duration_days int default 365`
- `premium_badge_name text default 'Premium Farmer'`
- `premium_badge_color text default '#F5C518'`
- `premium_farming_bonus_pct numeric default 0.5`  *(added to base daily %)*
- `referral_gen1_pct numeric default 10` (already exists — keep)
- `referral_gen2_pct numeric default 3`
- `referral_gen3_pct numeric default 1`
- `maintenance_ref_gen1_pct numeric default 10`
- `maintenance_ref_gen2_pct numeric default 5`
- `maintenance_ref_gen3_pct numeric default 2`
- `withdrawal_fee_standard_pct numeric default 5`
- `withdrawal_fee_premium_pct numeric default 2`

**New table `premium_upgrades`** (audit trail of every purchase / renewal)
- `id, user_id, amount_usdt, paid_from_wallet (primary|farming), activated_at, expires_at, tx_ref`

**New enum extensions**
- `ledger_kind`: add `premium_upgrade`, `maintenance_ref_reward`
- `notification_kind`: add `premium_activated`, `premium_expiring`, `premium_expired`

**Functions / triggers**
- `fn_upgrade_to_premium(user_id)` — SECURITY DEFINER; charges fee from primary wallet, writes `premium_upgrades`, sets `membership_tier='premium'`, `premium_activated_at=now()`, `premium_expires_at = now()+duration`, sends notification.
- `fn_expire_premium()` — nightly job flips expired users back to `standard`.
- Rewrite `fn_pay_affiliate_commissions(...)` — pay Gen 1 for everyone; pay Gen 2/3 only when upline is Premium and unexpired.
- New `fn_distribute_maintenance_refs(fee_row)` — on maintenance_fee insert, walk 3 uplines, credit primary wallet at gen{n}_pct when upline is Premium.
- Update farming reward calc (`fn_reap_cycle` or booster helper): daily % = base + `premium_farming_bonus_pct` when premium. Boosters multiply the boosted rate too.
- Update withdrawal fee calc to branch on `is_premium`.

Grants: `SELECT` on `premium_upgrades` to owner (RLS), full to service_role. Standard grant block on new table.

### 2. Server functions (`src/lib/premium.functions.ts`)
- `getPremiumStatus()` → tier, expires_at, days_left, badge, benefits snapshot.
- `getPremiumConfig()` → public benefits/fee (for the upgrade page).
- `upgradeToPremium()` → calls RPC; returns updated status.
- Admin: `adminGetPremiumSettings`, `adminUpdatePremiumSettings`, `adminGetPremiumMetrics` (total premium, standard, conversion %, revenue, top premium referrers), `adminGrantPremium(user_id, days)`, `adminRevokePremium(user_id)`.

### 3. UI

**New route `/upgrade` (`_authenticated/upgrade.tsx`)**
- Hero, benefits list (higher returns, 3-gen referrals, maintenance rewards, lower fees, badge), fee card `12 USDT / year`, "Upgrade now" button → confirm dialog → RPC → toast + refetch.
- Shows current status if already premium (expiry date, renew button).

**Dashboard (`_authenticated/dashboard.tsx`)**
- Add Premium badge next to name when premium.
- Add "Upgrade to Premium" CTA card for standard users.

**Profile (`_authenticated/profile.tsx`)**
- Show Premium Farmer badge + expiry.

**Sidebar** — add "Upgrade to Premium" link (hidden if already premium).

**Admin**
- New `/admin/premium.tsx`: settings form (all fields above), metrics cards, table of top premium referrers, tools to grant/revoke premium for a user.
- Tile added to `admin/index.tsx`.

**Withdraw page** — show applicable fee (dynamic based on tier) so users see the premium discount.

**Affiliate page** — surface Gen 2/3 earnings; explain locked generations for standard users with an upgrade CTA.

### 4. Files

**New**
- `supabase/migrations/<ts>_premium_membership.sql`
- `src/lib/premium.functions.ts`
- `src/routes/_authenticated/upgrade.tsx`
- `src/routes/_authenticated/admin/premium.tsx`
- `src/components/premium/PremiumBadge.tsx`
- `src/components/premium/UpgradeCTA.tsx`

**Edited**
- `src/routes/_authenticated/dashboard.tsx` (badge + CTA)
- `src/routes/_authenticated/profile.tsx` (badge, expiry)
- `src/routes/_authenticated/withdraw.tsx` (dynamic fee display)
- `src/routes/_authenticated/affiliate.tsx` (gen2/3 surfacing)
- `src/routes/_authenticated/admin/index.tsx` (tile)
- `src/components/app-sidebar.tsx` (Upgrade link)
- `src/lib/notification-meta.ts` (new kinds)

### Notes
- Premium expiry check runs both nightly (`fn_expire_premium`) and inline in `getPremiumStatus` for immediate accuracy.
- All percentages configurable — no hardcoding.
- `premium_upgrades` gives a clean audit trail for revenue analytics.
- Schema reserves `gold`/`platinum` in the enum so future tiers are additive.

Ready to implement — shall I proceed?
