#!/usr/bin/env bash
# Загрузка Firebase service account JSON на VPS и перезапуск ping-moot.
# Ключ: Firebase Console → Project settings → Service accounts → Generate new private key.
#
# Использование (из корня репозитория):
#   bash scripts/push-fcm-service-account-to-server.sh ~/Downloads/firebase-adminsdk-xxx.json
set -euo pipefail
cd "$(dirname "$0")/.."

JSON_LOCAL="${1:-}"
if [ -z "$JSON_LOCAL" ] || [ ! -f "$JSON_LOCAL" ]; then
  echo "Укажи путь к JSON: bash scripts/push-fcm-service-account-to-server.sh /path/to/firebase-adminsdk-....json"
  exit 1
fi

ENV_FILE="${DEPLOY_ENV_FILE:-deploy.env}"
if [ ! -f "$ENV_FILE" ]; then
  echo "Нет $ENV_FILE (нужны VPS_HOST, VPS_USER, VPS_PASSWORD, VPS_PATH)"
  exit 1
fi
# shellcheck disable=SC1090
source "$ENV_FILE"

: "${VPS_HOST:?}"
: "${VPS_USER:?}"
: "${VPS_PATH:?}"
REMOTE_JSON="${VPS_PATH}/secrets/firebase-fcm-service-account.json"

run_ssh() {
  if [ -n "${VPS_PASSWORD:-}" ] && command -v sshpass >/dev/null 2>&1; then
    SSHPASS="$VPS_PASSWORD" sshpass -e ssh -T -o StrictHostKeyChecking=accept-new "$VPS_USER@$VPS_HOST" "$@"
  else
    ssh -T -o StrictHostKeyChecking=accept-new "$VPS_USER@$VPS_HOST" "$@"
  fi
}

run_scp() {
  if [ -n "${VPS_PASSWORD:-}" ] && command -v sshpass >/dev/null 2>&1; then
    SSHPASS="$VPS_PASSWORD" sshpass -e scp -o StrictHostKeyChecking=accept-new "$@"
  else
    scp -o StrictHostKeyChecking=accept-new "$@"
  fi
}

echo "=== mkdir secrets на сервере ==="
run_ssh "mkdir -p '${VPS_PATH}/secrets' && chmod 700 '${VPS_PATH}/secrets'"

echo "=== загрузка JSON ==="
run_scp "$JSON_LOCAL" "$VPS_USER@$VPS_HOST:$REMOTE_JSON"
run_ssh "chmod 600 '$REMOTE_JSON'"

echo "=== GOOGLE_APPLICATION_CREDENTIALS в .env на сервере ==="
run_ssh "f='${VPS_PATH}/.env'; line='GOOGLE_APPLICATION_CREDENTIALS=\"${REMOTE_JSON}\"'; if grep -q '^GOOGLE_APPLICATION_CREDENTIALS=' \"\$f\" 2>/dev/null; then sed -i.bak \"s|^GOOGLE_APPLICATION_CREDENTIALS=.*|\$line|\" \"\$f\"; else echo \"\$line\" >> \"\$f\"; fi"

echo "=== pm2 restart ping-moot ==="
run_ssh "cd '${VPS_PATH}' && pm2 restart ping-moot --update-env"

echo "Готово. Логи: ssh … 'pm2 logs ping-moot --lines 40'"
