# Tests

Vitest + fast-check. Run with `bun run test` (CI) or `bun run test:watch`.

## Environments

`vitest.config.ts` defines two environments:

- **node** (default) — pure-logic and server-function tests.
- **jsdom** — component tests; name the file `*.dom.test.tsx` to opt in.

The `@/` path alias resolves via `vite-tsconfig-paths`.

## Property-based tests

Properties 1–15 are defined in
`.kiro/specs/phase-3-deposits-withdrawals/design.md` → _Correctness Properties_.
Pure-logic property tests run `fc.assert(prop, { numRuns: 100 })`. Each is
tagged with a comment:

```
// Feature: phase-3-deposits-withdrawals, Property {n}: {property text}
```

## Integration tests (local Supabase)

DB-backed tests (RLS, storage paths, the test-credit credit) require a local
Supabase instance:

```
supabase start   # provides local Postgres + Storage
```

Connection values are read from the environment **at runtime** (never at client
module scope), e.g. `SUPABASE_TEST_URL`, `SUPABASE_TEST_ANON_KEY`,
`SUPABASE_TEST_SERVICE_ROLE_KEY`. Integration suites are gated behind a presence
check of `SUPABASE_TEST_URL`, so `vitest run` stays green without a live DB:

```ts
const RUN_DB = !!process.env.SUPABASE_TEST_URL;
(RUN_DB ? describe : describe.skip)("RLS own-row", () => { /* ... */ });
```

DB-backed property-style tests use a reduced `numRuns` (25–50) per the design's
cost note.
