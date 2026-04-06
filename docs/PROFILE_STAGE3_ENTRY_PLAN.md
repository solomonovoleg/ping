# Profile Stage 3 Entry Plan

This document defines a safe start plan for Profile Stage 3.

## Goal

- Improve long-term maintainability and change safety of profile/account flows.
- Keep user-visible behavior stable unless explicitly approved.

## Preconditions (must be true before Stage 3 coding)

- Stage 2 fixes merged locally and validated.
- `npm run check` is green.
- Profile Stage 2 QA protocol completed:
  - `docs/PROFILE_STAGE2_QA_PROTOCOL.md`

## Stage 3 Work Packages

### WP1 — Contract Stabilization

- Freeze current profile API response contracts used by client profile module.
- Add lightweight contract assertions around:
  - profile page payload parse path
  - notFound vs network failure states
- Deliverable:
  - short contract note in code comments near parser/normalizer.

### WP2 — Query Key Unification

- Introduce centralized profile query keys for:
  - own profile
  - foreign profile page
  - profile posts
  - profile stories
  - saved posts used by profile
- Replace scattered inline query keys only in profile-related files.
- Deliverable:
  - one query-keys module with typed key builders.

### WP3 — Mutation Error Semantics

- Normalize mutation feedback rules across profile actions:
  - success feedback consistency
  - destructive feedback for critical failures
  - no silent failures in critical user actions
- Deliverable:
  - single rule note + consistent behavior in profile mutations.

### WP4 — Test Baseline for Profile Core

- Add minimal tests for high-risk pure logic:
  - route ownership resolution
  - profile page payload parsing
  - layout derive behavior for own/foreign profile
- Deliverable:
  - focused tests with no heavy infra setup.

### WP5 — Safe Extensibility Gate

- Add a short pre-change checklist for profile module contributors:
  - loading/error/empty states preserved
  - profile visibility semantics not broken
  - no contract drift in parser/adapters
- Deliverable:
  - markdown checklist in docs.

## Risk Register

- **R1 Contract drift**  
  Mitigation: touch parser and payload adapters together, same PR.

- **R2 Cache invalidation regressions**  
  Mitigation: central query keys, avoid ad-hoc strings.

- **R3 UX regression under network instability**  
  Mitigation: keep soft-refresh error path and manual retry/close controls.

- **R4 Hidden coupling to server profile fields**  
  Mitigation: do not widen response shape without parser update.

## Acceptance Criteria for Stage 3 Completion

- Profile module remains behavior-compatible for current flows.
- Typecheck and lints pass.
- High-risk pure logic has baseline test coverage.
- Profile query key usage is centralized in module scope.
- Stage 3 checklist is documented and usable by next contributors.

## Suggested Execution Order

1. WP1 (contracts)  
2. WP2 (query keys)  
3. WP3 (mutation semantics)  
4. WP4 (tests)  
5. WP5 (checklist/doc finalization)
