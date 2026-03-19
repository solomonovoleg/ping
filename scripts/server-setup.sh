#!/usr/bin/env bash
# Установка и запуск на сервере через PM2 (порт 3080).
# Использование: из корня проекта на сервере: PORT=3080 bash scripts/server-setup.sh

set -e
cd "$(dirname "$0")/.."
PORT="${PORT:-3080}"

echo "=== PING MOOT — установка и запуск на порту $PORT ==="

# Node.js (если ещё не установлен)
if ! command -v node &>/dev/null; then
  echo "Установка Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

node -v
npm -v

# Зависимости
if [ -f dist/index.cjs ]; then
  npm ci --omit=dev 2>/dev/null || npm install --omit=dev
else
  echo "Сборка на сервере (dist не найден)..."
  npm ci 2>/dev/null || npm install
  npm run build
fi

# .env: если нет — копируем пример и подставляем SESSION_SECRET
if [ ! -f .env ]; then
  cp -n .env.example .env 2>/dev/null || true
fi
if ! grep -q '^SESSION_SECRET=.\+' .env 2>/dev/null; then
  SECRET=$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | base64)
  if grep -q '^SESSION_SECRET=' .env 2>/dev/null; then
    sed -i.bak "s/^SESSION_SECRET=.*/SESSION_SECRET=$SECRET/" .env
  else
    echo "SESSION_SECRET=$SECRET" >> .env
  fi
  echo "В .env подставлен сгенерированный SESSION_SECRET."
fi
if ! grep -q '^SESSION_SECURE=' .env 2>/dev/null; then
  echo "SESSION_SECURE=true" >> .env
  echo "В .env добавлен SESSION_SECURE=true (для HTTPS). Для доступа по HTTP поставьте SESSION_SECURE=false."
fi

# Если нет DATABASE_URL — ставим PostgreSQL (если нет) и создаём БД
if ! grep -q '^DATABASE_URL=.\+' .env 2>/dev/null; then
  if command -v psql &>/dev/null; then
    : # PostgreSQL уже есть
  else
    echo "Установка PostgreSQL..."
    apt-get update -qq && apt-get install -y -qq postgresql postgresql-contrib &>/dev/null || true
  fi
  if sudo -u postgres psql -d postgres -c '\q' 2>/dev/null; then
    EXISTING=$(sudo -u postgres psql -d postgres -t -A -c "SELECT 1 FROM pg_roles WHERE rolname='ping_moot'" 2>/dev/null || true)
    if [ -z "$EXISTING" ] || [ "$EXISTING" != "1" ]; then
      echo "Создание БД ping_moot и пользователя ping_moot..."
      DB_PASS=$(openssl rand -hex 16)
      sudo -u postgres psql -d postgres -v ON_ERROR_STOP=1 <<EOSQL
CREATE USER ping_moot WITH PASSWORD '$DB_PASS';
CREATE DATABASE ping_moot OWNER ping_moot;
EOSQL
      sudo -u postgres psql -d ping_moot -v ON_ERROR_STOP=1 -c "GRANT ALL ON SCHEMA public TO ping_moot;"
      echo "DATABASE_URL=postgresql://ping_moot:${DB_PASS}@localhost:5432/ping_moot" >> .env
      echo "БД создана, DATABASE_URL записан в .env."
    else
      echo "Пользователь ping_moot уже есть. Добавь в deploy.env: DATABASE_URL=postgresql://ping_moot:ПАРОЛЬ_БД@localhost:5432/ping_moot"
    fi
  else
    echo "PostgreSQL не запущен или нет доступа. Добавь DATABASE_URL в deploy.env вручную."
  fi
fi

# На VPS БД всегда localhost: правим .env и передаём миграциям гарантированно localhost
if grep -q '^DATABASE_URL=.\+' .env 2>/dev/null; then
  sed -i.bak 's/@base/@localhost/g; s/:base:5432/:localhost:5432/g' .env 2>/dev/null || true
  DB_URL_RAW=$(grep '^DATABASE_URL=' .env 2>/dev/null | cut -d= -f2- | sed "s/^[\"']//;s/[\"']$//")
  export DATABASE_URL=$(echo "$DB_URL_RAW" | sed 's/@base/@localhost/g;s/:base:5432/:localhost:5432/g')
  echo "Миграции БД..."
  [ -f scripts/run-migrations.cjs ] && DATABASE_URL="$DATABASE_URL" node scripts/run-migrations.cjs || true
else
  echo "DATABASE_URL не задан в .env — миграции пропущены (приложение будет без БД)."
fi

# PM2: установка и запуск
if ! command -v pm2 &>/dev/null; then
  echo "Установка PM2..."
  npm install -g pm2
fi

cd "$(dirname "$0")/.."
PM2_APP_NAME="${PM2_APP_NAME:-ping-moot}"
pm2 delete "$PM2_APP_NAME" 2>/dev/null || true
PORT="$PORT" PM2_APP_NAME="$PM2_APP_NAME" pm2 start ecosystem.config.cjs
pm2 save
pm2 startup 2>/dev/null || true

echo ""
echo "Приложение запущено на порту $PORT (PM2, имя процесса: $PM2_APP_NAME). Проверка: http://$(hostname -I | awk '{print $1}'):$PORT"
echo "Команды: pm2 status | pm2 logs $PM2_APP_NAME | pm2 restart $PM2_APP_NAME"
