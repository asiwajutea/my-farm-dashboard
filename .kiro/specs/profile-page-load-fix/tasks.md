# Implementation Plan

- [ ] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Profile Page Renders Without Hooks-Order Error
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: This is a deterministic bug (it triggers on every authenticated profile visit). Scope the property to the concrete failing lifecycle: mount `ProfilePage` with a mocked Supabase client that resolves an authenticated user/profile, then let the load effect flip `loading` from `true` to `false`. Optionally vary the profile payload (with/without saved country, with/without phone) since all such inputs satisfy `isBugCondition`.
  - Test implementation details from Bug Condition in design: `ProfilePage` declares the `dialOptions = useMemo(...)` Hook after the `if (loading) return <Loader2 ... />` early return, so the loading render runs fewer Hooks than the loaded render (`isBugCondition(input)` where `input.firstRender.loading = true AND input.laterRender.loading = false AND dialOptionsHookDeclaredAfterEarlyReturn = true`)
  - The test assertions should match the Expected Behavior Properties from design: assert no React Hooks-order error is thrown and assert the profile content (avatar, KYC badge, country selector, dial-code dropdown, phone, bio, form fields) renders instead of the root `ErrorComponent` ("This page didn't load")
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found to understand root cause (e.g., React throws "Rendered more hooks than during the previous render" once `loading` becomes `false`, and the root `ErrorComponent` renders instead of the form)
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3_

- [ ] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Spinner, Loaded Output, and Other Routes Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs (cases where `isBugCondition` returns false): the loading-only render state (spinner), the fully-loaded profile output, and other routes
  - Observe: while `loading` is `true`, `ProfilePage` renders the full-screen `Loader2` spinner
  - Observe: the dashboard route (`_authenticated/dashboard.tsx`) and other routes (auth, index) render correctly
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements: generate varied non-buggy scenarios (loading-only renders, other routes) and assert output matches the original
  - Property-based testing generates many test cases for stronger guarantees that behavior is unchanged across the non-buggy input domain
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 3. Fix the misplaced `dialOptions` Hook in `ProfilePage`

  - [x] 3.1 Relocate the `dialOptions` useMemo before the early return
    - In `src/routes/_authenticated/profile.tsx` (`ProfilePage`), move the `const dialOptions = useMemo(() => { ... }, []);` declaration from its current position (after the `if (loading) return <Loader2 ... />` early return) to before that early return, alongside the existing `const country = useMemo(...)` Hook
    - Remove the misplaced `dialOptions` declaration (and its inline comment) from its current location after the early return so it exists in exactly one place
    - Keep the memo body and `[]` dependency array identical - only the position in the function changes; no other code, JSX, or behavior is modified
    - Leave the `if (loading) return <Loader2 ... />` spinner branch exactly as it is - it now simply follows all Hook declarations
    - Do not touch `__root.tsx`, the dashboard route, shared helpers, or the data layer
    - _Bug_Condition: isBugCondition(input) where input.firstRender.loading = true AND input.laterRender.loading = false AND dialOptionsHookDeclaredAfterEarlyReturn = true (from design)_
    - _Expected_Behavior: expectedBehavior(result) - ProfilePage renders without a Hooks-order error and displays the profile content for every buggy lifecycle (from design)_
    - _Preservation: Preservation Requirements from design - spinner, loaded-form output, other routes, and interactions unchanged_
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Profile Page Renders Without Hooks-Order Error
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed - no Hooks-order error, profile content renders instead of the root `ErrorComponent`)
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Spinner, Loaded Output, and Other Routes Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions - spinner, loaded-form output, dashboard and other routes unchanged)
    - Confirm all tests still pass after fix (no regressions)
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass (bug condition exploration test now passing, preservation tests still passing), ask the user if questions arise.

- [ ] 5. Write KYC-lookup bug condition exploration test
  - **Property 3: Bug Condition** - Profile Renders With Unknown KYC Status
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the second bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the defensive fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the KYC-lookup crash exists
  - **Scoped PBT Approach**: Scope the property to concrete failing cases where `isKycBugCondition` holds: mount `ProfilePage` with a mocked Supabase client resolving a profile whose `kyc_status` is a value outside the four known keys (e.g. `"in_review"`, `"Verified"`), let the load effect complete. Optionally generate arbitrary status strings outside `['unverified','pending','verified','rejected']` since all such inputs satisfy the bug condition.
  - Test implementation details from Bug Condition in design: after the `if (loading)` early return, `const kycMeta = { ... }[kyc];` returns `undefined` for an unknown key, and the JSX reads `kycMeta.color` / `<kycMeta.icon ... />` (`isKycBugCondition(input)` where `input.profile.kyc_status` is non-null and NOT IN the four known keys)
  - The test assertions should match the Expected Behavior Properties from design: assert no "Cannot read properties of undefined" error is thrown and assert the profile content renders (with a fallback badge) instead of the root `ErrorComponent` ("This page didn't load")
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the second bug exists)
  - Document counterexamples found (e.g., "kyc_status = 'in_review' → kycMeta is undefined → throws Cannot read properties of undefined (reading 'color')")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.4, 1.5, 2.4, 2.5_

- [ ] 6. Write KYC preservation property tests (BEFORE implementing the defensive fix)
  - **Property 4: Preservation** - Known KYC Statuses Render Identically
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs (cases where `isKycBugCondition` returns false): each of the four known `kyc_status` values (`"unverified"`, `"pending"`, `"verified"`, `"rejected"`) and a null/missing status (coalesced to `"unverified"`)
  - Observe and record the rendered badge for each known status: its label, icon, color classes, and the `kyc === "pending"` spin behavior
  - Write property-based tests capturing observed behavior patterns from the Preservation Requirements: for all known statuses, assert the rendered badge matches the recorded label/icon/color/spin
  - Property-based testing generates many test cases for stronger guarantees that the known-status badges are unchanged
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.5_

- [ ] 7. Fix the unsafe KYC metadata lookup in `ProfilePage`

  - [x] 7.1 Make the `kycMeta` lookup safe with a fallback
    - In `src/routes/_authenticated/profile.tsx` (`ProfilePage`), replace the unguarded inline map index `const kycMeta = { ... }[kyc];` with a lookup that always resolves to a defined entry, falling back to the `unverified` entry when the key is unknown (e.g. extract a named `const KYC_META = { ... }` and use `const kycMeta = KYC_META[kyc] ?? KYC_META.unverified;`)
    - Keep the four entries' `label`, `icon`, and `color` values exactly the same - only the lookup gains a fallback; the `kyc === "pending"` spin behavior in the JSX is unchanged
    - Do not touch `__root.tsx`, the dashboard route, shared helpers, or the data layer
    - _Bug_Condition: isKycBugCondition(input) where input.profile.kyc_status is non-null AND NOT IN ['unverified','pending','verified','rejected'] (from design)_
    - _Expected_Behavior: expectedBehavior(result) - kycMeta resolves to a defined object (fallback to unverified) and the profile renders without a "Cannot read properties of undefined" error (from design)_
    - _Preservation: Preservation Requirements from design - the four known statuses render the same badge (label, icon, color, spin)_
    - _Requirements: 2.4, 2.5_

  - [ ] 7.2 Verify KYC bug condition exploration test now passes
    - **Property 3: Expected Behavior** - Profile Renders With Unknown KYC Status
    - **IMPORTANT**: Re-run the SAME test from task 5 - do NOT write a new test
    - The test from task 5 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run KYC bug condition exploration test from step 5
    - **EXPECTED OUTCOME**: Test PASSES (confirms the second bug is fixed - no undefined-property error, profile content renders with a fallback badge instead of the root `ErrorComponent`)
    - _Requirements: 2.4, 2.5_

  - [ ] 7.3 Verify KYC preservation tests still pass
    - **Property 4: Preservation** - Known KYC Statuses Render Identically
    - **IMPORTANT**: Re-run the SAME tests from task 6 - do NOT write new tests
    - Run KYC preservation property tests from step 6
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions - the four known statuses render the same badge as before)
    - Confirm all tests still pass after the fix (no regressions)
    - _Requirements: 3.5_

- [ ] 8. Checkpoint - Ensure all tests pass (both root causes)
  - Ensure all tests pass: the Hooks-order tests (tasks 1-3) and the KYC-lookup tests (tasks 5-7) are all green, and no regressions are introduced. Ask the user if questions arise.
