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
