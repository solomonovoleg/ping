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

# Останавливаем приложение перед миграциями (освобождаем слоты PostgreSQL). Рестарт всегда — чтобы не оставить сервис в stop при ошибке миграций.
run_ssh "$SERVER_USER@$SERVER_HOST" "cd $REMOTE_DIR && pm2 stop ping-moot 2>/dev/null || true; sleep 2; if node scripts/run-migrations.cjs; then pm2 restart ping-moot && echo 'OK: миграции и рестарт выполнены'; else pm2 restart ping-moot; echo 'Ошибка миграций (см. лог выше), приложение перезапущено'; exit 1; fi"
