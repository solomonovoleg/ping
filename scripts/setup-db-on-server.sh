#!/usr/bin/env bash
# На сервере: добавляет DATABASE_URL в .env, применяет схему, перезапускает PM2.
# Сначала создай БД (один раз): DB_PASSWORD=пароль sudo -u postgres bash deploy/create-db.sh
# Потом: DB_PASSWORD=пароль bash scripts/setup-db-on-server.sh

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

DB_NAME="${DB_NAME:-ping_moot}"
DB_USER="${DB_USER:-ping_moot}"
DB_PASSWORD="${DB_PASSWORD:?Задай DB_PASSWORD (пароль БД)}"

URL="postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}"

echo "=== DATABASE_URL в .env ==="
if grep -q '^DATABASE_URL=' .env 2>/dev/null; then
  sed -i.bak "s|^DATABASE_URL=.*|DATABASE_URL=$URL|" .env
else
  echo "DATABASE_URL=$URL" >> .env
fi
echo "Записано."

echo "=== Схема БД (db:push) ==="
export DATABASE_URL="$URL"
npm run db:push 2>/dev/null || npx drizzle-kit push 2>/dev/null || true

echo "=== Перезапуск PM2 ==="
pm2 restart ping-moot 2>/dev/null || true
echo "Готово. Супер-админ: npm run seed:admin (логин admin, пароль 667866)"
