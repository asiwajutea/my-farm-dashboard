# Bugfix Requirements Document

## Introduction

The authenticated profile page (`src/routes/_authenticated/profile.tsx`, `ProfilePage`) fails to
load. Instead of the profile form, the user is shown the root error boundary
(`ErrorComponent` in `src/routes/__root.tsx`) which displays the message **"This page didn't
load."**

The root cause is a violation of React's Rules of Hooks. `ProfilePage` calls `useMemo` for
`dialOptions` **after** an early `return` that fires while `loading` is `true`:

- During the first render `loading` is `true`, so the component hits `if (loading) return <Loader2 />`
  before reaching the `dialOptions` `useMemo`. Fewer Hooks run on this render.
- The `useEffect` then loads the profile and sets `loading` to `false`, triggering a re-render.
- On the re-render the early return is skipped and the `dialOptions` `useMemo` executes, so **more
  Hooks run than during the previous render**.

React detects the inconsistent Hook count/order and throws (e.g. "Rendered more hooks than during
the previous render"). The thrown error propagates to the TanStack Router root `errorComponent`,
producing the user-visible failure. Because the route guard (`_authenticated/route.tsx`) guarantees
an authenticated user, the `loading` flag always transitions from `true` to `false`, so the crash
happens on essentially every profile page visit.

The sibling dashboard route (`_authenticated/dashboard.tsx`) follows a similar data-loading pattern
but keeps all of its Hooks before any conditional return, which is why it loads correctly. This
isolates the defect to the misplaced Hook in `ProfilePage`, not to the shared helpers
(`src/lib/countries.ts`, `src/lib/avatar.ts`) or the Supabase data layer.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN an authenticated user navigates to the profile page and the profile data finishes loading (the `loading` state transitions from `true` to `false`) THEN the system throws a React Rules-of-Hooks error because more Hooks are executed than on the initial loading render, and renders the root error boundary instead of the profile.

1.2 WHEN the profile page performs its initial render with `loading` set to `true` THEN the system returns early at `if (loading)` before reaching the `dialOptions` `useMemo`, so it renders fewer Hooks than the subsequent loaded render and establishes an inconsistent Hook order.

1.3 WHEN the React error is thrown during the profile render THEN the system surfaces the root `ErrorComponent` showing the message "This page didn't load" instead of the profile form.

### Expected Behavior (Correct)

2.1 WHEN an authenticated user navigates to the profile page and the profile data finishes loading THEN the system SHALL render the profile page successfully without throwing a Hooks-order error.

2.2 WHEN the profile page renders in any state (loading or loaded) THEN the system SHALL invoke the same set of React Hooks in the same order, with no Hook placed after a conditional early return.

2.3 WHEN the profile data finishes loading THEN the system SHALL display the profile content (avatar, KYC status, country selector, dial-code dropdown, phone, bio, and form fields) instead of the error boundary.

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the profile page is still loading profile data THEN the system SHALL CONTINUE TO display the full-screen spinner.

3.2 WHEN the loaded profile renders THEN the system SHALL CONTINUE TO populate the dial-code dropdown (`dialOptions`), the country selector, the resolved avatar, the KYC status badge, and the editable form fields with the same values as before.

3.3 WHEN a user loads the dashboard or any other authenticated route THEN the system SHALL CONTINUE TO render correctly without regression.

3.4 WHEN the user edits and saves the profile, uploads an avatar, copies the referral code, or changes country/phone THEN the system SHALL CONTINUE TO behave as it did before the fix.

## Bug Condition Derivation

**Definitions**
- **F**: The original (unfixed) `ProfilePage` render function, where `dialOptions = useMemo(...)` is declared after the `if (loading) return ...` early return.
- **F'**: The fixed `ProfilePage` render function, where every Hook (including `dialOptions`) is declared before any conditional early return.
- **X**: A render lifecycle of `ProfilePage` for an authenticated user, characterized by the `loading` state value across renders.

**Bug Condition**

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type ProfilePageRenderLifecycle
  OUTPUT: boolean

  // The defect triggers whenever the component first renders with loading = true
  // (skipping the dialOptions useMemo via the early return) and then re-renders
  // with loading = false (executing the previously-skipped Hook), changing the
  // Hook count/order between renders.
  RETURN X.firstRender.loading = true AND X.laterRender.loading = false
END FUNCTION
```

In practice `isBugCondition(X)` is true for every authenticated profile visit, because the route
guard guarantees a user and the load effect always sets `loading` to `false`.

**Property: Fix Checking**

```pascal
// For every profile render lifecycle that triggers the bug, the fixed component
// must render without a Hooks-order error and must show the profile content.
FOR ALL X WHERE isBugCondition(X) DO
  result <- renderProfilePage'(X)   // F'
  ASSERT no_hooks_order_error(result)
  ASSERT result.rendered = ProfileContent   // not the root ErrorComponent
END FOR
```

**Property: Preservation Checking**

```pascal
// For every non-buggy scenario (loading-only render, dashboard and other routes,
// and the loaded profile's output), the fixed code must behave identically to the
// original.
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT F(X) = F'(X)
END FOR
```

This guarantees the spinner-only state, the fully-loaded profile output (dial options, country
selector, avatar, form fields), and all other routes remain unchanged after the fix.
