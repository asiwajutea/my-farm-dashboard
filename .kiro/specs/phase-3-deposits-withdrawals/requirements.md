# Requirements Document

## Introduction

This spec covers two changes requested together for the VFarmers application (a TanStack Start + React + Supabase app where Phases 0–2 are complete: landing, auth, profiles, wallets with an immutable ledger via `wallet_transfer()`, and a dashboard reading real balances).

**Part 1 — Brand rename "VFarm" → "VFarmers":** Replace every user-facing occurrence of the brand name "VFarm" with "VFarmers" across the app, preserving the existing green-accent styling pattern. This is a pure brand/copy change and must not alter the existing member term "Farmer"/"Farmers", internal asset filenames, or the lowercase package name.

**Part 2 — Phase 3: Deposits & Withdrawals (manual / admin-first):** Allow an authenticated Farmer to submit deposit and withdrawal requests with optional proof-file upload, and to view their own request history and status. Admin approval tooling is deferred to a later phase (Phase 7) and is out of scope here; however, the database, RLS policies, storage bucket, and money-movement plumbing (reusing `wallet_transfer()`) are established now. A service-role-only server route enables crediting test deposits so the feature can be exercised before admin tooling exists.

All database and server work must satisfy the project's build-safety rules (grants, RLS, SECURITY DEFINER money mutations, server-fn auth, SSR-safe routing, link/route ordering, no client-scope env access, and webhook placement), expressed below as testable acceptance criteria.

## Glossary

- **VFarmers**: The user-facing brand name of the product (formerly displayed as "VFarm"). Always rendered with the green accent pattern `V<span className="text-primary">Farmers</span>` in styled headings/marks, or as the plain string "VFarmers" in meta tags and prose.
- **Farmer / Farmers**: The existing term for a member/user of the platform. This term is unchanged by this spec.
- **Brand_Renderer**: The collective set of user-facing surfaces (nav, hero, footer, meta tags, auth page, dashboard, ticker, document title) that display the brand name.
- **Deposit_Request**: A record in the `deposit_requests` table representing a Farmer's request to add funds, with a lifecycle status of `pending`, `approved`, or `rejected`.
- **Withdrawal_Request**: A record in the `withdrawal_requests` table representing a Farmer's request to remove funds, with a lifecycle status of `pending`, `approved`, or `rejected`.
- **Request_Status**: The Postgres enum with values `pending`, `approved`, `rejected` shared by Deposit_Request and Withdrawal_Request.
- **Proofs_Bucket**: A Supabase Storage bucket named `proofs` holding optional proof-of-payment files; owner-write, admin-read.
- **Request_Service**: The set of `createServerFn` server functions that create and read Deposit_Request and Withdrawal_Request records on behalf of the authenticated Farmer.
- **Test_Credit_Route**: A service-role-only server route that credits a test deposit by invoking `wallet_transfer()`, used for testing before admin tooling exists.
- **wallet_transfer()**: The existing SECURITY DEFINER Postgres function that atomically updates wallet balances and inserts immutable ledger rows in a single transaction.
- **requireSupabaseAuth**: The existing server-side helper that resolves and requires an authenticated Supabase user within a server function handler.
- **attachSupabaseAuth**: The existing function middleware (wired in `src/start.ts`) that attaches Supabase auth context to server-function requests.
- **Migration**: A single SQL migration file applied to the Supabase Postgres database.
- **RLS**: Row Level Security, the Postgres mechanism restricting row access per database role and policy.

## Requirements

### Requirement 1: Rename user-facing brand to "VFarmers"

**User Story:** As a visitor or Farmer, I want the product to consistently display the brand "VFarmers", so that the branding is coherent across every screen and shareable preview.

#### Acceptance Criteria

1. THE Brand_Renderer SHALL display the brand name as "VFarmers" in every user-facing location enumerated in this requirement (navigation, hero, footer, meta tags, auth page, dashboard, ticker, document title, and logo alt text).
2. THE Brand_Renderer SHALL, using case-sensitive matching, render no user-facing text or attribute that contains the token "VFarm" unless that token is immediately followed by "ers" (forming "VFarmers").
3. WHERE the brand name is rendered as a styled mark or heading, THE Brand_Renderer SHALL use the accent pattern `V<span className="text-primary">Farmers</span>`.
4. THE Brand_Renderer SHALL preserve the existing member term "Farmer" and "Farmers" without modification; the member term "Farmer"/"Farmers" is distinct from the brand token "VFarm"/"VFarmers" and is excluded from the brand replacement rule.
5. THE Brand_Renderer SHALL display "VFarmers" in the navigation brand mark, hero copy, and footer of `src/routes/index.tsx`.
6. THE Brand_Renderer SHALL set the brand name to "VFarmers" in all meta tags of `src/routes/index.tsx`, including the page title, description, `og:title`, and `og:description`.
7. THE Brand_Renderer SHALL display "VFarmers" in the brand mark, page title, "Welcome back"/"Become a Farmer" copy, and terms line of `src/routes/auth.tsx`.
8. THE Brand_Renderer SHALL display "VFarmers" in the top-bar brand mark, greeting, and copy of `src/routes/_authenticated/dashboard.tsx`.
9. WHERE `src/routes/__root.tsx` defines a default site description, `og:title`, `og:description`, or `og:site_name`, THE Brand_Renderer SHALL set the brand name within those values to "VFarmers".
10. WHERE `src/components/Ticker.tsx` contains brand text "VFarm", THE Brand_Renderer SHALL display "VFarmers" instead, while preserving member-term usages such as counts like "12,847 Farmers" unchanged.
11. WHERE `index.html` defines a document title containing the brand, THE Brand_Renderer SHALL set the brand within that title to "VFarmers".
12. THE Brand_Renderer SHALL set the `alt` text of the asset imported from `src/assets/vfarm-logo.png` to the exact string "VFarmers".
13. THE Brand_Renderer SHALL keep the asset filename `src/assets/vfarm-logo.png` unchanged.
14. THE Brand_Renderer SHALL keep the `package.json` `name` field lowercase and unchanged, and WHERE a `description` field references the brand, THE Brand_Renderer SHALL set the brand within that description to "VFarmers".

### Requirement 2: Deposit and withdrawal request data model

**User Story:** As a platform operator, I want deposit and withdrawal requests stored in dedicated tables with a clear status lifecycle, so that requests can be tracked and later approved.

#### Acceptance Criteria

1. THE Migration SHALL create a `deposit_requests` table containing: `user_id` (not null, foreign key referencing the authenticated user identifier in `auth.users`), `amount` (numeric with precision 20 and scale 8, not null), `method` (text, not null, maximum length 50 characters), `status` (Request_Status enum, not null), `admin_note` (nullable text, maximum length 1000 characters), `proof_url` (nullable text, maximum length 2048 characters), `created_at` (timestamp with time zone, not null), and `updated_at` (timestamp with time zone, not null).
2. THE Migration SHALL create a `withdrawal_requests` table containing the same columns and constraints as `deposit_requests` (`user_id`, `amount`, `method`, `status`, `admin_note`, `proof_url`, `created_at`, `updated_at`).
3. THE Migration SHALL define the Request_Status enum with exactly the three values `pending`, `approved`, and `rejected`, and no other values.
4. WHEN a `deposit_requests` or `withdrawal_requests` row is created without an explicit `status` value, THE Migration SHALL set the `status` column to `pending`.
5. WHEN a row is created without an explicit `created_at` or `updated_at` value, THE Migration SHALL set both columns to the current transaction timestamp.
6. IF an insert specifies an `amount` less than or equal to 0, or a `user_id` that does not reference an existing authenticated user, THEN THE Migration-defined constraints SHALL reject the insert and SHALL NOT persist the row.

### Requirement 3: Migration grants

**User Story:** As a developer, I want every migration to grant table privileges to the correct database roles, so that the application can read and write through PostgREST without permission errors.

#### Acceptance Criteria

1. WHERE a Migration creates a table in the `public` schema, THE Migration SHALL include `GRANT` statements for the `authenticated` and `service_role` roles in the same Migration.
2. WHERE a Migration creates a table whose RLS policy permits anonymous access, THE Migration SHALL include a `GRANT` statement for the `anon` role; otherwise THE Migration SHALL omit the `anon` grant.
3. THE Migration that creates `deposit_requests` and `withdrawal_requests` SHALL grant `authenticated` the privileges required to insert and select the requesting Farmer's own rows.

### Requirement 4: Row Level Security on request tables

**User Story:** As a Farmer, I want my deposit and withdrawal requests to be private to me, so that no other Farmer can see or alter my requests.

#### Acceptance Criteria

1. WHERE a Migration creates a table in the `public` schema, THE Migration SHALL enable RLS on that table within the same Migration.
2. WHERE a Migration enables RLS on a table, THE Migration SHALL define the table's RLS policies within the same Migration.
3. WHEN a Farmer selects from `deposit_requests` or `withdrawal_requests`, THE RLS policy SHALL return only rows whose `user_id` equals the authenticated Farmer's identifier.
4. WHEN a Farmer inserts into `deposit_requests` or `withdrawal_requests`, THE RLS policy SHALL permit the insert only when the new row's `user_id` equals the authenticated Farmer's identifier.
5. IF a Farmer attempts to select or insert a `deposit_requests` or `withdrawal_requests` row whose `user_id` does not equal the authenticated Farmer's identifier, THEN THE RLS policy SHALL deny the operation.

### Requirement 5: Submit a deposit request

**User Story:** As a Farmer, I want to submit a deposit request with an amount, method, and optional proof, so that my funds can be credited after review.

#### Acceptance Criteria

1. WHEN a Farmer submits a deposit request with a valid amount and a valid method, THE Request_Service SHALL create a `deposit_requests` row with `status` set to `pending` and `user_id` set to the authenticated Farmer's identifier.
2. THE Request_Service SHALL validate that the submitted deposit amount is a numeric value greater than 0, less than or equal to 999,999,999.99, and expressed with at most two decimal places before creating a Deposit_Request.
3. IF a Farmer submits a deposit request with an amount that is non-numeric, less than or equal to 0, greater than 999,999,999.99, or has more than two decimal places, THEN THE Request_Service SHALL reject the request without creating a `deposit_requests` row and return a validation error indicating the amount is invalid.
4. WHERE a Farmer attaches a proof file to a deposit request, THE Request_Service SHALL accept the file only when it is a JPEG, PNG, or PDF no larger than 10 MB, store the accepted file in the Proofs_Bucket, and record its reference in the `proof_url` column.
5. IF an unauthenticated client invokes the deposit submission server function, THEN THE Request_Service SHALL reject the call via `requireSupabaseAuth`.
6. IF a Farmer submits a deposit request whose `method` is missing or is not a member of the system's defined set of supported deposit methods, THEN THE Request_Service SHALL reject the request without creating a row and return a validation error indicating the method is invalid.
7. IF a Farmer attaches a proof file that is not a JPEG, PNG, or PDF, or that exceeds 10 MB, THEN THE Request_Service SHALL reject the request without creating a row and return a validation error indicating the proof file is invalid.
8. WHEN a Farmer submits a deposit request identical in amount and method to one the same Farmer created within the preceding 60 seconds, THE Request_Service SHALL NOT create a duplicate row and SHALL return the existing pending request.

### Requirement 6: Submit a withdrawal request

**User Story:** As a Farmer, I want to submit a withdrawal request with an amount, method, and optional proof, so that I can request funds be sent to me after review.

#### Acceptance Criteria

1. WHEN a Farmer submits a withdrawal request with a valid amount and a valid method, THE Request_Service SHALL create a `withdrawal_requests` row with `status` set to `pending` and `user_id` set to the authenticated Farmer's identifier.
2. THE Request_Service SHALL validate that the submitted withdrawal amount is a numeric value from 0.01 to 999,999,999.99 with at most two decimal places before creating a Withdrawal_Request.
3. IF a Farmer submits a withdrawal request with an amount that is non-numeric, less than 0.01, greater than 999,999,999.99, or has more than two decimal places, THEN THE Request_Service SHALL reject the request without creating a row and return a validation error indicating the amount is invalid.
4. WHERE a Farmer attaches a proof file to a withdrawal request, THE Request_Service SHALL accept the file only when it is a JPEG, PNG, or PDF no larger than 10 MB, store it in the Proofs_Bucket, and record its reference in the `proof_url` column; otherwise THE Request_Service SHALL reject the request with a validation error indicating the proof file is invalid.
5. IF an unauthenticated client invokes the withdrawal submission server function, THEN THE Request_Service SHALL reject the call via `requireSupabaseAuth`.
6. IF a Farmer submits a withdrawal request whose `method` is missing, longer than 30 characters, or not a member of the system's defined set of supported withdrawal methods, THEN THE Request_Service SHALL reject the request without creating a row and return a validation error indicating the method is invalid.
7. IF a Farmer submits a withdrawal request whose amount exceeds the Farmer's available Primary wallet balance (balance minus locked) at submission time, THEN THE Request_Service SHALL reject the request without creating a row and without changing any balance, and return an insufficient-balance error. (Validation only; submission never moves money, per Requirement 9.4.)

### Requirement 7: View own request history

**User Story:** As a Farmer, I want to see the history and current status of my deposit and withdrawal requests, so that I know whether each request is pending, approved, or rejected.

#### Acceptance Criteria

1. WHEN an authenticated Farmer opens the deposits and withdrawals screen, THE Request_Service SHALL return only the Deposit_Request and Withdrawal_Request rows belonging to that Farmer, combined into a single list sorted by creation timestamp in descending order (newest first).
2. THE Request_Service SHALL include the `amount`, `method`, `status`, request type (`deposit` or `withdrawal`), and creation timestamp of each request in the returned history.
3. WHILE a request has `status` equal to `pending`, THE deposits and withdrawals screen SHALL display the request with a pending status indicator.
4. WHEN a request's `status` is `approved` or `rejected`, THE deposits and withdrawals screen SHALL display the corresponding approved or rejected status indicator for that request.
5. WHERE the Farmer's history contains more than 20 requests, THE Request_Service SHALL return at most 20 requests per page and SHALL provide a cursor for retrieving the next page of older requests.
6. WHEN the Farmer has zero requests, THE deposits and withdrawals screen SHALL display an empty-state message and SHALL display no request rows.
7. IF retrieving the history fails or the Farmer is not authenticated, THEN THE Request_Service SHALL return an error response and THE screen SHALL display an error message without displaying partial or stale request data.

### Requirement 8: Proofs storage bucket

**User Story:** As a Farmer, I want my uploaded proof files to be private, so that only I can write them and only administrators can read them.

#### Acceptance Criteria

1. THE Migration SHALL create a private (non-public) Supabase Storage bucket named `proofs`.
2. WHEN a Farmer uploads a proof file to an object path prefixed with the authenticated Farmer's user id (e.g., `{uid}/...`), THE Proofs_Bucket policy SHALL permit the insert.
3. IF a Farmer attempts to upload a proof file to an object path not prefixed with that Farmer's own user id, THEN THE Proofs_Bucket policy SHALL deny the insert and SHALL NOT store the file.
4. IF a Farmer attempts to read a proof file whose object path is not prefixed with that Farmer's own user id, THEN THE Proofs_Bucket policy SHALL deny the read.
5. WHERE the authenticated user has the administrator role, THE Proofs_Bucket policy SHALL permit read access to every proof file in the `proofs` bucket.
6. IF an unauthenticated request attempts to read or write any proof file, THEN THE Proofs_Bucket policy SHALL deny the request.

### Requirement 9: Money movement through SECURITY DEFINER functions

**User Story:** As a platform operator, I want all balance changes to go through atomic SECURITY DEFINER functions, so that balances and the immutable ledger always stay consistent.

#### Acceptance Criteria

1. WHEN a deposit or withdrawal results in a balance change, THE system SHALL apply that change exclusively through the existing `wallet_transfer()` SECURITY DEFINER function.
2. WHEN `wallet_transfer()` applies a balance change, THE system SHALL update the affected wallet balances and insert the corresponding ledger rows within a single database transaction.
3. THE system SHALL NOT mutate wallet balances directly from client code or from a server function outside a SECURITY DEFINER function.
4. THE deposit and withdrawal request submission flows SHALL NOT change any wallet balance, because crediting and debiting occur only at approval time, which is out of scope for this spec.

### Requirement 10: Service-role test-credit route

**User Story:** As a developer, I want a restricted route to credit a test deposit, so that I can exercise the deposits flow before admin approval tooling is built.

#### Acceptance Criteria

1. WHEN the Test_Credit_Route is invoked with a valid service-role credential and a valid target Farmer and amount, THE Test_Credit_Route SHALL credit the deposit by invoking `wallet_transfer()`, writing a `deposit` ledger entry for the target Farmer's wallet.
2. IF the Test_Credit_Route is invoked without a valid service-role credential, THEN THE Test_Credit_Route SHALL reject the request and SHALL NOT change any wallet balance or ledger.
3. THE Test_Credit_Route SHALL restrict access to the `service_role` and SHALL deny invocation by the `authenticated` and `anon` roles.
4. IF the Test_Credit_Route is invoked from an `authenticated` or `anon` browser session, THEN THE Test_Credit_Route SHALL deny the invocation without calling `wallet_transfer()`.
5. IF the Test_Credit_Route is invoked with a missing or non-existent target Farmer, or a missing/non-numeric/zero/negative amount, THEN THE Test_Credit_Route SHALL reject the request with a validation error identifying the invalid field and SHALL NOT change any balance or ledger.

### Requirement 11: Server-function authentication pattern

**User Story:** As a developer, I want all server logic to use the established server-function and auth pattern, so that authentication is enforced consistently and the existing middleware is reused.

#### Acceptance Criteria

1. THE Request_Service SHALL implement all server logic using `createServerFn`.
2. WHEN a Request_Service server function executes user-scoped logic, THE Request_Service SHALL enforce authentication using `requireSupabaseAuth`.
3. THE system SHALL rely on the existing `attachSupabaseAuth` middleware wired in `src/start.ts` and SHALL NOT introduce a duplicate auth middleware.

### Requirement 12: SSR-safe routing and link ordering

**User Story:** As a developer, I want new screens to be added without breaking server-side rendering or navigation, so that the app continues to prerender and build cleanly.

#### Acceptance Criteria

1. THE system SHALL NOT attach a protected loader to a public route.
2. WHEN a new route file is referenced by a `<Link to=...>`, THE system SHALL create the new route file before adding the `<Link to=...>` reference to it.
3. WHERE deposit and withdrawal screens require authentication, THE system SHALL place those screens under the existing `_authenticated` route group.

### Requirement 13: Client-bundle environment safety

**User Story:** As a developer, I want secrets and environment access kept out of client-imported module scope, so that no server-only configuration leaks into the client bundle.

#### Acceptance Criteria

1. THE system SHALL NOT reference `process.env` at module scope in any file that is imported by client code.
2. WHERE a server function needs environment values, THE system SHALL access those values only inside the `.handler()` body of the server function.

### Requirement 14: Public webhook and cron placement

**User Story:** As a developer, I want any public webhook or cron endpoints isolated and verified, so that untrusted callers cannot trigger privileged logic.

#### Acceptance Criteria

1. WHERE a public webhook or cron endpoint is added, THE system SHALL place that endpoint only under `src/routes/api/public/`.
2. WHEN a public webhook or cron endpoint receives a request, THE endpoint SHALL verify the request signature before performing any privileged action.
3. IF a public webhook or cron endpoint receives a request with an invalid or missing signature, THEN THE endpoint SHALL reject the request.
