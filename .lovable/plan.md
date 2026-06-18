## Dashboard (`src/routes/_authenticated/dashboard.tsx`)

- Replace the hardcoded "No active farming cycles" section with a live list. Fetch cycles via `listMyCycles` server fn (already exists), filter `status in ('active','matured')`, and render compact cycle cards (plan label, amount in Seed/USDT, progress to maturity, reap button if matured). Empty state stays for users with zero active cycles.
- Quick actions row:
  - Rename **Transfer** → **P2P Transfer** (still links to `/send`).
  - Replace **Boost** with **History** linking to new `/history` route.
- Wallet cards: wrap both `WalletCard`s in `<Link to="/wallet">` so the whole card is clickable.

## Farming page (`src/routes/_authenticated/farm.tsx`)

- Add a **Fund Wallet** button in the "Start a cycle" card header (next to balance) that opens the existing `TransferToFarmingDialog`. To avoid duplicating the dialog, lift the component out of `wallet.tsx` into `src/components/wallet/TransferToFarmingDialog.tsx` (export both the trigger-styled version used in wallet and a `triggerless` controlled version), then mount it on the farm page with a custom trigger button.
- Under the "Amount to invest" input, add quick-select chips: **10% · 25% · 50% · 75% · Max**. Each sets `amount` to that fraction of farming `balance` (rounded to 2 decimals). Disabled when balance is 0.

## Transaction History (`src/routes/_authenticated/history.tsx` — new)

- New protected route showing every ledger entry for the user across both wallets.
- Server fn `listLedger` (`src/lib/history.functions.ts`, new) with `requireSupabaseAuth`: takes `{ page, pageSize, sortBy: 'created_at'|'amount', sortDir: 'asc'|'desc', wallet?: 'primary'|'farming'|'all', kind?: string }`, returns `{ rows, total }` using Supabase `.range()` + `count: 'exact'`.
- UI: filter bar (wallet, kind, sort), table of entries (date, wallet, kind label, memo, amount with +/- colour), pagination controls (page size 25, prev/next + page indicator), sortable column headers.
- **Rate chart** at top of page:
  - New table `public.rate_history (id, seed_to_usdt numeric, recorded_at timestamptz)` with public `TO anon` SELECT policy (rate is public info), service_role write.
  - Trigger on `app_settings` update: when `seed_to_usdt` changes, insert a row into `rate_history`. Also seed an initial row from current `app_settings`.
  - Public server fn `getRateHistory({ range: '24h'|'7d'|'30d'|'90d'|'all' })` using the server publishable client.
  - Render with `recharts` `AreaChart` (already in stack via shadcn `chart.tsx` — verify, else `bun add recharts`): gradient fill, candlestick-style tooltip showing rate at hover, range selector buttons (1D/7D/30D/90D/All), Y-axis = Seed→USDT rate, X-axis = time. Interactive crosshair tooltip mimicking TradingView/CoinGecko.

## Notifications — full coverage

Add missing kinds to the `notification_kind` enum and wire emitters:

| New kind | Trigger point |
|---|---|
| `welcome` | `handle_new_user` trigger on `auth.users` insert (existing trigger — extend to insert notification) |
| `email_verified` | when `profiles.email_verified` flips true (or auth webhook); simplest: trigger on `auth.users.email_confirmed_at` change |
| `affiliate_signup` | inside referral-assignment trigger when a new downline is attached → notify the upline |
| `affiliate_commission` (exists) | keep |
| `p2p_sent` | inside `p2p_send` RPC for the sender |
| `cycle_started` | inside `start_cycle` RPC |
| `booster_applied` | inside booster-apply RPC |
| `maintenance_paid` | inside `pay_maintenance` RPC |
| `coupon_redeemed` | inside coupon redemption RPC |
| `kyc_submitted` | inside `submit_kyc` RPC (notify user it's under review) |
| `password_changed` | via auth webhook — out of scope; document as future |
| `system` (exists) | keep |

Migration steps:
1. `ALTER TYPE public.notification_kind ADD VALUE ...` for each new kind.
2. Update each relevant RPC / trigger to `INSERT INTO public.notifications (...)` after the main action (inside the same transaction).
3. Extend `src/lib/notification-meta.ts` `META` map with icon/tone/route for every new kind.

## Technical notes

- Server fns live in `src/lib/history.functions.ts` and `src/lib/rate.functions.ts` (client-safe path).
- New `_authenticated/history.tsx` route — `src/routeTree.gen.ts` regenerates on dev-server restart after file creation.
- `recharts` is already a transitive dep via shadcn ui chart; if not, install with `bun add recharts`.
- Rate-history seeding: a one-off insert in the migration captures the current rate so the chart has a starting point.
- No changes to wallet RPC math or business logic — only presentation + new read-only history endpoints + notification side-effects.

## Files changed / added

- edit `src/routes/_authenticated/dashboard.tsx`
- edit `src/routes/_authenticated/farm.tsx`
- edit `src/routes/_authenticated/wallet.tsx` (use shared dialog component)
- add `src/components/wallet/TransferToFarmingDialog.tsx`
- add `src/routes/_authenticated/history.tsx`
- add `src/lib/history.functions.ts`
- add `src/lib/rate.functions.ts`
- add `src/components/history/RateChart.tsx`
- edit `src/lib/notification-meta.ts`
- migration: enum values + `rate_history` table + triggers + RPC notification inserts
