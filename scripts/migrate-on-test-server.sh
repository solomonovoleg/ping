#!/usr/bin/env bash
# Миграции на тестовом VPS: deploy.env (SSH) + deploy.test.env (VPS_PATH, PM2_APP_NAME, тестовая БД в .env на сервере).
# Из корня: npm run deploy:migrate:test

set -e
cd "$(dirname "$0")/.."
[ -f deploy.env ] && source deploy.env
[ -f deploy.test.env ] && source deploy.test.env
[ -n "${VPS_PASSWORD}" ] && export SSHPASS="${VPS_PASSWORD}"

SERVER_HOST="${VPS_HOST:-130.49.150.92}"
SERVER_USER="${VPS_USER:-root}"
REMOTE_DIR="${VPS_PATH:-/var/www/ping-moot-test}"
PM2_NAME="${PM2_APP_NAME:-ping-moot-test}"

run_ssh() {
  if [ -n "${SSHPASS}" ]; then
    sshpass -e ssh -o StrictHostKeyChecking=accept-new "$@"
  else
    ssh "$@"
  fi
}

run_ssh "$SERVER_USER@$SERVER_HOST" "cd $REMOTE_DIR && pm2 stop $PM2_NAME 2>/dev/null || true; sleep 2; if node scripts/run-migrations.cjs; then pm2 restart $PM2_NAME && echo 'OK: тест — миграции и рестарт выполнены'; else pm2 restart $PM2_NAME; echo 'Ошибка миграций на тесте (см. лог выше), приложение перезапущено'; exit 1; fi"
