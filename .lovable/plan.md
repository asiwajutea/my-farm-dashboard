## Continue: Maintenance Mode + Editable Ticker + Missing Migrations

Backend schema for maintenance + ticker is already applied (`app_settings.maint_mode_global`, `maint_message`, `maint_pages`, `ticker_enabled`, `ticker_items` + `admin_set_maintenance` / `admin_set_ticker` RPCs). Remaining work is frontend + the last missing migration batch.

### 1. Finish remaining backend bits
- New migration: KYC table + RPCs, booster CRUD RPCs, coupon bulk-create RPC, `check_username_available` RPC (no storage SQL).
- Create `kyc` storage bucket via the storage tool (private) + RLS policies on `storage.objects` in a follow-up migration.

### 2. Maintenance mode (frontend)
- `src/lib/maintenance.functions.ts` — `getMaintenanceState()` (public serverFn, reads `app_settings`) and `adminSetMaintenance()` (calls `admin_set_maintenance` RPC).
- `src/hooks/use-maintenance.ts` — React Query hook, 30s stale.
- `src/components/MaintenanceGate.tsx` — takes `pageKey`; if `maint_mode_global` or `maint_pages[pageKey]` is true AND user is not admin, render `MaintenanceCard` with admin's message. Admins always bypass (via `useIsAdmin`).
- Wrap each user-facing route component in `<MaintenanceGate pageKey="...">`: dashboard, farm, wallet, deposit, withdraw, send, escrow, affiliate, coupons, notifications, profile, verify. Leave `/auth`, `/`, legal pages, and all `/admin/*` unwrapped — registration stays open.
- New `/admin/maintenance` route: global toggle + per-page toggle grid + message textarea, saved via `adminSetMaintenance`.
- Sidebar entry under Admin: "Maintenance".

### 3. Editable ticker (frontend)
- Extend `src/lib/settings.functions.ts` with `getTickerSettings()` (public) and reuse `adminUpdatePlatformSettings` (or add `adminSetTicker`) to call `admin_set_ticker`.
- Update `src/components/Ticker.tsx` to fetch via React Query; fall back to current hardcoded defaults; hide when `ticker_enabled=false`.
- On `/admin/settings`: new "Ticker" card — enable toggle + editable list of `{ icon, label }` items (icon dropdown from a fixed lucide set, label input, add/remove/reorder up/down).

### 4. Files
**Create:** `src/lib/maintenance.functions.ts`, `src/hooks/use-maintenance.ts`, `src/components/MaintenanceGate.tsx`, `src/routes/_authenticated/admin/maintenance.tsx`, one migration, one bucket.
**Edit:** `src/components/Ticker.tsx`, `src/lib/settings.functions.ts`, `src/routes/_authenticated/admin/settings.tsx`, `src/components/app-sidebar.tsx`, and the ~12 user routes listed above (wrap component only).

### Assumptions
- Registration (`/auth`) and landing (`/`) remain reachable during maintenance.
- Admins bypass everywhere via `has_role`.
- Ticker icons limited to a curated lucide set so admin doesn't need free-text icon names.
