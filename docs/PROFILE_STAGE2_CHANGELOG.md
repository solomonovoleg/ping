# Profile Stage 2 Changelog

This changelog documents the hardening work completed for Profile Stage 2.

## Scope

- No feature expansion.
- Focus on integrity, error handling, and safer refresh behavior.
- Refactoring done in small steps with behavior preservation intent.

## Server Changes

### 1) Pinned post integrity guard

- File: `server/users/service.ts`
- Area: `updateMyProfile()`
- Change:
  - Added validation for `pinnedPostId` when updating profile:
    - post must exist
    - post must belong to current user
    - post must not be draft
  - If validation fails, service returns domain 4xx error.
- Reason:
  - Prevent setting чужой pinned post through generic profile patch.

## Client Changes

### 2) Story archive/delete now safe on failure

- File: `client/src/features/profile/user-profile/hooks/useUserProfileStoryInteractionActions.ts`
- Change:
  - Wrapped archive/delete actions with `try/catch`
  - Added destructive toast feedback on failure.
- Reason:
  - Avoid silent failures and stuck interaction states.

### 3) Reaction mutation error feedback

- File: `client/src/features/profile/user-profile/hooks/useUserProfilePostMutations.ts`
- Change:
  - Added `onError` toast for reactions mutation.
- Reason:
  - User gets immediate feedback when reaction request fails.

### 4) Not-found vs network error split

- Files:
  - `client/src/features/profile/user-profile/hooks/useUserProfileLocalState.ts`
  - `client/src/features/profile/user-profile/hooks/useUserProfileOtherProfileState.ts`
  - `client/src/features/profile/user-profile/hooks/useUserProfilePullRefresh.ts`
  - `client/src/features/profile/user-profile/hooks/useUserProfileActionBundle.ts`
  - `client/src/features/profile/user-profile/useUserProfilePage.ts`
  - `client/src/pages/UserProfile.tsx`
- Change:
  - Introduced explicit `profileNotFound` state.
  - Kept `profileError` for transient network/update failures.
  - Updated screen condition so transient errors with existing data do not force hard not-found shell.
- Reason:
  - Improve UX correctness and prevent false "not found" on refresh glitches.

### 5) Soft refresh error UX

- Files:
  - `client/src/features/profile/user-profile/hooks/useUserProfilePullRefresh.ts`
  - `client/src/features/profile/user-profile/page/UserProfileMainLayout.tsx`
  - related state plumbing via `local/action` hooks
- Change:
  - Added `softRefreshError` state for refresh-time failures when profile data is already on screen.
  - Kept current content visible.
  - Added inline hint with:
    - `Retry` button
    - `Close` button
  - Kept destructive toast as immediate feedback.
- Reason:
  - Non-destructive refresh failure handling.

### 6) Type safety restoration after composition refactor

- File: `client/src/features/profile/user-profile/model/build-user-profile-page-result.ts`
- Change:
  - Replaced broad `Record<string, unknown>` return typing with strict generic intersection typing.
- Reason:
  - Prevent `unknown` propagation to profile page consumers.

### 7) Isolated unrelated typecheck blocker

- File: `client/src/pages/CreatePostPulseMobile.tsx`
- Change:
  - `enterKeyHint="default"` -> `enterKeyHint="enter"`.
- Reason:
  - Fix TypeScript compatibility error and keep global `npm run check` green.

## Refactor Outcome Snapshot

- `useUserProfilePage.ts` reduced from very large monolith to modular composition.
- Key flows moved into focused hooks:
  - route state
  - local ui/data state
  - profile queries
  - action bundle
  - derived posts
  - story state
  - pull refresh
  - profile ui effects
- File size target (`<=250`) achieved for main profile page hook.

## Validation Status

- `npm run check`: PASS
- Lints for touched files: PASS
- Smoke checks in current local environment:
  - blocked by 403 in public mode (`review-smoke-check`) due to environment access constraints.

## QA Protocol

- See: `docs/PROFILE_STAGE2_QA_PROTOCOL.md`
