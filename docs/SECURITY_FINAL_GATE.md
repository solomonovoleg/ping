# Security Final Gate

## Scope covered

- Secret hardening and fail-fast startup checks
- CORS tightening and CSRF protection modes
- Rate-limiting and abuse controls
- Webhook replay/signature/SSRF controls
- Internal service secret constant-time verification
- Upload privacy controls with signed URLs for chat and voice
- Security audit event logging

## Verification checklist

- `npm run check`
- API smoke checks for auth/chat/upload/call flows
- Confirm monitor/enforce flags can rollback behavior without code rollback
- Validate signed URLs for chat/voice in monitor mode and enforce mode

## Go / No-Go criteria

Go:
- no critical regression in user flows
- no increase in 5xx and severe latency spikes
- security events visible and actionable

No-Go:
- authentication regressions
- signed media inaccessible for supported clients
- missing rollback path for enforced controls
