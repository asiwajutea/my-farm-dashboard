## Scaffold Plan: All Phases (Skeleton + DB + Navigation)

Build the complete app skeleton so each subsequent phase plugs into existing structure without restructuring. Each page renders a placeholder "Coming in Phase X" UI but is wired to routes, navigation, and (where relevant) real database tables with RLS.

---

### 1. Sidebar Navigation Shell

Convert `_authenticated/route.tsx` into a layout with `SidebarProvider` + `AppSidebar` + topbar (avatar menu currently in dashboard). New file:

- `src/components/app-sidebar.tsx` — collapsible sidebar with sections:
  - **Wallet**: Dashboard, Wallets, Deposit, Withdraw
  - **Earn**: Farm (cycles)
  - **Transfer**: Send (P2P), Coupons, Escrow
  - **Account**: Profile, Verify (KYC), Notifications
  - **Admin** (only if `has_role(uid,'admin')`): Admin Console
- Active route highlight via `useRouterState`.
- Topbar keeps avatar dropdown + sidebar trigger.

### 2. Database Migrations (one migration each, all skeletons with RLS + GRANTs)

**Phase 4 — Farming**
- `boosters` (code, label, duration_hours, reward_bps, cost_seed, active) — seeded with 1d/3d/5d/7d.
- `cycles` (user_id, amount, duration_hours, reward_bps, booster_id?, status enum, started_at, matures_at, reaped_at).

**Phase 5 — P2P + Coupons**
- `p2p_transfers` (sender_id, receiver_id, amount, fee, note, status).
- `coupons` (code unique, amount, max_redemptions, redemptions_count, expires_at, created_by, active).
- `coupon_redemptions` (coupon_id, user_id, redeemed_at; unique per pair).

**Phase 6 — Escrow**
- `escrows` (seller_id, buyer_id, amount, status enum, terms, resolved_at).
- `escrow_events` (escrow_id, actor_id, kind, payload jsonb).

**Phase 7 — Admin**
- `app_role` enum (`admin`, `moderator`, `user`).
- `user_roles` (user_id, role; unique pair).
- `has_role(uid, role)` SECURITY DEFINER function.
- Replace stub `is_admin(uid)` with real `has_role`-backed version.
- `admin_audit` (admin_id, action, target_table, target_id, payload jsonb).

**Phase 8 — Notifications**
- `notifications` (user_id, kind, title, body, payload jsonb, read_at).

**Phase 9 — Compliance**
- Extend `profiles` with `tos_accepted_at`, `risk_accepted_at`.
- `kyc_submissions` (user_id, id_doc_path, selfie_path, status, reviewer_id, reviewed_at, notes).
- Storage bucket `kyc` (private; owner-write, admin-read).

All tables: RLS enabled, owner-read/write policies for user-owned rows, admin full-access via `has_role`, GRANTs to `authenticated` + `service_role`.

### 3. Route Skeletons

All new routes render a consistent `<PagePlaceholder phase=X title=... description=... />` component until their phase is implemented.

**Public routes**
- `src/routes/terms.tsx`
- `src/routes/privacy.tsx`
- `src/routes/risk-disclosure.tsx`
- `src/routes/aml.tsx`

**Authenticated routes**
- `_authenticated/wallets.tsx` — already exists as `wallet.tsx`; rename to `wallets.index.tsx` and add `wallets.$kind.tsx` detail.
- `_authenticated/deposit.tsx`
- `_authenticated/withdraw.tsx`
- `_authenticated/farm.tsx`
- `_authenticated/send.tsx`
- `_authenticated/coupons.tsx`
- `_authenticated/escrow.tsx` + `escrow.$id.tsx`
- `_authenticated/notifications.tsx`
- `_authenticated/verify.tsx` (KYC)

**Admin routes** (gated by `has_role`)
- `_authenticated/admin/route.tsx` — guard layout
- `_authenticated/admin/index.tsx` — overview
- `_authenticated/admin/farmers.tsx`
- `_authenticated/admin/requests.tsx`
- `_authenticated/admin/cycles.tsx`
- `_authenticated/admin/escrow.tsx`
- `_authenticated/admin/settings.tsx`
- `_authenticated/admin/coupons.tsx`
- `_authenticated/admin/audit.tsx`

### 4. Shared UI

- `src/components/PagePlaceholder.tsx` — consistent skeleton card with phase badge, title, description, "Coming soon" CTA.
- `src/hooks/use-admin.ts` — `useQuery` calling a `checkIsAdmin` serverFn (uses `has_role`).

### 5. Out of Scope (deferred to phase work)

- Business logic for any new feature (cycles math, escrow lifecycle, P2P transfer SQL fn, KYC review flow, notifications triggers, admin actions).
- Real-time subscriptions.
- Payment provider integration.

---

### Build Safety
- One migration per phase domain to keep approvals reviewable.
- All admin pages render placeholder until Phase 7 wires the gate; layout still calls `has_role` so non-admins get 403 today.
- No `<Link to=...>` will reference a route before its file exists — sidebar items are added in the same pass as the route files.
- No protected loaders on public routes.

Approve and I'll execute migrations first, then code in parallel.