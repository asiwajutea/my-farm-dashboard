## Problem

The referral link worked at signup — `footdyn@gmail.com`'s profile correctly has `referred_by = dakintuyi`'s id. But the affiliate page shows 0 downlines because:

- `profiles` RLS policy is `auth.uid() = id` (owner-only SELECT).
- `getMyAffiliateSummary` and `getMyDownlines` read `profiles` directly with a normal authenticated client, so they only see the caller's own row — never their downlines.
- No commission has been paid because commissions are only generated when a downline reaps a cycle or pays a maintenance fee. That part of the schema is fine; it just has nothing to show yet.

## Fix

### 1. Database migration — SECURITY DEFINER RPCs

Add two functions that walk the referral tree for `auth.uid()`, bypassing RLS safely (return only non-PII fields):

- `public.get_my_downline_counts()` → returns `(gen1 int, gen2 int, gen3 int)`.
- `public.get_my_downlines()` → returns `(id uuid, display_name text, username text, generation int, created_at timestamptz)` for gens 1–3.

Both `SECURITY DEFINER`, `SET search_path = public`, granted `EXECUTE TO authenticated`, scoped strictly to `auth.uid()` (no parameter, so a user can only ever see their own downlines).

### 2. Update `src/lib/affiliate.functions.ts`

- `getMyAffiliateSummary`: replace the three `profiles` queries with a single `supabase.rpc('get_my_downline_counts')` call.
- `getMyDownlines`: replace the three `profiles` queries with `supabase.rpc('get_my_downlines')`.
- Keep the existing `affiliate_commissions` queries unchanged — that table's RLS already permits the recipient to read their own commissions.

### 3. No code change needed for signup

The `handle_new_user` trigger already resolves `raw_user_meta_data->>'referral_code'` to `referred_by`. Verified working for the reported pair.

## Verification

- After the migration, `dakintuyi` should see Gen-1 = 1 (footdyn) on the affiliate page.
- Total earnings stay at 0 until footdyn reaps a cycle or pays a maintenance fee, which is expected behaviour.