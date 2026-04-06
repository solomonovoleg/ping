#!/usr/bin/env bash
# Сборка client bundle для Capacitor (iOS/Android) с теми же VITE_TURN_* и прочими VITE_*,
# что и прод-веб на VPS. Скрипты build:*:prod подключают deploy.env (если файл есть).
# API/WS: из deploy.env (VITE_API_URL / VITE_WS_URL / VITE_SITE_ORIGIN), иначе дефолт https://pingos.ru.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f deploy.env ]]; then
  set -a
  # shellcheck disable=SC1091
  source deploy.env
  set +a
else
  echo "[capacitor-build-prod-client] deploy.env не найден — в бандл не попадут VITE_TURN_* (как на сайте). Звонки в приложении могут не подниматься через NAT/LTE. Скопируйте deploy.env с сервера или задайте переменные в окружении перед сборкой."
fi

DEFAULT_ORIGIN="https://pingos.ru"
ORIGIN=""
for candidate in "${VITE_API_URL:-}" "${VITE_WS_URL:-}" "${VITE_SITE_ORIGIN:-}"; do
  c="${candidate//[[:space:]]/}"
  if [[ -n "$c" ]]; then
    ORIGIN="${candidate%/}"
    break
  fi
done
ORIGIN="${ORIGIN:-$DEFAULT_ORIGIN}"
export VITE_API_URL="${VITE_API_URL:-$ORIGIN}"
export VITE_WS_URL="${VITE_WS_URL:-$ORIGIN}"
echo "[capacitor-build-prod-client] VITE_API_URL=$VITE_API_URL VITE_WS_URL=$VITE_WS_URL (TURN из deploy.env при наличии)"

exec npm run build
