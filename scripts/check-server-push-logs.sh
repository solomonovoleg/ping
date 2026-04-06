#!/usr/bin/env bash
# Снять с VPS последние строки логов PM2, связанные с пушами (FCM).
# Использование (из корня репозитория):
#   bash scripts/check-server-push-logs.sh
# Переменные: DEPLOY_ENV_FILE (по умолчанию deploy.env), PM2_APP_NAME (по умолчанию ping-moot).
set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE="${DEPLOY_ENV_FILE:-deploy.env}"
if [ ! -f "$ENV_FILE" ]; then
  echo "Нет $ENV_FILE — нужны VPS_HOST, VPS_USER, VPS_PATH (и опционально VPS_PASSWORD + sshpass)."
  exit 1
fi
# shellcheck disable=SC1090
source "$ENV_FILE"

: "${VPS_HOST:?}"
: "${VPS_USER:?}"
: "${VPS_PATH:?}"

PM2_NAME="${PM2_APP_NAME:-ping-moot}"
REMOTE_JSON="${GOOGLE_APPLICATION_CREDENTIALS:-${VPS_PATH}/secrets/firebase-fcm-service-account.json}"

run_ssh() {
  if [ -n "${VPS_PASSWORD:-}" ] && command -v sshpass >/dev/null 2>&1; then
    SSHPASS="$VPS_PASSWORD" sshpass -e ssh -T -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15 "$VPS_USER@$VPS_HOST" "$@"
  else
    ssh -T -o StrictHostKeyChecking=accept-new -o ConnectTimeout=15 "$VPS_USER@$VPS_HOST" "$@"
  fi
}

echo "=== FCM service account (на сервере) ==="
run_ssh "if [ -f '${REMOTE_JSON}' ]; then echo OK: file exists: ${REMOTE_JSON}; wc -c '${REMOTE_JSON}' | awk '{print \"bytes:\", \$1}'; else echo MISSING: ${REMOTE_JSON}; fi"

echo ""
echo "=== PM2 ${PM2_NAME}: строки про пуши (последние совпадения) ==="
run_ssh "cd '${VPS_PATH}' && (pm2 logs '${PM2_NAME}' --lines 400 --nostream 2>/dev/null || pm2 logs --lines 400 --nostream 2>/dev/null) | grep -E '\\[push\\]|FCM|push.token|chat_message|post_share' | tail -60 || echo '(совпадений нет в последних 400 строках — увеличь трафик или смотри полный лог: pm2 logs ${PM2_NAME})'"
