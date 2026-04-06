# Security Hardening Checklist

This checklist is used stage-by-stage to ensure changes do not degrade service reliability.

## Baseline smoke checks (run before and after each stage)

- `npm run check`
- Auth flows:
  - `POST /api/auth/login`
  - `POST /api/auth/register`
  - `GET /api/auth/me`
  - `POST /api/auth/logout`
- Core product flows:
  - send chat message
  - create post
  - create story
  - upload chat media
  - upload voice media
  - start and accept call

## Rollback toggles (no code rollback required)

- `CORS_REFLECT_ORIGIN_COMPAT=1`
- `CSRF_ENFORCE=0`
- `RATE_LIMIT_DISABLED=1`
- `UPLOADS_CHAT_PRIVATE_ENFORCE=0`
- `UPLOADS_VOICE_PRIVATE_ENFORCE=0`
- `SECURITY_AUDIT_DISABLED=1`

## Security rollout order

1. Monitor mode (`*_ENFORCE=0`)
2. Partial traffic / canary
3. Full enforce in production

## Success criteria per stage

- No increase in 5xx rate
- No drop in successful auth/conversion rate
- No spike in median and p95 API latency
- No critical user-flow regressions in manual smoke checks
