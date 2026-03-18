#!/usr/bin/env bash
# Запуск миграций на сервере одной командой. Использует deploy.env (VPS_HOST, VPS_USER).
# Из корня проекта: npm run deploy:migrate   или   bash scripts/migrate-on-server.sh

set -e
cd "$(dirname "$0")/.."
[ -f deploy.env ] && source deploy.env
[ -n "${VPS_PASSWORD}" ] && export SSHPASS="${VPS_PASSWORD}"

SERVER_HOST="${VPS_HOST:-130.49.150.92}"
SERVER_USER="${VPS_USER:-root}"
REMOTE_DIR="${VPS_PATH:-/var/www/ping-moot}"

run_ssh() {
  if [ -n "${SSHPASS}" ]; then
    sshpass -e ssh -o StrictHostKeyChecking=accept-new "$@"
  else
    ssh "$@"
  fi
}

run_ssh "$SERVER_USER@$SERVER_HOST" "cd $REMOTE_DIR && node scripts/run-migrations.cjs && pm2 restart ping-moot && echo 'OK: миграции и рестарт выполнены'"
