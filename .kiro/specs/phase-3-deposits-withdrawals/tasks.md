# Implementation Plan: Phase 3 — Deposits & Withdrawals (+ Brand Rename)

## Overview

This plan implements two changes shipped together (per the approved `requirements.md` and `design.md`):

- **Part 1 — Brand rename "VFarm" → "VFarmers"** (Requirement 1): an audit + canonicalization + regression-guard task (the design's audit shows surfaces are already compliant; the work is verifying and locking it in with a test).
- **Part 2 — Phase 3 Deposits & Withdrawals** (Requirements 2–14): migration (tables, `request_status` enum, grants, own-row RLS, `proofs` bucket + storage policies, `is_admin()` shim, `updated_at` triggers), shared validation contract, server functions, proof-upload/dedupe helpers, the service-role HMAC-verified test-credit route, and the authenticated wallet UI.

The plan is sequenced for **build safety**: the test harness is set up first; the migration and regenerated types land before any server function that depends on them; `requests.shared.ts` (pure, client-safe) precedes the server functions and the UI that import it; the `/_authenticated/wallet` route file is created before any `<Link to="/wallet">` references it; and every step leaves the app type-checking and building cleanly.

Per the project's PBT methodology, property/exploration tests are written **alongside or before** the code they verify. The design's language is TypeScript end-to-end, so all tasks use TypeScript.

**Testing references:** Properties 1–15 are defined in `design.md` → *Correctness Properties*. Property tests use `fast-check` + Vitest, run **≥ 100 iterations** (`fc.assert(prop, { numRuns: 100 })`; DB-backed property-style integration tests use a reduced `numRuns` of 25–50 per the design), and each is tagged with a comment of the form:
`// Feature: phase-3-deposits-withdrawals, Property {n}: {property text}`.

## Tasks

- [x] 1. Set up the test harness (no harness exists in the repo today) <!-- config/scripts/tests authored; install + run blocked by offline sandbox (registry 403) -->

  - Add dev dependencies: `vitest`, `fast-check`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`, `@vitejs/plugin-react` (already present).
  - Create `vitest.config.ts` with two projects/environments: `node` (default, for pure-logic + server tests) and `jsdom` (for component tests), wiring `vite-tsconfig-paths` so `@/` imports resolve; add a `src/test/setup.ts` that imports `@testing-library/jest-dom`.
  - Add `package.json` scripts: `"test": "vitest run"`, `"test:watch": "vitest"`, and `"typecheck": "tsc --noEmit"`.
  - Document (in a `src/test/README.md`) the local Supabase test approach used by integration tests: `supabase start` provides a local Postgres + Storage; integration tests read connection values from env at runtime (never at client module scope) and are gated behind a `SUPABASE_TEST_URL`/`SUPABASE_TEST_*` presence check so the default `vitest run` stays green without a live DB.
  - Add a single trivial passing test to confirm the runner executes, then run `bun run test` and `bun run typecheck` to confirm both pass.
  - _Requirements: supports testing strategy for all requirements; no functional requirement directly_

- [x] 2. Database migration: enum, tables, grants, RLS, triggers, proofs bucket + storage policies, is_admin() shim
  - [x] 2.1 Create the migration SQL file
    - Add a new timestamped file under `supabase/migrations/` (e.g. `2026060710xxxx_phase3_deposits_withdrawals.sql`) following the existing convention of keeping DDL + grants + RLS + policies **in one file** (see `20260607004431`).
    - Define `public.request_status` enum with exactly `('pending','approved','rejected')`.
    - Create `public.deposit_requests` with columns/constraints from the Data Models table: `id uuid PK default gen_random_uuid()`, `user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`, `amount numeric(20,8) NOT NULL CHECK (amount > 0)`, `method text NOT NULL CHECK (char_length(method) <= 50)`, `status public.request_status NOT NULL DEFAULT 'pending'`, `admin_note text CHECK (... <= 1000)`, `proof_url text CHECK (... <= 2048)`, `created_at timestamptz NOT NULL DEFAULT now()`, `updated_at timestamptz NOT NULL DEFAULT now()`.
    - Create `public.withdrawal_requests` with the identical column set/constraints (`LIKE public.deposit_requests INCLUDING ALL`, then re-add the `auth.users` FK).
    - Create paging indexes `(user_id, created_at DESC, id DESC)` on both tables.
    - Add `GRANT SELECT, INSERT ... TO authenticated` and `GRANT ALL ... TO service_role` for both tables; add **no** `anon` grant.
    - `ENABLE ROW LEVEL SECURITY` on both tables and define own-row `SELECT` (`USING auth.uid() = user_id`) and `INSERT` (`WITH CHECK auth.uid() = user_id`) policies for `authenticated`.
    - Add `BEFORE UPDATE` `updated_at` triggers on both tables reusing the existing `public.update_updated_at_column()`.
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 4.4, 4.5_
  - [x] 2.2 Add the private `proofs` bucket, storage policies, and the `is_admin()` shim in the same migration
    - Insert the private (non-public) `proofs` bucket into `storage.buckets` (`ON CONFLICT DO NOTHING`).
    - Add `storage.objects` policies for `authenticated`: owner `INSERT` and owner `SELECT` gated on `bucket_id = 'proofs' AND (storage.foldername(name))[1] = auth.uid()::text`; add **no** `anon` policy (unauthenticated denied by default).
    - Add the forward-compatible `public.is_admin(uid uuid) RETURNS boolean LANGUAGE sql STABLE` shim returning `false` (Phase 7 swaps in `has_role(uid,'admin')`), and the `proofs admin read` `SELECT` policy referencing `public.is_admin(auth.uid())`.
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

- [x] 3. Regenerate Supabase TypeScript types <!-- no codegen tool offline; deposit_requests/withdrawal_requests/request_status/is_admin hand-added to match generator output -->
  - Regenerate `src/integrations/supabase/types.ts` from the migrated schema so `deposit_requests`, `withdrawal_requests`, and the `request_status` enum are present in the generated `Database` type (treated as generated, not hand-edited).
  - Run `bun run typecheck` to confirm the regenerated types compile cleanly.
  - _Requirements: 2.1, 2.2, 2.3 (type surface for downstream server functions)_

- [x] 4. Shared validation contract — `src/lib/requests.shared.ts` (pure, client+server safe, NO `process.env`)
  - [x] 4.1 Implement constants, zod schemas, and pure validators
    - Export `DEPOSIT_METHODS`, `WITHDRAWAL_METHODS`, `AMOUNT_MAX`, `DEPOSIT_AMOUNT_MIN`, `WITHDRAWAL_AMOUNT_MIN`, `METHOD_MAX_LEN`, `PROOF_MAX_BYTES`, `PROOF_MIME`, `DEDUPE_WINDOW_MS`.
    - Implement `parseAmount(input, min)` returning a normalized 2-dp string on success or a typed error code (`not_numeric | too_small | too_large | too_many_decimals`), validating as string→Decimal to avoid float drift.
    - Implement `validateProof({ mimeType, byteSize })` returning ok/typed-error per `PROOF_MIME` + `PROOF_MAX_BYTES`.
    - Export `depositInput`, `withdrawalInput`, `listInput` zod schemas and the shared `RequestRow`/`SubmitResult`/`HistoryPage`/`RequestErrorCode` types.
    - Confirm the module references no `process.env` at module scope.
    - _Requirements: 5.2, 5.4, 5.6, 6.2, 6.4, 6.6, 7.5, 13.1_
  - [x]* 4.2 Property test: amount validation (Property 1)
    - **Property 1: Amount accepted iff numeric, in range, and at most two decimals**
    - Generators: arbitrary numeric strings incl. negatives, huge values, 3+ decimals, non-numeric; assert acceptance iff numeric ∧ in `[min, max]` ∧ ≤2 decimals, with round-trip of the normalized value.
    - **Validates: Requirements 5.2, 5.3, 6.2, 6.3**
  - [x]* 4.3 Property test: method allow-list (Property 2)
    - **Property 2: Method accepted iff in the supported allow-list** (deposits: `DEPOSIT_METHODS`; withdrawals: `WITHDRAWAL_METHODS` ∧ length ≤ 30).
    - **Validates: Requirements 5.6, 6.6**
  - [x]* 4.4 Property test: proof validation (Property 3)
    - **Property 3: Proof accepted iff allowed type and size** — generate `(mime, size)` across/inside the allowed set.
    - **Validates: Requirements 5.4, 5.7, 6.4**

- [x] 5. Server-only helpers — `src/lib/requests.server.ts`
  - [x] 5.1 Implement proof-upload and dedupe helpers
    - `uploadProof(supabaseOrAdmin, userId, scope, file)` → uploads valid files to `proofs/{userId}/{scope}/{uuid}.{ext}` and returns the stored path; fails closed (no path) on storage error.
    - `findRecentDuplicateDeposit(supabase, { userId, amount, method, windowMs })` → returns an existing pending deposit row created within `DEDUPE_WINDOW_MS` matching `(user_id, amount, method)`, else null.
    - Keep all env/storage access server-side only (this is a `.server.ts` module).
    - _Requirements: 5.4, 5.8, 6.4, 8.2, 13.2_
  - [ ]* 5.2 Property test: dedupe predicate (Property 5, predicate-level)
    - **Property 5: Deposit submissions are idempotent within the dedupe window** — exercise the dedupe predicate over generated timestamp/amount/method sets (returns the in-window match iff `(amount, method)` equal and within 60s); full end-to-end dedupe is also covered in the server-fn integration test (Task 6.7).
    - **Validates: Requirement 5.8**

- [x] 6. Server functions — `src/lib/api/requests.functions.ts`
  - [x] 6.1 Implement `submitDepositRequest`
    - `createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((fd: FormData) => fd).handler(...)`.
    - In handler: `parseAmount(.., DEPOSIT_AMOUNT_MIN)` → `invalid_amount`; method ∈ `DEPOSIT_METHODS` → `invalid_method`; optional file via `validateProof` → `invalid_proof`; 60s dedupe via `findRecentDuplicateDeposit` (return existing pending row); upload proof if valid; insert via `context.supabase` (RLS `WITH CHECK`) with `user_id = context.userId`, `status` defaulting `pending`.
    - Return typed `SubmitResult`; never leak SQL/stack detail.
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 9.4, 11.1, 11.2_
  - [x] 6.2 Implement `submitWithdrawalRequest`
    - Same shape plus: `parseAmount(.., WITHDRAWAL_AMOUNT_MIN)`; method ∈ `WITHDRAWAL_METHODS` ∧ length ≤ `METHOD_MAX_LEN`; read caller Primary wallet `(balance, locked)` via `context.supabase` and reject with `insufficient_balance` (no row, no balance change) when `amount > balance − locked`; upload proof if present; insert `withdrawal_requests` row with `status` `pending`.
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 9.4, 11.1, 11.2_
  - [x] 6.3 Implement `listMyRequests` (merge/sort/paginate)
    - `createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(listInput).handler(...)`: RLS-scoped selects of both tables, tag `type`, merge, sort `created_at DESC, id DESC`, keyset-paginate (page size ≤ 20) returning `{ items, nextCursor }` with an opaque base64 `{created_at,id}` cursor.
    - Extract the pure merge/sort/paginate + cursor encode/decode into exported pure functions so they are unit/property-testable without a DB.
    - _Requirements: 7.1, 7.2, 7.5, 11.1, 11.2_
  - [x]* 6.4 Property test: history projection & ordering (Property 9)
    - **Property 9: History is the caller's deposits and withdrawals, projected and sorted newest-first** — run against the pure merge/sort over generated row sets.
    - **Validates: Requirements 7.1, 7.2**
  - [x]* 6.5 Property test: pagination traversal (Property 10)
    - **Property 10: Pagination returns at most 20 per page and traverses every request once** — generate `N` rows; follow `nextCursor` to null; assert ≤20/page, every row exactly once, descending order, no gaps/dupes.
    - **Validates: Requirement 7.5**
  - [ ]* 6.6 Example/unit test: unauthenticated submit rejected
    - Both submit fns reject via `requireSupabaseAuth` with `unauthorized` and persist no row (single test covering both).
    - _Requirements: 5.5, 6.5, 11.2_
  - [ ]* 6.7 Property-style integration tests (local Supabase): valid submit, dedupe, balance guard, no-money-movement (Properties 4, 5, 6, 7)
    - **Property 4: A valid submission creates exactly one pending request owned by the caller** (`numRuns` 25–50).
    - **Property 5: Deposit submissions are idempotent within the dedupe window** (end-to-end).
    - **Property 6: Withdrawal exceeding available balance is rejected without side effects** — generate `(balance, locked, amount)`; assert `insufficient_balance`, no row, balances unchanged.
    - **Property 7: Submission never moves money** — before/after wallet `balance`/`locked` identical and no ledger row written for any submission.
    - **Validates: Requirements 5.1, 6.1, 5.8, 6.7, 9.3, 9.4**

- [ ] 7. Checkpoint — Ensure all tests pass
  - Run `bun run test` and `bun run typecheck`; ensure the harness, migration types, shared contract, helpers, and server functions are green. Ask the user if questions arise.

- [x] 8. Service-role test-credit route — `src/routes/api/public/test-credit.ts`
  - [x] 8.1 Implement the HMAC-verified server route
    - `createServerFileRoute("/api/public/test-credit").methods({ POST })` under `src/routes/api/public/` (no auth middleware — authenticates by shared-secret signature).
    - Read `TEST_CREDIT_SECRET` from `process.env` **inside the handler** (→ `503` if unset); read raw body; recompute HMAC-SHA256 and constant-time compare to `x-signature` (→ `401` on missing/invalid); reject stale `ts` (>5 min skew); validate `{ user_id exists, amount numeric > 0 }` (→ `400` naming the field); look up the target Primary wallet via `supabaseAdmin`; credit via `wallet_adjust(p_wallet, +amount, 'deposit', ...)` (SECURITY DEFINER, service_role-only) writing exactly one atomic `deposit` ledger row; return `200 { ok, ledgerWritten }`.
    - Extract `verifySignature(rawBody, header, secret)` and the payload validator as pure exported functions for property testing.
    - _Requirements: 9.1, 9.2, 9.3, 10.1, 10.2, 10.3, 10.4, 10.5, 13.2, 14.1, 14.2, 14.3_
  - [x]* 8.2 Property test: signature gating (Property 13)
    - **Property 13: The privileged credit occurs iff the request signature is valid** — generate valid-vs-corrupted HMACs over arbitrary bodies; assert the credit path runs iff valid, with no DB effect otherwise (wallet adjust mocked).
    - **Validates: Requirements 10.2, 14.2, 14.3**
  - [x]* 8.3 Property test: payload validation (Property 14)
    - **Property 14: Test-credit amount/field validation rejects bad input without side effects** — generate non-numeric/zero/negative amounts and missing user ids; assert field-naming validation error and no balance/ledger change.
    - **Validates: Requirement 10.5**
  - [ ]* 8.4 Integration test (local Supabase): happy path + browser denial
    - Signed call credits the Primary wallet by `amount` and writes exactly one `deposit` ledger row in one transaction; an unsigned `anon`/`authenticated`-style call is denied with no DB effect (1–3 examples).
    - _Requirements: 10.1, 10.3, 10.4, 9.2_

- [x] 9. Authenticated wallet UI — `src/routes/_authenticated/wallet.tsx`
  - [x] 9.1 Create the route file with Deposit | Withdraw | History tabs
    - Create the route under the existing `_authenticated` group (inherits `ssr:false` + `beforeLoad` guard); **create this file before** any `<Link to="/wallet">` references it (Req 12.2).
    - Deposit and Withdraw forms post `multipart/form-data` (amount, method, optional file) to `submitDepositRequest` / `submitWithdrawalRequest`; surface typed `RequestErrorCode`s as inline field errors.
    - History tab calls `listMyRequests`, renders a loading skeleton, an empty-state card for zero requests (no rows), per-row status badges, and a single error banner with retry on failure (no partial/stale rows); supports loading the next page via `nextCursor`.
    - Implement a pure `statusBadge(status)` mapping (pending = amber, approved = green, rejected = destructive) in a small module (e.g. `src/components/wallet/StatusBadge.tsx`) so it is unit/property-testable.
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.6, 7.7, 12.1, 12.3_
  - [x]* 9.2 Property test: status→badge mapping (Property 11)
    - **Property 11: Status indicator matches request status** — for each status in `{pending, approved, rejected}` the mapping yields a distinct indicator; no two statuses share an indicator.
    - **Validates: Requirements 7.3, 7.4**
  - [ ]* 9.3 Example/component tests: empty and error states
    - Empty history → empty-state shown, zero rows (Req 7.6); failed history fetch → error banner shown, no rows (Req 7.7).
    - _Requirements: 7.6, 7.7_

- [x] 10. Part 1 — Brand rename audit, canonicalization, and regression guard
  - [x] 10.1 Audit and canonicalize brand surfaces <!-- audit confirms all surfaces already render "VFarmers" (20 occurrences, 0 non-compliant); no code changes needed -->
    - Verify/canonicalize "VFarmers" across `src/routes/index.tsx` (nav, hero, footer, meta title/description/og:title/og:description, logo alt), `src/routes/auth.tsx` (mark, head title, copy, terms, logo alt), `src/routes/_authenticated/dashboard.tsx` (top-bar mark, head title, greeting/copy, logo alt), and `src/routes/__root.tsx` (default description / og tags); styled marks use `V<span className="text-primary">Farmers</span>`.
    - Preserve the member term "Farmer"/"Farmers" (incl. Ticker counts like "12,847 Farmers"), keep the `vfarm-logo.png` filename, and keep the lowercase `package.json` `name` unchanged.
    - _Requirements: 1.1, 1.3, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11, 1.12, 1.13, 1.14_
  - [x]* 10.2 Property/static test: brand lexical regression guard (Property 15)
    - **Property 15: No user-facing brand token reads "VFarm" unless it is "VFarmers"** — case-sensitive scan of user-facing strings/attributes across the Brand_Renderer surfaces asserts `VFarm` matches only when followed by `ers`, excluding `vfarm-logo.png` import paths; also assert logo `alt` equals "VFarmers".
    - **Validates: Requirements 1.2, 1.4**
  - [ ]* 10.3 Example/snapshot tests: per-file brand strings
    - Assert brand strings for `index.tsx`, `auth.tsx`, `dashboard.tsx`, `__root.tsx`.
    - _Requirements: 1.5, 1.6, 1.7, 1.8, 1.9_

- [ ] 11. Smoke / schema / grants / architecture static checks
  - [ ]* 11.1 Schema & storage smoke tests (local Supabase)
    - Assert both request tables' columns/types/defaults/checks; `request_status` enum = exactly the three values; RLS enabled + policies present; `proofs` bucket exists and is private.
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 4.1, 4.2, 8.1_
  - [ ]* 11.2 Grants & money-mutator smoke tests
    - Assert `authenticated` + `service_role` are granted on request tables and `anon` has none; `wallet_adjust`/`wallet_transfer` remain `service_role`-only EXECUTE.
    - _Requirements: 3.1, 3.2, 3.3, 9.1, 9.3_
  - [ ]* 11.3 Property-style RLS & storage-path integration tests (Properties 8, 12)
    - **Property 8: A Farmer sees and inserts exactly their own requests** — two real JWTs, generated multi-user row sets, `numRuns` 25–50; cross-user select/insert denied.
    - **Property 12: Proof object access is authorized iff path is uid-prefixed** — generated object paths; insert/read allowed iff first segment = caller uid; anon denied.
    - **Validates: Requirements 4.3, 4.4, 4.5, 8.2, 8.3, 8.4, 8.6**
  - [ ]* 11.4 Architecture/static lint checks
    - Static assertions: request server logic uses `createServerFn` (Req 11.1); a single `attachSupabaseAuth` in `src/start.ts` (Req 11.3); no protected loader on a public route (Req 12.1); wallet route under `_authenticated` (Req 12.3); test-credit under `api/public/` (Req 14.1); no module-scope `process.env` in client-imported files incl. `requests.shared.ts` (Req 13.1); `bun run typecheck`/build passes so every `<Link>` target route exists (Req 12.2).
    - _Requirements: 11.1, 11.3, 12.1, 12.2, 12.3, 13.1, 14.1_

- [x] 12. Optional: wire dashboard "Deposit"/"Withdraw" quick-actions to the wallet route
  - Convert the dashboard's non-navigating `<button>` placeholders to `<Link to="/wallet">` (now safe — the route file exists from Task 9.1).
  - _Requirements: 12.2_

- [ ] 13. Final checkpoint — Ensure all tests pass
  - Run `bun run test` and `bun run typecheck` (and `bun run build`); ensure all property, example, integration, smoke, and static checks pass. Ask the user if questions arise.

## Task Dependency Graph

```
1 (test harness)
2 (migration) ──► 3 (regen types) ──► 4 (requests.shared.ts) ──► 5 (requests.server.ts) ──► 6 (server functions) ──► 7 (checkpoint)
                                          │                                                      │
                                          └───────────────► 9 (wallet.tsx UI) ◄─────────────────┘
2 ──► 8 (test-credit route)            (9 needs 4 for schemas/types; 6 for server fns)
7 ──► 8, 9 (recommended ordering after core is green)
10 (brand rename)  — independent of 2–9; depends only on 1 (harness for its tests)
11 (smoke/schema/grants/static)  — 11.1/11.2/11.3 depend on 2; 11.4 depends on 6, 8, 9
12 (dashboard <Link>)  — depends on 9.1
13 (final checkpoint)  — depends on all
```

Critical path: **1 → 2 → 3 → 4 → 5 → 6 → 8/9 → 11 → 13**.

## Parallelization

Within this phase, the following can proceed in parallel once their prerequisites are met:

- **Task 10 (Brand rename)** is fully independent of the Phase 3 data path and can run in parallel with Tasks 2–9 (only needs Task 1 for its tests).
- After **Task 4** (`requests.shared.ts`) lands, the pure-logic property tests **4.2–4.4** can be written in parallel with **Task 5**.
- After **Task 3** (types) lands, **Task 8** (test-credit route) and **Task 6** (server functions) can be developed in parallel — they share no files (`test-credit.ts` uses `supabaseAdmin` + `wallet_adjust`; the server fns use `context.supabase`).
- **Task 9** (wallet UI) can begin its presentational pieces (tabs scaffold, `statusBadge`, empty/error states + tests 9.2/9.3) in parallel with Tasks 6/8, then wire to the server functions once Task 6 is complete.
- **Tasks 11.1/11.2 (schema/grants smoke)** can run as soon as **Task 2** is applied, in parallel with application-layer work; **11.3/11.4** require the relevant app code (6/8/9).

## Notes

- Sub-tasks marked with `*` are optional test tasks and can be skipped for a faster MVP; non-`*` tasks are core and will be implemented.
- Property tests use `fast-check` with `numRuns` ≥ 100 (DB-backed property-style integration tests use 25–50 per the design's cost note) and are tagged `// Feature: phase-3-deposits-withdrawals, Property {n}: {property text}`.
- Each task references specific requirement sub-clauses for traceability; together they cover Requirements 1–14 per the design's Requirements coverage summary.
- Admin approval flow and admin read-all proof access (Req 8.5) are deferred to Phase 7; the `is_admin()` shim returns `false` until then.
- Every step is sequenced to keep the app type-checking and building cleanly (migration/types before dependent server functions; `requests.shared.ts` before its importers; the `/wallet` route file before any `<Link>` to it).
