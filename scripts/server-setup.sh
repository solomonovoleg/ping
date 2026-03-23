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

# Видео в постах/сториз: сервер перекодирует через ffmpeg (libx264). Без пакета загрузка видео падает.
if ! command -v ffmpeg &>/dev/null; then
  if command -v apt-get &>/dev/null; then
    echo "Установка ffmpeg (нужен для загрузки видео)..."
    apt-get update -qq && apt-get install -y -qq ffmpeg || echo "Предупреждение: apt не смог установить ffmpeg — поставь вручную: apt-get install -y ffmpeg"
  else
    echo "Предупреждение: ffmpeg не найден и apt-get недоступен — установи ffmpeg вручную для видео."
  fi
fi
if command -v ffmpeg &>/dev/null; then
  echo "ffmpeg: $(ffmpeg -version 2>/dev/null | head -n1)"
  if ffmpeg -hide_banner -encoders 2>/dev/null | grep -q libx264; then
    echo "Кодер libx264: есть"
  else
    echo "ВНИМАНИЕ: в сборке ffmpeg нет libx264 — перекодирование постов может ломаться. Нужен полный пакет ffmpeg (Debian/Ubuntu: apt install ffmpeg)."
  fi
else
  echo "ОШИБКА: ffmpeg отсутствует — загрузка видео в ленту/сториз не будет работать."
fi

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
PM2_APP_NAME="${PM2_APP_NAME:-ping-moot}"
if grep -q '^DATABASE_URL=.\+' .env 2>/dev/null; then
  sed -i.bak 's/@base/@localhost/g; s/:base:5432/:localhost:5432/g' .env 2>/dev/null || true
  DB_URL_RAW=$(grep '^DATABASE_URL=' .env 2>/dev/null | cut -d= -f2- | sed "s/^[\"']//;s/[\"']$//")
  export DATABASE_URL=$(echo "$DB_URL_RAW" | sed 's/@base/@localhost/g;s/:base:5432/:localhost:5432/g')
  # По умолчанию приложение не останавливаем: nginx продолжает проксировать на :PORT, нет длинного «connection refused».
  # run-migrations.cjs сам ретраит 53300 (too many clients). Если на слабом Postgres всё равно падает — один раз:
  #   DEPLOY_STOP_PM2_BEFORE_MIGRATE=1 bash scripts/server-setup.sh
  if command -v pm2 &>/dev/null && [ "${DEPLOY_STOP_PM2_BEFORE_MIGRATE:-0}" = "1" ]; then
    echo "Остановка $PM2_APP_NAME перед миграциями (DEPLOY_STOP_PM2_BEFORE_MIGRATE=1)..."
    pm2 stop "$PM2_APP_NAME" 2>/dev/null || true
    sleep 2
  fi
  echo "Миграции БД..."
  if [ -f scripts/run-migrations.cjs ]; then
    DATABASE_URL="$DATABASE_URL" node scripts/run-migrations.cjs
  else
    echo "Предупреждение: scripts/run-migrations.cjs не найден, миграции пропущены."
  fi
else
  echo "DATABASE_URL не задан в .env — миграции пропущены (приложение будет без БД)."
fi

# Миграции БД микросервиса EDGE (опционально, не влияют на основное приложение)
if [ -f EDGE/db/run-migrations.cjs ] && grep -q '^EDGE_DATABASE_URL=.\+' .env 2>/dev/null; then
  EDGE_DB_RAW=$(grep '^EDGE_DATABASE_URL=' .env 2>/dev/null | cut -d= -f2- | sed "s/^[\"']//;s/[\"']$//")
  export EDGE_DATABASE_URL=$(echo "$EDGE_DB_RAW" | sed 's/@base/@localhost/g;s/:base:5432/:localhost:5432/g')
  echo "Миграции БД EDGE..."
  node EDGE/db/run-migrations.cjs || echo "Предупреждение: миграции EDGE завершились с ошибкой (проверь EDGE_DATABASE_URL)."
fi

# Миграции PARSER (ВК): та же PostgreSQL, что у платформы (PARSER_DATABASE_URL или DATABASE_URL)
if [ -f PARSER/db/run-migrations.cjs ]; then
  echo "Миграции PARSER..."
  node PARSER/db/run-migrations.cjs || echo "Предупреждение: миграции PARSER (проверь DATABASE_URL в .env)."
fi

# Бесплатный self-hosted ASR для титров групповых звонков (Vosk)
if grep -q '^GROUP_CALLS_SERVER_ASR_ENABLED=1' .env 2>/dev/null; then
  echo "Настройка Vosk ASR для групповых титров..."
  if ! grep -q '^CALL_TRANSCRIPTS_ASR_URL=' .env 2>/dev/null; then
    echo 'CALL_TRANSCRIPTS_ASR_URL=http://127.0.0.1:8099/transcribe' >> .env
  fi
  if ! grep -q '^CALL_TRANSCRIPTS_ASR_WS_URL=' .env 2>/dev/null; then
    echo 'CALL_TRANSCRIPTS_ASR_WS_URL=ws://127.0.0.1:8100/stream' >> .env
  fi
  VOSK_ENV_LINE=$(grep '^CALL_TRANSCRIPTS_ASR_API_KEY=' .env 2>/dev/null | cut -d= -f2- | sed "s/^[\"']//;s/[\"']$//")
  CALL_TRANSCRIPTS_ASR_API_KEY="${CALL_TRANSCRIPTS_ASR_API_KEY:-$VOSK_ENV_LINE}" \
    bash scripts/setup-vosk-asr-on-server.sh
fi

# PM2: установка и запуск
if ! command -v pm2 &>/dev/null; then
  echo "Установка PM2..."
  npm install -g pm2
fi

cd "$(dirname "$0")/.."
PM2_APP_NAME="${PM2_APP_NAME:-ping-moot}"
if pm2 describe "$PM2_APP_NAME" >/dev/null 2>&1; then
  RUN_PID=$(pm2 pid "$PM2_APP_NAME" 2>/dev/null || true)
  if [ -n "${RUN_PID:-}" ] && [ "${RUN_PID:-0}" -gt 0 ] 2>/dev/null; then
    echo "PM2: reload $PM2_APP_NAME (новый dist и PORT из ecosystem, --update-env)..."
    PORT="$PORT" PM2_APP_NAME="$PM2_APP_NAME" pm2 reload ecosystem.config.cjs --update-env
  else
    echo "PM2: процесс был остановлен — restart $PM2_APP_NAME..."
    PORT="$PORT" PM2_APP_NAME="$PM2_APP_NAME" pm2 restart "$PM2_APP_NAME" --update-env || \
      PORT="$PORT" PM2_APP_NAME="$PM2_APP_NAME" pm2 start ecosystem.config.cjs
  fi
else
  echo "PM2: первый запуск $PM2_APP_NAME..."
  PORT="$PORT" PM2_APP_NAME="$PM2_APP_NAME" pm2 start ecosystem.config.cjs
fi
pm2 save
pm2 startup 2>/dev/null || true

echo ""
echo "Приложение запущено на порту $PORT (PM2, имя процесса: $PM2_APP_NAME). Проверка: http://$(hostname -I | awk '{print $1}'):$PORT"
PN="${PINGOK_PM2_NAME:-pingok-micro}"
if pm2 describe "$PN" >/dev/null 2>&1; then
  echo "ПИНГОК МИКРО: pm2 describe $PN | pm2 logs $PN (порт PINGOK_MICRO_PORT в .env, по умолчанию 3091)"
fi
EN="${EDGE_PM2_NAME:-ping-moot-edge}"
if pm2 describe "$EN" >/dev/null 2>&1; then
  echo "EDGE: pm2 describe $EN | pm2 logs $EN (EDGE_PORT в .env, по умолчанию 3092; прокси: EDGE_UPSTREAM_URL на платформе)"
fi
PR="${PARSER_PM2_NAME:-ping-moot-parser}"
if pm2 describe "$PR" >/dev/null 2>&1; then
  echo "PARSER: pm2 describe $PR | pm2 logs $PR (PARSER_PORT, PARSER_UPSTREAM_URL + PARSER_SERVICE_SECRET на платформе)"
fi
echo "Команды: pm2 status | pm2 logs $PM2_APP_NAME | pm2 restart $PM2_APP_NAME"
