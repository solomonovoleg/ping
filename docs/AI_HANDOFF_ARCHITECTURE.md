# AI HANDOFF — Continue Refactor In Same Architecture

## Purpose

This file is for the next AI developer agent working in this repository.

Goal:

- continue improvements in the same architectural direction
- preserve already introduced boundaries
- avoid returning to large mixed-responsibility files
- keep changes practical, safe, and performance-aware

## Current architectural direction

The project follows a practical modular structure:

- client pages -> thin page shells
- client features -> domain hooks/components/utils for one scenario
- shared client components -> reusable generic UI
- server routes -> thin HTTP entry layer
- server services -> business logic/orchestration
- server repositories/storage -> data access and query logic
- server serializers -> DTO response shaping

This is about clarity and maintainability, not pattern-overengineering.

## Non-negotiable rules

### 1) Do not bloat page files again

Avoid adding large business/runtime blocks directly in `client/src/pages/*`.
Prefer:

- screen scenario logic -> `client/src/features/<domain>/hooks/*`
- medium/large screen chunks -> `client/src/features/<domain>/components/*`

### 2) Do not bloat server routes again

Avoid placing domain business logic and query logic directly in `server/*/routes.ts`.
Prefer:

- business rules -> `service.ts`
- query/data access -> `repository.ts` or `server/storage/*`
- response shaping -> `serializers.ts`

### 3) Preserve realtime/call stability

If touching realtime/calls, preserve:

- single shared websocket lifecycle in `client/src/hooks/useCall.ts`
- deduplicated subscribe/reconnect behavior: subscribe-chat only when first listener added; unsubscribe only when last removed; sendAllChatSubscriptions only in onopen
- clean server-side subscription lifecycle in `server/realtime/chat.ts`

Correctness first, then optimization.

### 4) Prefer targeted refactors

Good:

- pick one oversized file
- split into 2-4 coherent modules
- keep runtime behavior stable
- run checks
- update docs

Bad:

- broad rewrite of many systems at once
- architecture churn without payoff

### 5) Adapt your work to this repository

If your prepared code follows another structure, do not paste it as-is.

Instead:

- map your feature into current module layout
- split where needed before merge
- preserve behavior while adapting structure

## Preferred working pattern

For each substantial refactor:

1. audit target file
2. identify mixed responsibilities
3. extract hook/service/repository/components
4. reduce original file to orchestration
5. run:
   - `npm run check`
   - `npm run build`
6. update:
   - `docs/PROJECT_MAP.md` (especially if modules/paths changed)
   - `docs/DEV_HANDOFF_CURSOR.md` (if handoff context changed)

## Files to read first

1. `docs/PROJECT_MAP.md`
2. `docs/DEV_HANDOFF_CURSOR.md`
3. `server/routes.ts`
4. `server/ai-chat/routes.ts`
5. `server/ai-chat/service.ts`
6. `server/messages/routes.ts`
7. `server/messages/service.ts`
8. `server/saved-messages/routes.ts`
9. `server/saved-messages/service.ts`
10. `server/chats/routes.ts`
11. `server/chats/service.ts`
12. `server/posts/routes.ts`
13. `server/posts/service.ts`
14. `server/users/routes.ts`
15. `server/users/service.ts`

## Success criteria

Continuation work is correct if:

- files become smaller and clearer
- responsibilities become more explicit
- no regression in `npm run check` / `npm run build`
- realtime behavior stays stable
- documentation remains synced with real file structure

## Final instruction

Extend the architecture that already exists here.

Do not restart architecture from scratch.
Do not collapse modules back into god-files.
Do not import parallel work in an older structure without adaptation.
