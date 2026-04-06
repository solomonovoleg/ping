# Security Incident Runbook

## 1) Immediate containment

- For suspicious media scraping:
  - set `UPLOADS_CHAT_PRIVATE_ENFORCE=1`
  - set `UPLOADS_VOICE_PRIVATE_ENFORCE=1`
- For auth abuse:
  - lower `RATE_LIMIT_*_MAX` values
- For CSRF wave:
  - set `CSRF_ENFORCE=1`

## 2) Preserve evidence

- Keep `SECURITY_AUDIT_DISABLED=0`
- Collect logs with prefix `[security-audit]`
- Correlate by `requestId`, `event`, `category`, `path`, `ip`

## 3) Scoped rollback (if business impact appears)

- Disable only affected control:
  - CSRF: `CSRF_ENFORCE=0`
  - media guard: `UPLOADS_*_PRIVATE_ENFORCE=0`
  - rate limits: tune values first; set `RATE_LIMIT_DISABLED=1` only as last resort

## 4) Recovery and hardening

- Rotate relevant secrets:
  - `SESSION_SECRET`
  - `AUTH_TOKEN_SECRET`
  - `UPLOAD_ACCESS_SECRET`
  - service-to-service secrets
- Invalidate mobile tokens:
  - users call `POST /api/auth/logout-all`

## 5) Post-incident report

- Timeline and root cause
- Data affected (if any)
- Controls that detected and blocked
- Permanent remediation and follow-up tasks
