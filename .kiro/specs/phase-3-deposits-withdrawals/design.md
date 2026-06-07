# Design Document

## Overview

This design covers two changes shipped together for the VFarmers app (TanStack Start + React + Supabase, Phases 0–2 complete):

- **Part 1 — Brand rename "VFarm" → "VFarmers"** (Requirement 1): a low-risk, user-facing copy refactor that makes the brand read "VFarmers" everywhere, while preserving the green-accent mark `V<span className="text-primary">Farmers</span>`, the unrelated member term "Farmer/Farmers", the asset filename `vfarm-logo.png`, and the lowercase package name.

- **Part 2 — Phase 3: Deposits & Withdrawals (manual / admin-first)** (Requirements 2–14): authenticated Farmers can submit deposit and withdrawal requests with optional proof upload and view their own request history with statuses. Admin approval is deferred to Phase 7; this phase lays down the tables, RLS, the private `proofs` storage bucket, the server functions, and a service-role-only test-credit path that reuses the existing money-movement plumbing. **Submission never moves money** (Requirement 9.4) — balances change only at approval time, which is out of scope.

### Codebase audit (grounding for this design)

The following existing patterns are reused verbatim and must not be reinvented:

| Concern | Existing artifact | Reuse in Phase 3 |
| --- | --- | --- |
| Server logic | `createServerFn({ method })...inputValidator(zod).handler(...)` in `src/lib/api/example.functions.ts` | All Request_Service functions follow this shape |
| Auth in handlers | `requireSupabaseAuth` middleware (`src/integrations/supabase/auth-middleware.ts`) → injects `context.supabase`, `context.userId`, `context.claims` | Every user-scoped server fn `.middleware([requireSupabaseAuth])` |
| Client token attach | `attachSupabaseAuth` global function middleware wired in `src/start.ts` | Already global — do **not** add another |
| RLS-scoped DB access | `context.supabase` (user-JWT client, RLS enforced) | Reads/inserts of request rows |
| Service-role DB access | `supabaseAdmin` (`src/integrations/supabase/client.server.ts`, bypasses RLS) | Test-credit route + storage signed URLs |
| Money movement | `wallet_adjust(...)` / `wallet_transfer(...)` SECURITY DEFINER fns (migration `20260607004431`), `service_role`-only EXECUTE | Test-credit route credits the Primary wallet |
| Migrations | Timestamped SQL in `supabase/migrations/`, grants + RLS **in the same file** (see profiles/wallets migrations) | New `deposit_requests` / `withdrawal_requests` migration |
| Server env | Read `process.env` only inside `.handler()` / `.server.ts` functions (`src/lib/config.server.ts`) | Test-credit secret, never at client module scope |
| Auth routing | `src/routes/_authenticated/route.tsx` (`ssr:false`, `beforeLoad` guard → redirect to `/auth`) | New wallet screens nested here |

**Part 1 current state:** A case-sensitive scan for the brand token `VFarm(?!ers)` shows every user-facing surface in `index.tsx`, `auth.tsx`, `dashboard.tsx`, and `__root.tsx` already renders "VFarmers"; the only literal `VFarm` matches are `import logo from "@/assets/vfarm-logo.png"` (a filename, kept per Req 1.13). There is no `index.html` (the document title lives in route `head()`), and `package.json` `name` is `tanstack_start_ts` (no brand token). Part 1 is therefore an **audit + canonicalization + regression-guard** task rather than a bulk rewrite — see the change list in "Brand Rename (Part 1)".

## Architecture

### High-level structure

```
Browser (React, _authenticated)
  ├─ /_authenticated/wallet            → tabs: Deposit | Withdraw | History
  │     submit form ──► serverFn (POST, multipart) ─┐
  │     history list ◄── serverFn (GET/POST) ◄──────┤
  └─ attachSupabaseAuth (client mw) attaches Bearer token to every serverFn RPC
                                                     │
TanStack Start server (.handler runs server-only)   ▼
  ├─ submitDepositRequest    ┐
  ├─ submitWithdrawalRequest ├─ .middleware([requireSupabaseAuth])
  └─ listMyRequests          ┘   → context.supabase (RLS), context.userId
        │  validate (zod) → optional proof upload (proofs bucket, uid/ path)
        │  insert request row via context.supabase (RLS-enforced)
        ▼
Supabase Postgres + Storage
  ├─ public.deposit_requests / public.withdrawal_requests  (RLS: own-row)
  ├─ storage bucket "proofs" (private, uid-prefixed RLS)
  └─ wallet_adjust()/wallet_transfer() (SECURITY DEFINER, service_role only)

Out-of-band (NOT a browser session):
  └─ Test_Credit_Route  POST /api/public/test-credit
        verify shared-secret signature → supabaseAdmin → wallet_adjust('deposit')
```

### Data flow — submit a deposit/withdrawal (Req 5, 6)

1. Form posts `multipart/form-data` (amount, method, optional file) to the server function.
2. `requireSupabaseAuth` resolves the caller; an unauthenticated call is rejected before any logic (Req 5.5, 6.5, 11.2).
3. The handler validates amount (bounds + ≤2 decimals), method (allow-list), and—if present—the proof file (type + size) with zod. Invalid input returns a typed validation error and **no row is written** (Req 5.3/5.6/5.7, 6.3/6.6).
4. Withdrawals additionally read the caller's Primary wallet `(balance − locked)` and reject if `amount` exceeds available, **without** touching balances (Req 6.7, 9.4).
5. A 60-second dedupe check (deposits) returns the existing pending row instead of creating a duplicate (Req 5.8).
6. If a proof file is present and valid, it is uploaded to `proofs/{uid}/{requestScope}/{uuid}.{ext}` and its storage path is stored in `proof_url`.
7. The row is inserted through `context.supabase` (the user-JWT client), so the RLS `WITH CHECK (auth.uid() = user_id)` policy is the final authority (Req 4.4). `status` defaults to `pending`.

### Data flow — view history (Req 7)

1. `listMyRequests` (auth-required) issues two RLS-scoped selects (deposits, withdrawals), tags each row with `type`, merges, sorts by `created_at DESC`, and applies keyset pagination (page size 20) returning a `nextCursor` (Req 7.1, 7.5).
2. RLS guarantees only the caller's rows are visible regardless of server logic (Req 4.3).
3. The screen renders status badges, an empty state for zero rows, and an error state on failure (Req 7.3, 7.4, 7.6, 7.7).

### Data flow — test credit (Req 10)

1. An operator/CI calls `POST /api/public/test-credit` (an HTTP route under `src/routes/api/public/`, Req 14.1) with a signed body.
2. The route verifies an HMAC signature against a server-only shared secret read **inside the handler** (Req 13, 14.2/14.3). Browser `anon`/`authenticated` sessions carry no such signature and are rejected (Req 10.2/10.3/10.4).
3. On success it validates target Farmer + amount, looks up the target's Primary wallet, and credits it via `wallet_adjust(..., 'deposit', ...)` — the SECURITY DEFINER, `service_role`-only money mutator — writing exactly one atomic `deposit` ledger entry in one transaction (Req 10.1, 9.1/9.2/9.3).

## Components and Interfaces

### Module layout (new files)

```
src/
├─ lib/api/
│  └─ requests.functions.ts        # submitDepositRequest, submitWithdrawalRequest, listMyRequests
├─ lib/
│  ├─ requests.shared.ts           # zod schemas, method allow-lists, constants (client+server safe — NO process.env)
│  └─ requests.server.ts           # proof-upload helper, dedupe helper (server-only)
├─ routes/
│  ├─ _authenticated/
│  │  └─ wallet.tsx                # Deposit | Withdraw | History UI (authenticated)
│  └─ api/
│     └─ public/
│        └─ test-credit.ts         # service-role-only HTTP route (signature-verified)
└─ components/wallet/              # (optional) RequestForm, RequestHistoryList, StatusBadge
```

> **Link-ordering safety (Req 12.2):** `src/routes/_authenticated/wallet.tsx` is created **before** any `<Link to="/wallet">` is added (e.g., wiring the dashboard "Deposit" quick-action). The dashboard currently uses non-navigating `<button>` placeholders; converting them to `<Link>` is a follow-up that must land in the same change as, or after, the route file.

### Shared validation contract — `src/lib/requests.shared.ts`

Pure, client- and server-importable. Contains **no** `process.env` access at module scope (Req 13.1).

```ts
export const DEPOSIT_METHODS = ["bank_transfer", "usdt_trc20", "usdt_erc20", "card"] as const;
export const WITHDRAWAL_METHODS = ["bank_transfer", "usdt_trc20", "usdt_erc20"] as const;

export const AMOUNT_MAX = 999_999_999.99;
export const DEPOSIT_AMOUNT_MIN = 0.01;      // amount > 0, smallest 2-dp value
export const WITHDRAWAL_AMOUNT_MIN = 0.01;   // Req 6.2
export const METHOD_MAX_LEN = 30;            // Req 6.6 (withdrawal); deposit ≤ 50 at DB level
export const PROOF_MAX_BYTES = 10 * 1024 * 1024;          // 10 MB (Req 5.4/5.7, 6.4)
export const PROOF_MIME = ["image/jpeg", "image/png", "application/pdf"] as const;
export const DEDUPE_WINDOW_MS = 60_000;       // Req 5.8

// At-most-two-decimals + bounds. Money is validated as a string→Decimal to avoid
// float drift; helper returns a normalized 2-dp string or a typed error code.
export function parseAmount(input: unknown, min: number): 
  | { ok: true; value: string }
  | { ok: false; code: "not_numeric" | "too_small" | "too_large" | "too_many_decimals" };

export const depositInput = z.object({
  amount: z.string(),                 // validated via parseAmount in handler
  method: z.enum(DEPOSIT_METHODS),
  // proof handled out-of-band as multipart; see server fn
});
export const withdrawalInput = z.object({
  amount: z.string(),
  method: z.enum(WITHDRAWAL_METHODS),
});
export const listInput = z.object({
  cursor: z.string().optional(),      // opaque keyset cursor
  limit: z.number().int().min(1).max(20).default(20),
});
```

### Server functions — `src/lib/api/requests.functions.ts`

All three use `createServerFn` + `.middleware([requireSupabaseAuth])` (Req 11.1/11.2). Input is `multipart/form-data` for the submit functions (file + fields); `createServerFn` accepts `FormData` and the handler validates fields with the shared zod schemas.

```ts
// 1) Submit deposit (Req 5)
export const submitDepositRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((fd: FormData) => fd)   // raw; parsed in handler
  .handler(async ({ data, context }): Promise<SubmitResult> => {
    // a. parse amount → parseAmount(.., DEPOSIT_AMOUNT_MIN); reject on error (Req 5.2/5.3)
    // b. method ∈ DEPOSIT_METHODS else invalid_method (Req 5.6)
    // c. optional file → validateProof(file): mime ∈ PROOF_MIME && size ≤ PROOF_MAX_BYTES (Req 5.4/5.7)
    // d. dedupe: existing pending deposit with same (user_id, amount, method)
    //    within DEDUPE_WINDOW_MS → return it, no new row (Req 5.8)
    // e. if file ok → upload to proofs/{context.userId}/deposits/{uuid}.{ext}; capture path
    // f. insert via context.supabase (RLS WITH CHECK) { user_id: context.userId, amount,
    //    method, status defaults 'pending', proof_url } (Req 5.1)
    // returns { request } or throws RequestError (typed)
  });

// 2) Submit withdrawal (Req 6) — same shape, plus available-balance guard
export const submitWithdrawalRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((fd: FormData) => fd)
  .handler(async ({ data, context }): Promise<SubmitResult> => {
    // a. parseAmount(.., WITHDRAWAL_AMOUNT_MIN) (Req 6.2/6.3)
    // b. method ∈ WITHDRAWAL_METHODS && len ≤ METHOD_MAX_LEN (Req 6.6)
    // c. proof validation as above (Req 6.4)
    // d. read caller Primary wallet (balance, locked) via context.supabase;
    //    if amount > (balance - locked) → insufficient_balance, NO row, NO balance change (Req 6.7, 9.4)
    // e. upload proof (proofs/{uid}/withdrawals/{uuid}.{ext}) if present
    // f. insert withdrawal_requests row (status 'pending') (Req 6.1)
  });

// 3) List my requests (Req 7)
export const listMyRequests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(listInput)
  .handler(async ({ data, context }): Promise<HistoryPage> => {
    // select deposit_requests & withdrawal_requests via context.supabase (RLS-scoped),
    // tag type, merge, sort created_at DESC, keyset-paginate (limit ≤ 20) → { items, nextCursor }
    // (Req 7.1/7.2/7.5)
  });
```

Result/error shapes (typed, never leak internals — Req 7.7):

```ts
type RequestRow = {
  id: string; type: "deposit" | "withdrawal";
  amount: string; method: string;
  status: "pending" | "approved" | "rejected";
  proof_url: string | null; created_at: string;
};
type SubmitResult = { request: RequestRow; deduped?: boolean };
type HistoryPage = { items: RequestRow[]; nextCursor: string | null };
type RequestErrorCode =
  | "invalid_amount" | "invalid_method" | "invalid_proof"
  | "insufficient_balance" | "unauthorized" | "internal";
```

### Keyset cursor design (Req 7.5)

Cursor is an opaque base64 of `{ created_at, id }` of the last returned row. The next page fetches rows with `(created_at, id) < (cursor.created_at, cursor.id)` ordered `created_at DESC, id DESC`, limit 20. Because deposits and withdrawals are merged in memory, each underlying query is over-fetched to `limit` and re-merged; the cursor encodes the composite boundary so paging is stable across both tables.

### Test-credit HTTP route — `src/routes/api/public/test-credit.ts` (Req 10, 14)

A TanStack Start **server route** (`createServerFileRoute(...).methods({ POST })`) under `api/public/`. It is **not** a `createServerFn` and is intentionally outside any auth middleware, because it authenticates by **shared-secret signature**, not by a Supabase session.

```ts
// POST /api/public/test-credit
// Body: { user_id: uuid, amount: number, memo?: string, nonce: string, ts: number }
// Header: x-signature: hex(HMAC_SHA256(secret, rawBody))
export const ServerRoute = createServerFileRoute("/api/public/test-credit").methods({
  POST: async ({ request }) => {
    // 1. read TEST_CREDIT_SECRET from process.env INSIDE handler (Req 13.2)
    //    if unset → 503 (not configured)
    // 2. read raw body; recompute HMAC; constant-time compare to x-signature;
    //    reject (401) on missing/invalid signature (Req 10.2/10.4, 14.2/14.3)
    // 3. reject stale ts (> 5 min skew) to blunt replay
    // 4. validate { user_id exists, amount numeric > 0 } else 400 identifying field (Req 10.5)
    // 5. look up target Primary wallet via supabaseAdmin
    // 6. credit via wallet_adjust(p_wallet, +amount, 'deposit', ...) — SECURITY DEFINER,
    //    service_role-only; writes exactly one 'deposit' ledger row atomically (Req 10.1, 9.1/9.2/9.3)
    // 7. 200 { ok, ledgerWritten }
  },
});
```

Because the route requires a signature that only a service-role caller possesses, an `authenticated` or `anon` browser session can never satisfy it (Req 10.3/10.4) — the browser has no way to produce the HMAC, and the secret never ships to the client (Req 13.1).

> **Design decision — which money function? (DECIDED).** The test-credit route credits the target's Primary wallet via `wallet_adjust(p_wallet, +amount, 'deposit', ...)`, writing exactly one atomic `deposit` ledger row. `wallet_adjust` is the deposit-appropriate `SECURITY DEFINER`, `service_role`-only, single-transaction money mutator (Req 9.1/9.2/9.3, 10.1). Rationale: a deposit credits funds that originate **outside** the system, so there is no source wallet to debit — `wallet_transfer()` (which debits a source wallet and requires two existing user wallets) is therefore not used here. Where requirements literally say `wallet_transfer()`, `wallet_adjust('deposit')` is its deposit-appropriate SECURITY DEFINER sibling.

### Brand Rename (Part 1) — before/after change list (Req 1)

Canonical strings: styled mark `V<span className="text-primary">Farmers</span>`; plain brand `VFarmers`; member term `Farmer`/`Farmers` (unchanged); logo alt `VFarmers`.

| Location | Surface (Req) | Action | Current state |
| --- | --- | --- | --- |
| `src/routes/index.tsx` | nav mark, hero copy, footer (1.5); meta title/description/og:title/og:description (1.6); logo `alt="VFarmers logo"` (1.12) | Verify = "VFarmers"; styled mark uses accent span | ✅ already compliant |
| `src/routes/auth.tsx` | brand mark, head title `Sign in · VFarmers`, "Welcome back, Farmer"/"Become a Farmer", terms line, logo alt (1.7, 1.12) | Verify = "VFarmers" | ✅ already compliant |
| `src/routes/_authenticated/dashboard.tsx` | top-bar mark, head title `Dashboard · VFarmers`, greeting/copy, logo alt (1.8, 1.12) | Verify = "VFarmers" | ✅ already compliant |
| `src/routes/__root.tsx` | default `description`, `og:title`, `og:description`, `og:site_name` (1.9) | Set brand token to "VFarmers" where present; `og:title` is "Lovable App" (no brand token → no change per 1.2); add `og:site_name: "VFarmers"` if a site-name tag is desired | ✅ description already "VFarmers"; og:site_name optional add |
| `src/components/Ticker.tsx` | brand text (1.10) | Keep member-term counts like "12,847 Farmers" unchanged; no `VFarm` brand token present | ✅ no change needed |
| `index.html` | document title (1.11) | N/A — no `index.html`; title set in route `head()` | N/A |
| `src/assets/vfarm-logo.png` | filename (1.13) | **Keep filename unchanged** | ✅ unchanged |
| `package.json` | `name` lowercase (1.14) | Keep `name` (`tanstack_start_ts`, no brand); if a brand-referencing `description` is added, use "VFarmers" | ✅ unchanged |

**Regression guard (Req 1.2):** a case-sensitive search for the pattern `VFarm` not immediately followed by `ers` must return only the `vfarm-logo.png` import paths (filename) and internal identifiers — never user-facing text/attributes. This check belongs in the test suite (see Testing Strategy).

## Data Models

### Enum — `request_status` (Req 2.3)

```sql
CREATE TYPE public.request_status AS ENUM ('pending', 'approved', 'rejected');
```

### Tables — `deposit_requests` and `withdrawal_requests` (Req 2)

Identical column set and constraints for both tables (Req 2.1/2.2). `amount numeric(20,8)` matches the wallets/ledger precision; status defaults to `pending` (Req 2.4); timestamps default to `now()` (Req 2.5); a `CHECK (amount > 0)` plus the `auth.users` FK enforce Req 2.6.

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | uuid | PK, default `gen_random_uuid()` |
| `user_id` | uuid | NOT NULL, FK → `auth.users(id)` ON DELETE CASCADE |
| `amount` | numeric(20,8) | NOT NULL, `CHECK (amount > 0)` |
| `method` | text | NOT NULL, `CHECK (char_length(method) <= 50)` |
| `status` | request_status | NOT NULL, DEFAULT `'pending'` |
| `admin_note` | text | nullable, `CHECK (char_length(admin_note) <= 1000)` |
| `proof_url` | text | nullable, `CHECK (char_length(proof_url) <= 2048)` |
| `created_at` | timestamptz | NOT NULL, DEFAULT `now()` |
| `updated_at` | timestamptz | NOT NULL, DEFAULT `now()` |

Indexes for history paging (Req 7.1/7.5): `(user_id, created_at DESC, id DESC)` on each table.

### Migration SQL sketch — single file, grants + RLS inline (Req 2, 3, 4, 8)

Following the existing convention (see `20260607004431`), the table DDL, grants, RLS enable, **and** policies all live in **one** migration file (Req 3.1, 4.1, 4.2). The `proofs` bucket and its storage policies are included in the **same** migration (Req 8).

```sql
-- =========================================================
-- Phase 3: Deposit & Withdrawal requests + proofs bucket
-- =========================================================

-- 1. Status enum (Req 2.3)
CREATE TYPE public.request_status AS ENUM ('pending', 'approved', 'rejected');

-- 2. Shared DDL via a helper pattern (written out per-table for clarity)
CREATE TABLE public.deposit_requests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount      numeric(20,8) NOT NULL CHECK (amount > 0),               -- Req 2.6
  method      text NOT NULL CHECK (char_length(method) <= 50),
  status      public.request_status NOT NULL DEFAULT 'pending',        -- Req 2.4
  admin_note  text CHECK (admin_note IS NULL OR char_length(admin_note) <= 1000),
  proof_url   text CHECK (proof_url  IS NULL OR char_length(proof_url)  <= 2048),
  created_at  timestamptz NOT NULL DEFAULT now(),                      -- Req 2.5
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.withdrawal_requests (LIKE public.deposit_requests INCLUDING ALL);
-- (LIKE ... INCLUDING ALL copies columns, defaults, checks, indexes; FK re-added below)
ALTER TABLE public.withdrawal_requests
  ADD CONSTRAINT withdrawal_requests_user_fk
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX deposit_requests_user_created_idx
  ON public.deposit_requests (user_id, created_at DESC, id DESC);
CREATE INDEX withdrawal_requests_user_created_idx
  ON public.withdrawal_requests (user_id, created_at DESC, id DESC);

-- 3. Grants — authenticated + service_role, NO anon (Req 3.1/3.2/3.3)
GRANT SELECT, INSERT ON public.deposit_requests    TO authenticated;
GRANT SELECT, INSERT ON public.withdrawal_requests TO authenticated;
GRANT ALL ON public.deposit_requests    TO service_role;
GRANT ALL ON public.withdrawal_requests TO service_role;

-- 4. RLS — enable + own-row policies, same migration (Req 4)
ALTER TABLE public.deposit_requests    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Farmers read own deposit requests"
  ON public.deposit_requests FOR SELECT TO authenticated
  USING (auth.uid() = user_id);                                        -- Req 4.3/4.5
CREATE POLICY "Farmers insert own deposit requests"
  ON public.deposit_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);                                   -- Req 4.4/4.5
CREATE POLICY "Farmers read own withdrawal requests"
  ON public.withdrawal_requests FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Farmers insert own withdrawal requests"
  ON public.withdrawal_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- updated_at triggers (reuse existing public.update_updated_at_column())
CREATE TRIGGER deposit_requests_updated_at    BEFORE UPDATE ON public.deposit_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER withdrawal_requests_updated_at BEFORE UPDATE ON public.withdrawal_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Private proofs bucket (Req 8.1)
INSERT INTO storage.buckets (id, name, public)
VALUES ('proofs', 'proofs', false)
ON CONFLICT (id) DO NOTHING;
```

### Storage RLS — `proofs` bucket policies (Req 8)

Policies on `storage.objects` keyed to a uid-prefixed path: the first path segment must equal the caller's uid. Admin read-all is forward-compatible with Phase 7's role system (see decision).

```sql
-- Owner write: object path must start with the caller's uid (Req 8.2/8.3)
CREATE POLICY "proofs owner insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'proofs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Owner read (Req 8.4)
CREATE POLICY "proofs owner read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'proofs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Admin read-all (Req 8.5) — forward-compatible shim included in THIS migration:
-- public.is_admin() returns false until Phase 7 swaps in has_role(uid,'admin').
CREATE OR REPLACE FUNCTION public.is_admin(uid uuid)
  RETURNS boolean
  LANGUAGE sql
  STABLE
AS $$
  SELECT false;   -- Phase 7 replaces body with has_role(uid, 'admin')
$$;

CREATE POLICY "proofs admin read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'proofs'
    AND public.is_admin(auth.uid())   -- shim defaults false pre-Phase 7
  );

-- No anon policy is created → unauthenticated read/write denied by default (Req 8.6)
```

> **Design decision — admin read-all (Req 8.5) — DECIDED.** This phase's migration includes a small forward-compatible `public.is_admin(uuid) RETURNS boolean` shim that returns `false` for now (no admins yet); Phase 7 replaces its body with the real `has_role(uid,'admin')` check. The `proofs admin read` storage policy references `public.is_admin(auth.uid())`, so the policy exists today (capturing the bucket's intended access model) while granting nobody until roles ship — strictly safe. Operational admin access to proofs is via the `service_role` `supabaseAdmin` client server-side until Phase 7, so it does not depend on this policy.

### TypeScript types

`src/integrations/supabase/types.ts` is generated; after the migration it will gain `deposit_requests`, `withdrawal_requests`, and the `request_status` enum. The design treats it as regenerated (not hand-edited). The shared `RequestRow` type above is the app-facing projection.


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Property-based testing **is appropriate** for this feature's pure-logic core: amount/method/proof validation, the dedupe window, history merging/sorting/pagination, the available-balance guard, the no-money-movement invariant, status→badge mapping, the brand lexical guard, and HMAC signature verification. RLS, storage policies, schema/DDL, the test-credit DB credit, and architectural rules are verified with integration, smoke, and static checks instead (see Testing Strategy). The properties below are the consolidated, non-redundant set from the prework.

### Property 1: Amount accepted iff numeric, in range, and at most two decimals

*For any* string input and any configured minimum (`0.01` for deposits, `0.01` for withdrawals) and maximum (`999,999,999.99`), `parseAmount` accepts the value **if and only if** it is numeric, lies within `[min, max]`, and has at most two decimal places; when it accepts, the normalized value round-trips to the same 2-decimal number, and when it rejects, the submit handler returns an `invalid_amount` error and persists no request row.

**Validates: Requirements 5.2, 5.3, 6.2, 6.3**

### Property 2: Method accepted iff in the supported allow-list

*For any* method string, the submit handler accepts it **if and only if** it belongs to the request type's allow-list (`DEPOSIT_METHODS` for deposits; `WITHDRAWAL_METHODS` with length ≤ 30 for withdrawals); otherwise it returns an `invalid_method` error and persists no row.

**Validates: Requirements 5.6, 6.6**

### Property 3: Proof accepted iff allowed type and size

*For any* attached file described by `(mimeType, byteSize)`, proof validation accepts it **if and only if** `mimeType ∈ {image/jpeg, image/png, application/pdf}` and `byteSize ≤ 10 MB`; an accepted proof's stored path is recorded in `proof_url`, and a rejected proof yields an `invalid_proof` error with no row persisted.

**Validates: Requirements 5.4, 5.7, 6.4**

### Property 4: A valid submission creates exactly one pending request owned by the caller

*For any* valid `(amount, method[, proof])` and request type (deposit or withdrawal), submitting creates exactly one row in the matching table with `status = 'pending'` and `user_id` equal to the authenticated caller's id.

**Validates: Requirements 5.1, 6.1**

### Property 5: Deposit submissions are idempotent within the dedupe window

*For any* deposit `(amount, method)`, submitting it twice within `DEDUPE_WINDOW_MS` (60 seconds) results in exactly one persisted deposit row, and the second call returns the existing pending request rather than creating a duplicate.

**Validates: Requirement 5.8**

### Property 6: Withdrawal exceeding available balance is rejected without side effects

*For any* wallet state `(balance, locked)` and any requested `amount` such that `amount > balance − locked`, the withdrawal submit returns an `insufficient_balance` error, persists no withdrawal row, and leaves all wallet balances unchanged.

**Validates: Requirements 6.7, 9.4**

### Property 7: Submission never moves money

*For any* deposit or withdrawal submission (whether it succeeds or is rejected), the caller's wallet `balance` and `locked` values are identical before and after the call, and no ledger entry is written by the submission.

**Validates: Requirements 9.3, 9.4**

### Property 8: A Farmer sees and inserts exactly their own requests

*For any* collection of deposit/withdrawal rows spread across multiple users, selecting as user `U` returns exactly the rows whose `user_id = U`, and an insert is permitted **if and only if** the new row's `user_id = U`; cross-user selects and inserts are denied by RLS.

**Validates: Requirements 4.3, 4.4, 4.5**

### Property 9: History is the caller's deposits and withdrawals, projected and sorted newest-first

*For any* set of the caller's deposit and withdrawal rows, `listMyRequests` returns exactly those rows (no more, no fewer), each projected with `amount`, `method`, `status`, `type` (`deposit`/`withdrawal`), and `created_at`, ordered by `created_at` descending.

**Validates: Requirements 7.1, 7.2**

### Property 10: Pagination returns at most 20 per page and traverses every request once

*For any* number `N` of the caller's requests, each page returned by `listMyRequests` contains at most 20 items, and following `nextCursor` until it is null yields every request exactly once in descending `created_at` order with no duplicates or gaps.

**Validates: Requirement 7.5**

### Property 11: Status indicator matches request status

*For any* request status in `{pending, approved, rejected}`, the status-badge mapping produces the corresponding distinct indicator and never maps two different statuses to the same indicator.

**Validates: Requirements 7.3, 7.4**

### Property 12: Proof object access is authorized iff path is uid-prefixed

*For any* object path in the `proofs` bucket, an authenticated Farmer may insert or read it **if and only if** the path's first segment equals that Farmer's own uid; any other path (or an unauthenticated request) is denied.

**Validates: Requirements 8.2, 8.3, 8.4, 8.6**

### Property 13: The privileged credit occurs iff the request signature is valid

*For any* request body and signature header presented to the test-credit route, the privileged credit (`wallet_adjust('deposit')` invocation) is performed **if and only if** the signature is a valid HMAC of the body under the server secret; an invalid or missing signature results in rejection with no balance or ledger change.

**Validates: Requirements 10.2, 14.2, 14.3**

### Property 14: Test-credit amount/field validation rejects bad input without side effects

*For any* test-credit payload whose amount is non-numeric, zero, or negative (or whose target user id is missing), the route returns a validation error identifying the invalid field and performs no balance or ledger change.

**Validates: Requirement 10.5**

### Property 15: No user-facing brand token reads "VFarm" unless it is "VFarmers"

*For any* user-facing string or attribute rendered by the Brand_Renderer surfaces, a case-sensitive search for the token `VFarm` matches only when immediately followed by `ers` (i.e., the only allowed brand token is "VFarmers"); asset filename imports such as `vfarm-logo.png` are excluded as non-user-facing.

**Validates: Requirements 1.2, 1.4**

## Error Handling

All server functions return typed errors via a discriminated `RequestErrorCode` and never leak stack traces or SQL detail to the client (Req 7.7). The global `errorMiddleware` in `src/start.ts` remains the last-resort 500 handler.

| Condition | Where caught | Client-visible result | Requirement |
| --- | --- | --- | --- |
| No / malformed bearer token | `requireSupabaseAuth` | `unauthorized` (throws before handler) | 5.5, 6.5, 11.2 |
| Amount non-numeric / out of range / >2dp | handler (`parseAmount`) | `invalid_amount`, no row | 5.3, 6.3 |
| Unknown / missing / too-long method | handler (zod enum + length) | `invalid_method`, no row | 5.6, 6.6 |
| Proof wrong type / >10MB | handler (`validateProof`) | `invalid_proof`, no row | 5.7, 6.4 |
| Withdrawal > available balance | handler (wallet read) | `insufficient_balance`, no row, no balance change | 6.7, 9.4 |
| Duplicate deposit within 60s | handler (dedupe query) | success returning existing pending row (not an error) | 5.8 |
| Proof upload failure (storage) | handler (catch upload) | `internal`; request row **not** inserted (fail closed) | 5.4, 8 |
| RLS check fails on insert | Postgres | surfaced as `internal`/denied; no row | 4.4 |
| History query failure / unauth | handler / middleware | error response; UI shows error state, renders **no** partial/stale rows | 7.7 |
| Test-credit invalid/missing signature | route handler | `401`, no DB effect | 10.2, 14.3 |
| Test-credit bad amount / missing user | route handler | `400` naming field, no DB effect | 10.5 |
| Test-credit secret unset | route handler | `503` not-configured | 13.2 |

UI error/empty states (Req 7.3/7.4/7.6/7.7): the history view renders (a) a skeleton while loading, (b) an empty-state card when zero requests, (c) per-row status badges (pending = amber, approved = green, rejected = red/destructive), and (d) a single error banner with a retry action on failure, with no request rows shown.

## Security considerations

- **Auth enforcement (Req 11):** every user-scoped server fn uses `requireSupabaseAuth`; the client attaches the bearer token via the single existing `attachSupabaseAuth` global middleware — no new middleware is introduced.
- **RLS is the source of truth (Req 4):** even though the server fn sets `user_id = context.userId`, inserts go through the user-JWT `context.supabase` client so the `WITH CHECK (auth.uid() = user_id)` policy independently enforces ownership. Reads are RLS-scoped, so a logic bug cannot leak another Farmer's rows.
- **Storage isolation (Req 8):** the `proofs` bucket is private; object paths are uid-prefixed and policies bind access to `(storage.foldername(name))[1] = auth.uid()`. No `anon` policy exists, so unauthenticated access is denied by default. Proof files are served to owners via short-lived `supabaseAdmin` signed URLs server-side.
- **Money-movement isolation (Req 9, 10):** `wallet_transfer`/`wallet_adjust` are `SECURITY DEFINER` and `EXECUTE`-granted to `service_role` only (confirmed in migrations `20260607004431` / `...4455`). The browser can never call them; only the service-role test-credit route can credit balances — via `wallet_adjust('deposit')` (a deposit has no source wallet, so `wallet_transfer` is not used) — and submissions never move money.
- **Test-credit hardening (Req 10, 13, 14):** lives under `src/routes/api/public/`, authenticates by HMAC-SHA256 over the raw body with a server-only secret read **inside** the handler, uses constant-time comparison, and rejects stale timestamps to limit replay. Browser `anon`/`authenticated` sessions cannot forge the signature and are rejected. The secret never reaches the client bundle (Req 13.1).
- **No client-scope secrets (Req 13):** `requests.shared.ts` (client-imported) contains only constants and zod schemas — no `process.env`. All env reads happen in `.handler()`/route handlers or `.server.ts` modules.
- **SSR-safe routing (Req 12):** wallet screens live under `_authenticated` (which already guards via `beforeLoad` redirect, `ssr:false`); no protected loader is attached to a public route; the route file is created before any `<Link>` targets it.

## Testing Strategy

A dual approach: **property-based tests** for the pure-logic core, plus **example, integration, smoke, and static** tests for everything PBT does not fit (RLS, storage, schema, architecture rules).

### Property-based tests
- **Library:** `fast-check` with Vitest (TypeScript), the standard PBT library for this stack — not hand-rolled.
- **Iterations:** each property test runs **≥ 100** generated cases (`fc.assert(..., { numRuns: 100 })`).
- **Tagging:** every property test is tagged with a comment in the form
  `// Feature: phase-3-deposits-withdrawals, Property {n}: {property text}`.
- **Coverage:** Properties 1–15. Properties 1–7, 9–11, 13–15 are exercised against the pure functions (`parseAmount`, method/proof validators, dedupe predicate, merge/sort/paginate, `statusBadge`, `verifySignature`, the brand lexical guard) with the database/storage/wallet layers mocked so 100+ iterations stay fast and deterministic. Property 8 (RLS) and Property 12 (storage path auth) are run as **property-style integration tests** against a local Supabase instance with generated multi-user row/path sets (smaller `numRuns`, e.g. 25–50, due to DB cost) — these test the policy, not pure code.
- **Generators:** amounts as arbitrary numeric strings (including negatives, huge values, 3+ decimals, non-numeric); methods drawn from both allow-listed and arbitrary strings; files as `(mime, size)` across/inside the allowed set; row sets as arrays of `{user_id, created_at, type}`; signatures as valid-vs-corrupted HMACs.

### Example / unit tests
- Unauthenticated submit → `unauthorized`, no row (Req 5.5/6.5/11.2) — one test covering both fns.
- Default status `pending` and timestamp population on insert (Req 2.4/2.5).
- Empty history → empty state, zero rows (Req 7.6); failure → error state, no rows (Req 7.7).
- Per-file brand string/snapshot assertions for `index.tsx`, `auth.tsx`, `dashboard.tsx`, `__root.tsx` (Req 1.5–1.12).

### Integration tests (local Supabase, 1–3 examples each)
- RLS own-row select/insert with two real JWTs (Req 3.3, 4.3/4.4); cross-user denial.
- Proof upload to `proofs/{uid}/...` succeeds; non-uid path denied; anon denied (Req 8.2/8.3/8.4/8.6).
- Test-credit happy path: signed call credits Primary wallet by amount and writes exactly one `deposit` ledger row in one transaction (Req 10.1, 9.2); browser/anon call denied (Req 10.3/10.4).
- `wallet_adjust('deposit')` atomicity: balance delta equals ledger amount (Req 9.2).

### Smoke / schema / static checks
- Schema: `deposit_requests`/`withdrawal_requests` columns, types, defaults, checks; `request_status` enum = exactly the three values (Req 2.1/2.2/2.3); RLS enabled + policies present (Req 4.1/4.2); `proofs` bucket exists and is private (Req 8.1).
- Grants: `authenticated` + `service_role` granted, `anon` has no privileges on request tables (Req 3.1/3.2/3.3); money mutators remain `service_role`-only (Req 9.1/9.3).
- Architecture/static lint: request server logic uses `createServerFn` (Req 11.1); single `attachSupabaseAuth` in `start.ts` (Req 11.3); no protected loader on public routes (Req 12.1); wallet route under `_authenticated` (Req 12.3); test-credit under `api/public/` (Req 14.1); no module-scope `process.env` in client-imported files (Req 13.1); typecheck/build passes so every `<Link>` target route exists (Req 12.2).
- Brand regression guard: case-sensitive search asserts no user-facing `VFarm(?!ers)` token, excluding `vfarm-logo.png` import paths (Req 1.2/1.4); logo `alt` equals "VFarmers" (Req 1.12); `vfarm-logo.png` filename and lowercase `package.json` `name` unchanged (Req 1.13/1.14).

### Out of scope (deferred to Phase 7)
- Admin approval flow and admin read-all proof access (Req 8.5) — verified once `has_role()` exists; the `is_admin()` shim defaults to `false` until then.

## Requirements coverage summary

| Requirement | Covered by |
| --- | --- |
| 1 (rename) | Brand change list; Property 15; example/snapshot + smoke guard |
| 2 (data model) | Data Models + migration SQL; smoke schema checks; Property 1 (amount>0) |
| 3 (grants) | Migration grants; smoke grant checks |
| 4 (RLS) | Migration policies; Property 8; integration |
| 5 (deposit submit) | `submitDepositRequest`; Properties 1–5, 7; unauth example |
| 6 (withdrawal submit) | `submitWithdrawalRequest`; Properties 1–4, 6, 7 |
| 7 (history) | `listMyRequests`; Properties 9–11; empty/error examples |
| 8 (proofs bucket) | Storage policies; Property 12; integration |
| 9 (money via SECURITY DEFINER) | Properties 6, 7; smoke/static + integration |
| 10 (test-credit) | `test-credit.ts`; Properties 13, 14; integration |
| 11 (server-fn auth) | Architecture; smoke/static; unauth example |
| 12 (SSR routing) | Route layout; smoke/static; build |
| 13 (client env safety) | `requests.shared.ts` design; static scan |
| 14 (webhook placement) | `api/public/test-credit.ts`; Property 13; smoke |
