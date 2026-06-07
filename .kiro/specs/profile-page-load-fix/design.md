# Profile Page Load Fix Bugfix Design

## Overview

The authenticated profile page (`src/routes/_authenticated/profile.tsx`, `ProfilePage`) crashes
on every visit and renders the root error boundary message **"This page didn't load"** instead of
the profile form. The cause is a violation of React's Rules of Hooks: the `dialOptions = useMemo(...)`
Hook is declared **after** the `if (loading) return <Loader2 ... />` early return, while every other
Hook (including `country = useMemo(...)`) is declared before it.

On the first render `loading` is `true`, so the early return fires before the `dialOptions` Hook,
running fewer Hooks. When the load effect sets `loading` to `false`, the re-render skips the early
return and executes the previously-skipped `dialOptions` Hook, running more Hooks than the prior
render. React throws "Rendered more hooks than during the previous render", which propagates to the
TanStack Router root `errorComponent` in `__root.tsx`.

The fix is a minimal, single-Hook relocation: move the `dialOptions = useMemo(...)` declaration to
before the `if (loading) return ...` early return, alongside the existing `country = useMemo(...)`
Hook. This guarantees the same Hooks run in the same order on every render. No behavioral change is
made to the loading spinner, the fully-loaded form, or any other route.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug - a `ProfilePage` render lifecycle that
  first renders with `loading = true` (skipping `dialOptions` via the early return) and later
  re-renders with `loading = false` (executing the previously-skipped Hook), producing an
  inconsistent Hook count/order between renders.
- **Property (P)**: The desired behavior - the profile page renders without a Hooks-order error and
  displays the profile content for every buggy lifecycle.
- **Preservation**: Existing behavior that must remain unchanged - the loading spinner, the fully
  loaded profile output (dial options dropdown, country selector, avatar, KYC badge, form fields),
  and all other routes (dashboard, auth, index).
- **ProfilePage**: The component in `src/routes/_authenticated/profile.tsx` that loads and renders
  the authenticated user's profile form.
- **dialOptions**: A `useMemo`-derived list of unique dial codes for the phone-code dropdown,
  currently declared after the `if (loading)` early return (the misplaced Hook).
- **loading**: The `useState` flag that is `true` during the initial render and set to `false` by
  the data-loading `useEffect`, which gates the early return.
- **errorComponent**: The TanStack Router root error boundary in `src/routes/__root.tsx` that
  renders "This page didn't load" when a render throws.

## Bug Details

### Bug Condition

The bug manifests when an authenticated user navigates to the profile page. The `ProfilePage`
render function declares the `dialOptions` `useMemo` Hook after a conditional early return that
fires while `loading` is `true`. As a result the Hook count differs between the loading render
(fewer Hooks) and the loaded render (more Hooks), which React rejects.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type ProfilePageRenderLifecycle
  OUTPUT: boolean

  // The defect triggers whenever the component first renders with loading = true
  // (skipping the dialOptions useMemo via the early return) and then re-renders
  // with loading = false (executing the previously-skipped Hook), changing the
  // Hook count/order between renders.
  RETURN input.firstRender.loading = true
         AND input.laterRender.loading = false
         AND dialOptionsHookDeclaredAfterEarlyReturn = true
END FUNCTION
```

In practice `isBugCondition(input)` is true for every authenticated profile visit, because the
route guard (`_authenticated/route.tsx`) guarantees a user and the load effect always sets
`loading` to `false`.

### Examples

- Authenticated user opens `/profile` → spinner shows (loading render, fewer Hooks) → profile data
  finishes loading → re-render executes the extra `dialOptions` Hook → React throws → root
  `ErrorComponent` shows "This page didn't load". (Expected: profile form renders.)
- A profile with a saved country and phone → on load the page should populate the dial dropdown and
  country selector, but instead crashes before rendering. (Expected: populated form.)
- A profile with no country set (auto-detect path) → still transitions `loading` from `true` to
  `false`, so it crashes the same way. (Expected: form with auto-detected country.)
- Edge case: the sibling dashboard route (`_authenticated/dashboard.tsx`) uses a similar load
  pattern but keeps all Hooks before any conditional return, so it renders correctly - confirming
  the defect is isolated to the misplaced Hook in `ProfilePage`.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- While the profile data is still loading, the full-screen spinner (`Loader2`) must continue to
  display exactly as before.
- The fully loaded profile must continue to populate the dial-code dropdown (`dialOptions`), the
  country selector, the resolved avatar, the KYC status badge, and the editable form fields with
  the same values as before.
- Editing and saving the profile, uploading an avatar, copying the referral code, and changing
  country/phone must continue to behave as they did before the fix.
- The dashboard and every other authenticated and unauthenticated route must continue to render
  without regression.

**Scope:**
All inputs that do NOT involve the Hooks-order mismatch should be completely unaffected by this fix.
This includes:
- The loading-only render state (spinner output).
- The fully-loaded profile render output (all derived values and form fields).
- All other routes (dashboard, auth, index) and shared helpers (`src/lib/countries.ts`,
  `src/lib/avatar.ts`) and the Supabase data layer.

**Note:** The actual expected correct behavior is defined in the Correctness Properties section
(Property 1). This section focuses on what must NOT change.

## Hypothesized Root Cause

The root cause is **confirmed**, not merely hypothesized: a React Rules-of-Hooks violation in
`ProfilePage`.

1. **Hook declared after a conditional early return (confirmed primary cause)**: The
   `dialOptions = useMemo(...)` Hook is declared after `if (loading) return <Loader2 ... />`, while
   `country = useMemo(...)` and all `useState`/`useRef`/`useEffect` Hooks are declared before it.
   - Loading render (`loading = true`): early return fires, `dialOptions` Hook is skipped → fewer
     Hooks run.
   - Loaded render (`loading = false`): early return skipped, `dialOptions` Hook executes → more
     Hooks run.
   - React throws "Rendered more hooks than during the previous render".

2. **Error propagation (confirmed)**: The thrown render error bubbles to the TanStack Router root
   `errorComponent` in `__root.tsx`, producing the user-visible "This page didn't load".

3. **Always triggered (confirmed)**: Because the `_authenticated` route guard guarantees a user and
   the load effect always sets `loading` to `false`, the `loading` flag always transitions
   `true → false`, so the crash happens on essentially every profile visit.

4. **Not a data-layer or helper issue (ruled out)**: The dashboard route uses a similar load
   pattern without the misplaced Hook and renders correctly, isolating the defect to the Hook
   placement rather than the Supabase data layer or shared helpers.

## Correctness Properties

Property 1: Bug Condition - Profile Page Renders Without Hooks-Order Error

_For any_ profile render lifecycle where the bug condition holds (isBugCondition returns true - an
authenticated visit that renders with `loading = true` then re-renders with `loading = false`), the
fixed `ProfilePage` SHALL render without throwing a React Hooks-order error and SHALL display the
profile content (avatar, KYC badge, country selector, dial-code dropdown, phone, bio, and form
fields) instead of the root `ErrorComponent`.

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - Spinner, Loaded Output, and Other Routes Unchanged

_For any_ input where the bug condition does NOT hold (isBugCondition returns false - the
loading-only render state, the fully-loaded profile output, and all other routes), the fixed code
SHALL produce the same result as the original function, preserving the loading spinner, the
populated profile form (dial options, country selector, avatar, KYC badge, fields), profile
save/avatar/referral/country behaviors, and the rendering of the dashboard and every other route.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

The root cause analysis is confirmed, so the fix is a minimal one-line relocation of a single Hook.

**File**: `src/routes/_authenticated/profile.tsx`

**Function**: `ProfilePage`

**Specific Changes**:
1. **Relocate the `dialOptions` Hook**: Move the
   `const dialOptions = useMemo(() => { ... }, []);` declaration from its current position (after
   the `if (loading) return <Loader2 ... />` early return) to before that early return, placing it
   alongside the existing `const country = useMemo(...)` Hook so all Hooks run unconditionally on
   every render.

2. **Remove the misplaced declaration**: Delete the old `dialOptions` declaration (and its inline
   comment) from its current location after the early return, ensuring it exists in exactly one
   place.

3. **Preserve identical logic**: Keep the `dialOptions` memo body and dependency array (`[]`)
   exactly the same; only its position in the function changes. No other code, JSX, or behavior is
   modified.

4. **No change to the early return**: The `if (loading) return <Loader2 ... />` spinner branch
   stays exactly as it is - it simply now follows all Hook declarations.

5. **No change to other files**: `__root.tsx`, the dashboard route, shared helpers, and the data
   layer are not touched.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate
the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or
refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Render `ProfilePage` in a test environment with a mocked Supabase client that
resolves an authenticated user and profile, then let the load effect flip `loading` from `true` to
`false`. Assert the component renders the profile content without throwing. Run on UNFIXED code to
observe the Hooks-order error.

**Test Cases**:
1. **Loading-to-loaded render**: Mount `ProfilePage`, allow the load effect to complete, and assert
   the profile form appears (will fail on unfixed code with a Hooks-order error).
2. **Existing-country profile**: Provide a profile with a saved country and phone, complete loading,
   and assert the dial dropdown and country selector populate (will fail on unfixed code).
3. **Auto-detect profile**: Provide a profile with no country set, complete loading, and assert the
   form renders with the detected country (will fail on unfixed code).
4. **Error-boundary check (edge case)**: Assert the root `ErrorComponent` ("This page didn't load")
   is NOT rendered after loading completes (may render on unfixed code).

**Expected Counterexamples**:
- React throws "Rendered more hooks than during the previous render" once `loading` becomes `false`.
- Possible causes: Hook declared after a conditional early return (confirmed), inconsistent Hook
  count between renders, error propagation to the root error boundary.

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the
expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := renderProfilePage_fixed(input)
  ASSERT no_hooks_order_error(result)
  ASSERT result.rendered = ProfileContent   // not the root ErrorComponent
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function
produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT renderProfilePage_original(input) = renderProfilePage_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain.
- It catches edge cases that manual unit tests might miss.
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs.

**Test Plan**: Observe behavior on UNFIXED code first for the spinner-only state, the loaded-form
output, and other routes, then write tests capturing that behavior to confirm it is unchanged after
the fix.

**Test Cases**:
1. **Spinner preservation**: Observe that the full-screen spinner renders while `loading` is `true`
   on unfixed code, then verify this is unchanged after the fix.
2. **Loaded-output preservation**: Observe the fully-loaded form output (dial options, country
   selector, avatar, KYC badge, fields) and verify it is identical after the fix.
3. **Other-routes preservation**: Verify the dashboard and other routes continue to render
   correctly after the fix.
4. **Interaction preservation**: Verify save, avatar upload, referral copy, and country/phone
   changes behave as before.

### Unit Tests

- Render `ProfilePage` through the loading-to-loaded transition and assert no error is thrown and
  the profile content appears.
- Assert the spinner renders while `loading` is `true`.
- Assert `dialOptions` and `country`-derived values populate the dropdowns identically after the
  fix.

### Property-Based Tests

- Generate varied profile payloads (with/without country, with/without phone, varied avatar and KYC
  status) and verify the page renders without a Hooks-order error and shows expected content.
- Generate non-buggy scenarios (loading-only renders, other routes) and verify output is unchanged
  from the original.

### Integration Tests

- Full flow: authenticate, navigate to `/profile`, and verify the form loads instead of the error
  boundary.
- Navigate between dashboard and profile and verify both render correctly.
- Verify visual elements (avatar, KYC badge, dial dropdown, country selector) appear once data
  loads.
