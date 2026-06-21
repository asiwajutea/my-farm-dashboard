
# Achievement System

A full gamification layer: 20 categories (~80 achievements), progress tracking, unlock notifications, Seed + PV rewards, levels, leaderboards, profile showcase, and admin CRUD.

## 1. Database (single migration)

### Enums
- Extend `notification_kind` with `achievement_unlocked`, `level_up`.
- Extend `ledger_kind` with `achievement_reward` (Seed payouts).
- New `achievement_category` enum: `welcome, deposit, farming, streak, earnings, referral, active_referral, referral_earnings, premium, p2p, escrow, coupon, withdrawal, booster, loyalty, account_value, rank, social, hidden, legendary`.
- New `achievement_metric` enum — the value a threshold is compared against (e.g. `deposit_total_usdt`, `cycles_completed`, `farming_streak_days`, `seeds_earned_total`, `referrals_total`, `active_referrals`, `referral_earnings_seed`, `premium_days`, `p2p_count`, `escrow_count`, `coupons_redeemed`, `withdraw_total_usdt`, `boosters_used`, `member_days`, `account_value_seed`, `rank_position`, `shares_count`, `signups_from_shares`, `night_farms`, `early_farms`, `lucky_seven`, `weekend_streak_month`, `anniversary_logins`, `user_ordinal`).

### Tables

**`achievements`** — admin-managed catalog.
- `code` (unique slug), `category`, `title`, `description`, `icon` (emoji or lucide name), `metric`, `threshold` numeric, `comparator` (`gte`/`eq`), `points` int (toward level), `reward_seed` numeric default 0, `reward_pv` numeric default 0, `title_unlocked` text nullable (exclusive title granted), `is_hidden` bool, `active` bool, `sort_order`. Seeded with the full list from the spec.

**`user_achievements`** — one row per (user, achievement) on unlock.
- `user_id`, `achievement_id`, `unlocked_at`, `progress_snapshot` numeric, `reward_seed_paid`, `reward_pv_paid`. Unique (`user_id`, `achievement_id`).

**`user_achievement_progress`** — running metric counters per user (one row per metric).
- `user_id`, `metric`, `value numeric`. Unique (`user_id`, `metric`). Updated by triggers; read by the evaluator.

**`user_stats`** — denormalized aggregates the UI needs.
- `user_id` PK, `achievement_points int`, `level int`, `pinned_achievements uuid[3]`, `current_title text`, `last_farm_date date`, `farming_streak_days int`, `longest_streak_days int`.

**`achievement_shares`** — log social-share clicks (powers `shares_count` / `signups_from_shares`).
- `user_id`, `channel` (`twitter|whatsapp|copy|...`), `created_at`.

GRANTs: `authenticated` gets SELECT on `achievements` (active only via policy), SELECT on own `user_achievements`/`progress`/`stats`, INSERT on `achievement_shares`. `service_role` ALL. Admin RPCs gate writes via `has_role(auth.uid(),'admin')`.

### Core functions

- `award_achievement_reward(user, ach)` — credits `reward_seed` to farming wallet via `wallet_adjust('achievement_reward')`, awards PV via existing `award_pv`, sets `current_title` if `title_unlocked`, sends `achievement_unlocked` notification.
- `bump_metric(user, metric, delta)` — upserts `user_achievement_progress`, then calls `evaluate_achievements(user, metric)`.
- `set_metric(user, metric, value)` — same but absolute.
- `evaluate_achievements(user, metric)` — for every active achievement on that metric where threshold met and not yet unlocked, insert `user_achievements`, run `award_achievement_reward`, add `points` to `user_stats.achievement_points`, recompute `level = floor(sqrt(points / 10))` (or table-driven thresholds), and if level increased send `level_up` notification.
- `recompute_level(points)` — pure helper.
- `tg_farming_streak()` — on cycle insert: compare today vs `last_farm_date`, increment/reset `farming_streak_days`, update `longest_streak_days`, call `bump_metric(..., 'farming_streak_days', ...)` (set absolute).

### Trigger wiring (existing tables → metric bumps)
- `handle_new_user` → `bump_metric('signup',1)`; also assigns `user_ordinal` for Founder/Pioneer.
- `profiles` UPDATE when profile completion fields fill → `profile_completed`.
- `deposit_requests` approved → bump `deposit_total_usdt` by amount.
- `withdrawal_requests` approved → bump `withdraw_total_usdt`.
- `cycles` INSERT → `cycles_started`; on `reaped` → `cycles_completed`, `seeds_earned_total += reward`, run streak trigger.
- `affiliate_commissions` insert → `referral_earnings_seed`.
- `profiles` insert (with `referred_by`) → bump uplines' `referrals_total`; nightly job or `cycles` activity flips downline to "active" and bumps `active_referrals`.
- `p2p_transfers` completed → `p2p_count`.
- `escrow_trades` released → `escrow_count`.
- `coupon_redemptions` insert → `coupons_redeemed`.
- `ledger_entries` of kind `cycle_start` with booster ref → `boosters_used`.
- Daily cron-style: `member_days`, `premium_days`, `account_value_seed` (sum of wallets), `rank_position` (leaderboard rank by earnings).
- `achievement_shares` insert → `shares_count`; signup with `?ref=` from a shared link → `signups_from_shares`.
- Hidden metrics from cycle insert timestamp: `night_farms` (00:00–02:59), `early_farms` (before 06:00), `lucky_seven` (exact `07:07:**`), `weekend_streak_month` computed from week buckets, `anniversary_logins` from login timestamp vs `profiles.created_at`.

### Seed data
Insert all ~80 achievements from the spec with sensible defaults (icon emoji, points ramp 10→500, Seed reward only for milestone tiers, PV reward for every tier, hidden flag on §19, legendary flag on §20). Backfill `user_achievement_progress` for existing users from current table state.

## 2. Server functions (`src/lib/achievements.functions.ts`)
- `listMyAchievements()` → all active achievements + unlock status + current progress + threshold; hides locked hidden ones.
- `getMyStats()` → points, level, next-level threshold, streak, pinned.
- `pinAchievements({ ids: string[] })` → up to 3.
- `recordShare({ channel })`.
- `getLeaderboard({ board })` for `earnings | referrals | cycles | achievements | streak | balance`.
- `getPublicProfile({ username })` → display name, avatar, pinned achievements, level, title.
- Admin: `adminListAchievements`, `adminUpsertAchievement`, `adminSetActive`, `adminReevaluateUser(userId)`.

## 3. UI

**`/achievements`** (new route, `_authenticated`)
- Grid of cards grouped by category. Each card: icon, title, description, progress bar (`current / threshold`), unlock date if unlocked, reward chips (Seeds / PV / title), Share button (Twitter/WhatsApp/Copy → records via `recordShare`).
- Tabs: All · Unlocked · In-progress · Hidden (only those unlocked).
- Header: level badge, points, next-level progress bar, longest streak, current title.

**`/leaderboard`** (new route)
- Tabs for each board, top 100 + current user's rank pinned.

**Profile page** (`/profile`)
- New "Showcase" section: pin/unpin up to 3 achievements; shown on public profile.
- Display current title under name.

**Public profile** `/u/$username` (new route)
- Avatar, level, title, pinned achievements, total unlocked count.

**Dashboard**
- Replace the existing PV chip with combined chip: `Lv N · PV total · streak 🔥`.
- Add "Recent achievements" strip (last 3 unlocked).

**Admin** (`/admin/achievements`, new)
- Table with inline edit: title, icon, threshold, points, reward_seed, reward_pv, title_unlocked, active, hidden. "Re-evaluate user" tool.
- Add tile in `admin/index.tsx`.

**Notifications**
- `notification-meta.ts`: `achievement_unlocked` → `/achievements`, `level_up` → `/achievements`. Toast on realtime arrival.

## 4. Levels
- Points → level via table: `1:0, 2:50, 3:150, 4:300, 5:500, 10:2000, 20:6000, 50:25000` (interpolated). Stored as `achievement_levels(level, min_points, label)` so admins can tune.
- Level-up triggers `level_up` notification and PV bonus (configurable per row).

## 5. Files

**New**
- `supabase/migrations/<ts>_achievements.sql`
- `src/lib/achievements.functions.ts`
- `src/routes/_authenticated/achievements.tsx`
- `src/routes/_authenticated/leaderboard.tsx`
- `src/routes/_authenticated/admin/achievements.tsx`
- `src/routes/u.$username.tsx` (public)
- `src/components/achievements/AchievementCard.tsx`
- `src/components/achievements/LevelBadge.tsx`
- `src/components/achievements/ShareMenu.tsx`
- `src/components/achievements/PinnedShowcase.tsx`
- `src/components/leaderboard/LeaderboardTable.tsx`

**Edited**
- `src/routes/_authenticated/admin/index.tsx` (achievements tile)
- `src/routes/_authenticated/profile.tsx` (showcase, title)
- `src/routes/_authenticated/dashboard.tsx` (level chip + recent strip)
- `src/components/app-sidebar.tsx` (Achievements + Leaderboard links)
- `src/lib/notification-meta.ts`

## Notes
- All metric writes happen in DB triggers so the system stays consistent even when admin actions or backfills run.
- Hidden achievements never appear in the list until unlocked.
- Seed payouts go to the Farming wallet (Seed-denominated); PV uses the existing pipeline.
- Backfill on migration so existing users instantly unlock everything they've already earned.
