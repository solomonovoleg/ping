#!/usr/bin/env bash
# Полный социальный сид на проде (удаляет старых seed_social_*, создаёт юзеров + посты + сториз).
# Нужен deploy.env (VPS_HOST, VPS_USER, VPS_PASSWORD опционально, VPS_PATH).
# Локально из корня: npm run deploy:seed-social   или   bash scripts/seed-social-on-server.sh
#
# На сервере читается .env из каталога приложения (DATABASE_URL).

set -e
cd "$(dirname "$0")/.."
[ -f deploy.env ] && source deploy.env
[ -n "${VPS_PASSWORD}" ] && export SSHPASS="${VPS_PASSWORD}"

SERVER_HOST="${VPS_HOST:-130.49.150.92}"
SERVER_USER="${VPS_USER:-root}"
REMOTE_DIR="${VPS_PATH:-/var/www/ping-moot}"

run_ssh() {
  if [ -n "${SSHPASS}" ]; then
    sshpass -e ssh -T -o StrictHostKeyChecking=accept-new "$@"
  else
    ssh -T -o StrictHostKeyChecking=accept-new "$@"
  fi
}

echo "=== Сид seed:social-fresh на $SERVER_USER@$SERVER_HOST:$REMOTE_DIR ==="
run_ssh "$SERVER_USER@$SERVER_HOST" "cd $REMOTE_DIR && npx --yes tsx scripts/seed-social-content.ts --reset --allow-fallback && node scripts/migrate-designated-follows.cjs && echo 'OK: social seed + designated follows'"
