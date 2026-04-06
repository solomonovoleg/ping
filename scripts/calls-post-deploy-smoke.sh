#!/usr/bin/env bash
set -euo pipefail

# Post-deploy smoke for calls reliability.
#
# Usage (local):
#   bash scripts/calls-post-deploy-smoke.sh \
#     --api-url https://pingos.ru \
#     --dist-dir dist/public/assets
#
# Optional SLO check:
#   CALLS_SLO_API_URL=... CALLS_SLO_ADMIN_LOGIN=... CALLS_SLO_ADMIN_PASSWORD=... \
#   bash scripts/calls-post-deploy-smoke.sh --api-url https://pingos.ru

API_URL=""
DIST_DIR="dist/public/assets"

while [ $# -gt 0 ]; do
  case "$1" in
    --api-url)
      API_URL="${2:-}"
      shift 2
      ;;
    --dist-dir)
      DIST_DIR="${2:-}"
      shift 2
      ;;
    *)
      echo "[calls-smoke] unknown arg: $1"
      exit 2
      ;;
  esac
done

if [ -z "$API_URL" ]; then
  echo "[calls-smoke] --api-url is required"
  exit 2
fi

echo "[calls-smoke] 1/4 API availability"
curl -fsS --max-time 10 "${API_URL%/}/api/build-version" >/dev/null

echo "[calls-smoke] 2/4 TURN in built client"
if [ -d "$DIST_DIR" ]; then
  if ! rg -n "turn:" "$DIST_DIR" >/dev/null 2>&1; then
    echo "[calls-smoke] FAIL: no 'turn:' literal in $DIST_DIR"
    exit 1
  fi
  if ! rg -n "transport=tcp|turns:" "$DIST_DIR" >/dev/null 2>&1; then
    echo "[calls-smoke] WARN: tcp/tls TURN literals not found in $DIST_DIR"
  fi
else
  echo "[calls-smoke] WARN: dist dir not found ($DIST_DIR), skipping bundle scan"
fi

echo "[calls-smoke] 3/4 call env sanity"
if [ -n "${VITE_TURN_URLS:-}${VITE_TURN_URL:-}" ]; then
  if [ -z "${VITE_TURN_USERNAME:-}" ] || [ -z "${VITE_TURN_CREDENTIAL:-}" ]; then
    echo "[calls-smoke] WARN: TURN URL is set but username/credential pair incomplete"
  fi
fi

echo "[calls-smoke] 4/4 SLO gate (optional)"
if [ -n "${CALLS_SLO_API_URL:-}" ] && [ -n "${CALLS_SLO_ADMIN_LOGIN:-}" ] && [ -n "${CALLS_SLO_ADMIN_PASSWORD:-}" ]; then
  node scripts/check-calls-slo.cjs
else
  echo "[calls-smoke] skipped (missing CALLS_SLO_* env vars)"
fi

echo "[calls-smoke] done"
