#!/usr/bin/env bash
# Загрузить APNs ключ (.p8) на VPS в каталог secrets приложения (для CallKit VoIP).
# Переменные VPS_* читаются из deploy.env (как у migrate-on-server).
#
#   bash scripts/upload-apns-voip-key.sh ~/Downloads/AuthKey_XXXXX.p8
#
# Затем в deploy.env задай APNS_VOIP_KEY_ID, APNS_TEAM_ID и строку:
#   APNS_VOIP_KEY_PATH=/var/www/ping-moot/secrets/apns-voip.p8
# (путь поправь, если VPS_PATH другой) и сделай npm run deploy.

set -euo pipefail
cd "$(dirname "$0")/.."

KEY_LOCAL="${1:-}"
if [ -z "$KEY_LOCAL" ] || [ ! -f "$KEY_LOCAL" ]; then
  echo "Использование: bash scripts/upload-apns-voip-key.sh /путь/к/AuthKey_XXX.p8"
  exit 1
fi

ENV_FILE="${DEPLOY_ENV_FILE:-deploy.env}"
if [ ! -f "$ENV_FILE" ]; then
  echo "Нет $ENV_FILE — создай из deploy.env.example."
  exit 1
fi

while IFS= read -r line || [ -n "$line" ]; do
  [[ "$line" =~ ^[[:space:]]*# ]] && continue
  [[ -z "${line//[[:space:]]/}" ]] && continue
  line="${line#export }"
  [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]] && eval "$line"
done < "$ENV_FILE"

[ -n "${VPS_PASSWORD:-}" ] && export SSHPASS="${VPS_PASSWORD}"

SERVER_HOST="${VPS_HOST:-130.49.150.92}"
SERVER_USER="${VPS_USER:-root}"
REMOTE_DIR="${VPS_PATH:-/var/www/ping-moot}"
REMOTE_KEY="$REMOTE_DIR/secrets/apns-voip.p8"

run_ssh() {
  if [ -n "${SSHPASS:-}" ]; then
    sshpass -e ssh -o StrictHostKeyChecking=accept-new "$@"
  else
    ssh "$@"
  fi
}
run_scp() {
  if [ -n "${SSHPASS:-}" ]; then
    sshpass -e scp -o StrictHostKeyChecking=accept-new "$@"
  else
    scp "$@"
  fi
}

echo "=== mkdir $REMOTE_DIR/secrets на $SERVER_USER@$SERVER_HOST ==="
run_ssh "$SERVER_USER@$SERVER_HOST" "mkdir -p \"$REMOTE_DIR/secrets\" && chmod 700 \"$REMOTE_DIR/secrets\""

TMP_REMOTE="/tmp/apns-voip-upload-$$.p8"
echo "=== scp → $TMP_REMOTE ==="
run_scp "$KEY_LOCAL" "$SERVER_USER@$SERVER_HOST:$TMP_REMOTE"

echo "=== install → $REMOTE_KEY ==="
run_ssh "$SERVER_USER@$SERVER_HOST" "mv -f \"$TMP_REMOTE\" \"$REMOTE_KEY\" && chmod 600 \"$REMOTE_KEY\" && echo OK"

echo ""
echo "Файл на сервере: $REMOTE_KEY"
echo "Добавь в $ENV_FILE (значения Key ID / Team ID — с developer.apple.com):"
echo "  APNS_VOIP_KEY_PATH=$REMOTE_KEY"
echo "  APNS_VOIP_KEY_ID=..."
echo "  APNS_TEAM_ID=..."
echo "  IOS_APP_BUNDLE_ID=ru.pingmoot.app"
echo "Затем: npm run deploy  (перезапишет .env на VPS с этими переменными)"
