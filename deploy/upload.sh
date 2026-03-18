#!/usr/bin/env bash
# Заливка PING MOOT на VPS: сборка локально + rsync в отдельную папку на сервере.
#
# Настрой один раз (или передай в командной строке):
#   export VPS_HOST=твой-сервер.ru
#   export VPS_USER=deploy
#   export VPS_PATH=/var/www/ping-moot
#
# Запуск из корня проекта: ./deploy/upload.sh
# Или: VPS_HOST=ip VPS_USER=user VPS_PATH=/var/www/ping-moot ./deploy/upload.sh

set -e
cd "$(dirname "$0")/.."

# Можно задать через deploy.env в корне: source deploy.env && ./deploy/upload.sh
VPS_HOST="${VPS_HOST:-}"
VPS_USER="${VPS_USER:-deploy}"
VPS_PATH="${VPS_PATH:-/var/www/ping-moot}"

if [ -z "$VPS_HOST" ]; then
  echo "Задай VPS_HOST (IP или домен). Пример: export VPS_HOST=твой-сервер.ru"
  echo "Или создай deploy.env: VPS_HOST=... VPS_USER=... VPS_PATH=/var/www/ping-moot"
  exit 1
fi

# Если задан SSHPASS, используем sshpass для rsync и ssh (парольная авторизация)
RSH="ssh -o StrictHostKeyChecking=no"
if [ -n "${SSHPASS:+x}" ]; then
  if command -v sshpass >/dev/null 2>&1; then
    RSH="sshpass -e ssh -o StrictHostKeyChecking=no"
  else
    echo "Задан SSHPASS, но sshpass не установлен. Установи: brew install sshpass (macOS) или apt install sshpass (Linux)"
    exit 1
  fi
fi

echo "Сборка..."
npm run build

echo "Заливка на ${VPS_USER}@${VPS_HOST}:${VPS_PATH}"
RSYNC_RSH="$RSH" rsync -avz --delete \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude '.env' \
  --exclude '.env.*' \
  --exclude 'deploy.env' \
  . "${VPS_USER}@${VPS_HOST}:${VPS_PATH}/"

echo "Установка зависимостей на сервере (production)..."
$RSH "${VPS_USER}@${VPS_HOST}" "cd ${VPS_PATH} && npm ci --omit=dev"

echo "Миграции БД (drizzle-kit push)..."
$RSH "${VPS_USER}@${VPS_HOST}" "cd ${VPS_PATH} && ( set -a; [ -f .env ] && . ./.env; set +a; npx drizzle-kit@latest push --config=drizzle.config.ts )" || {
  echo "Предупреждение: миграции не выполнились. На сервере: cd ${VPS_PATH} && . ./.env && npx drizzle-kit push"
}

echo "Перезапуск приложения на VPS (из ${VPS_PATH}, чтобы подхватить .env)..."
$RSH "${VPS_USER}@${VPS_HOST}" "cd ${VPS_PATH} && (pm2 delete ping-moot 2>/dev/null; pm2 start ecosystem.config.cjs)"

echo ""
echo "Готово. Если pm2 не использовался, запусти вручную:"
echo "  cd ${VPS_PATH} && PORT=3080 SESSION_SECRET=... DATABASE_URL=... npm run start"
echo "  или: pm2 start ecosystem.config.cjs"
