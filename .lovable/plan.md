## Goal

Apply the 25 existing migration files in `supabase/migrations/` to your connected Supabase project so the app's backend (wallets, deposits/withdrawals, escrow, KYC, admin, coupons, notifications, affiliates, payout lock) matches what the route and `*.functions.ts` code already expects.

## Approach

Run all 25 migration files **in their existing timestamp order** as a single batched migration submission through the migration tool. The files are already authored with grants + RLS + policies in the same file per project rules, so no rewriting is needed.

Order (chronological):

```
20260606180427 → profiles + base
20260606180434 → ...
20260607002512, 002532, 002555
20260607004431, 004455            (wallets, wallet_transfer/adjust SECURITY DEFINER)
20260607100000_phase3_deposits_withdrawals
20260607133816
20260608001157, 001243, 005421
20260608010000_phase6_escrow
20260608020000_phase7_admin
20260608030000_coupons_bulk_usdt
20260608040000_preset_avatars_username_check
20260609050000_phase8_notifications
20260609060000_phase9_kyc
20260609070000_booster_crud
20260609225620, 225834, 225921, 230017
20260610095931
20260610120000_payout_lock_and_rate_freeze
```

Total: ~3,737 lines of SQL across 25 files.

## Steps

1. Submit all 25 migration files as one migration batch to your Supabase project, preserving filename order.
2. After it applies, add the missing server-side secret `SUPABASE_SERVICE_ROLE_KEY` (required by `src/integrations/supabase/client.server.ts` for admin operations like the test-credit route, KYC admin, escrow admin, etc.). You'll paste it in a secure form — I won't see the value.
3. Verify: load the preview, sign up a test user, confirm a profile + wallets row gets auto-created by the triggers, and that the dashboard loads without runtime errors.

## Out of scope

- No schema changes or consolidation.
- No new features.
- The blank landing page from the earlier turn stays blank — backend only.

## Technical notes

- Migrations create `auth.users`-linked tables (`profiles`, `wallets`, `wallet_ledger`, `deposit_requests`, `withdrawal_requests`, `escrow_*`, `kyc_*`, `notifications`, `affiliates`, `coupons`, `user_roles`, etc.), the `request_status` / `app_role` enums, the `proofs` storage bucket with uid-prefixed RLS, and SECURITY DEFINER money functions `wallet_transfer()` / `wallet_adjust()` granted to `service_role`.
- Grants follow the project rule: `authenticated` + `service_role` on every public table; `anon` only where a public-read policy exists.
- The service-role key is needed because several existing server functions (admin tooling, KYC admin, escrow admin, test-credit webhook) import `@/integrations/supabase/client.server` inside their handlers.