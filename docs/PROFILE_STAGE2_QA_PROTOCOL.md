# Profile Stage 2 QA Protocol

Use this checklist after Stage 2 profile hardening changes.

Mark each item as PASS or FAIL.

| # | Check | Expected |
|---|---|---|
| 1 | Open foreign profile online (`/u/<id>`) | Profile screen loads without `not found` shell |
| 2 | Pull-to-refresh foreign profile while offline | Existing content stays visible |
| 3 | Pull-to-refresh while offline | Error toast is shown |
| 4 | Pull-to-refresh while offline | Inline refresh error hint appears |
| 5 | Tap `Close` in inline hint | Inline hint is dismissed |
| 6 | Tap `Retry` while still offline | Error repeats, no hard screen failure |
| 7 | Restore network and tap `Retry` | Hint disappears, profile refresh succeeds |
| 8 | Archive/Delete story during network failure | Destructive error feedback is shown |
| 9 | React to post during API failure | Destructive error feedback is shown |
| 10 | Patch profile with чужой `pinnedPostId` | Server returns 4xx, pinned post is not changed |

## Release Gate

- Ready for Stage 3: 10/10 PASS
- Needs polish: 8-9/10 PASS
- Stop and fix: 7/10 PASS or less
