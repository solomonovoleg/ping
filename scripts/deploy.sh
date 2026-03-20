#!/usr/bin/env bash
# Деплой: сборка → загрузка на сервер → миграции → рестарт PM2.
# .env на сервере: если в deploy.env задан DATABASE_URL — при каждом деплое .env на сервере
# перезаписывается из deploy.env. Один источник правды = deploy.env, править на сервере не нужно.
# Использование: npm run deploy (данные из deploy.env: VPS_HOST, VPS_USER, VPS_PASSWORD, DATABASE_URL и др.)

set -e
cd "$(dirname "$0")/.."

# Перезапуск с пустым окружением, иначе при большом deploy.env sed/ssh получают "Argument list too long"
if [ -z "${DEPLOY_CLEAN_ENV:-}" ] && [ -f deploy.env ]; then
  exec env -i "PATH=$PATH" "HOME=${HOME:-/tmp}" "TERM=${TERM:-dumb}" "DEPLOY_CLEAN_ENV=1" bash "$0" "$@"
fi

if [ ! -f deploy.env ]; then
  if [ ! -f deploy.env.example ]; then
    echo "Нет deploy.env. Создай deploy.env с VPS_HOST, VPS_USER, VPS_PASSWORD."
    exit 1
  fi
  echo "=== Создаю deploy.env из примера ==="
  cp deploy.env.example deploy.env
  SECRET=$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | base64 | tr -d '\n')
  (grep -v '^SESSION_SECRET=' deploy.env 2>/dev/null; echo "SESSION_SECRET=$SECRET") > deploy.env.tmp && mv deploy.env.tmp deploy.env
  echo "Готово. Заполни VPS_PASSWORD (и при необходимости DATABASE_URL для первого деплоя). Затем: npm run deploy"
  exit 0
fi

# Читаем deploy.env без export, чтобы не раздувать окружение (иначе mktemp/sed/ssh получают "Argument list too long")
while IFS= read -r line; do
  [[ "$line" =~ ^# ]] && continue
  line="${line#export }"
  [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]] && eval "$line"
done < deploy.env 2>/dev/null || true
# В окружение экспортируем только то, что нужно дочерним процессам (npm, sshpass).
# Важно: Vite читает только экспортированные переменные.
for v in ${!VITE_@}; do
  export "$v" 2>/dev/null || true
done
export SSHPASS 2>/dev/null || true
[ -f scripts/pre-deploy-check.sh ] && . scripts/pre-deploy-check.sh 2>/dev/null || true

SERVER_HOST="${1:-${SERVER_HOST:-${VPS_HOST:-130.49.150.92}}}"
SERVER_USER="${2:-${SERVER_USER:-${VPS_USER:-root}}}"
REMOTE_PORT="${PORT:-3080}"
REMOTE_DIR="${REMOTE_DIR:-${VPS_PATH:-/var/www/ping-moot}}"

if [ -n "${VPS_PASSWORD}" ] && [ "${DEPLOY_USE_SSHPASS:-1}" = "1" ]; then
  export SSHPASS="$VPS_PASSWORD"
  if ! command -v sshpass >/dev/null 2>&1; then
    echo "Установи sshpass: brew install sshpass (или настрой SSH-ключ)"
    unset SSHPASS
  fi
fi

run_ssh() { if [ -n "$SSHPASS" ]; then sshpass -e ssh -T -o RequestTTY=no -o StrictHostKeyChecking=accept-new "$@"; else ssh -T -o RequestTTY=no -o StrictHostKeyChecking=accept-new "$@"; fi; }
run_rsync() { if [ -n "$SSHPASS" ]; then sshpass -e rsync -e "ssh -T -o RequestTTY=no -o StrictHostKeyChecking=accept-new" "$@"; else rsync -e "ssh -T -o RequestTTY=no -o StrictHostKeyChecking=accept-new" "$@"; fi; }

echo "=== Сборка ==="
# tsx/vite/typescript в devDependencies. Если в deploy.env задан NODE_ENV=production, без флага npm ci их не ставит → «tsx: command not found».
NPM_CONFIG_PRODUCTION=false npm ci --legacy-peer-deps 2>/dev/null || NPM_CONFIG_PRODUCTION=false npm install --legacy-peer-deps
# Для звонков/клиента: переменные VITE_* уже экспортированы выше.
npm run build

echo "=== Загрузка на $SERVER_USER@$SERVER_HOST ==="
run_ssh "$SERVER_USER@$SERVER_HOST" "mkdir -p $REMOTE_DIR"
run_rsync -avz --delete \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude '.env' \
  --exclude 'uploads' \
  --filter 'P uploads/' \
  . "$SERVER_USER@$SERVER_HOST:$REMOTE_DIR/"

# .env на сервере: единственный источник правды — deploy.env. Если в deploy.env задан DATABASE_URL,
# при каждом деплое перезаписываем .env на сервере, чтобы не править его вручную и не путаться.
if [ -f deploy.env ] && [ -n "${DATABASE_URL:-}" ]; then
  echo "=== Запись .env на сервер из deploy.env ==="
  # Если SESSION_SECRET не задан в deploy.env — берём текущий с сервера, иначе после каждого деплоя все сессии сбрасываются
  if [ -z "${SESSION_SECRET:-}" ]; then
    existing=$(run_ssh "$SERVER_USER@$SERVER_HOST" "grep -E '^SESSION_SECRET=' $REMOTE_DIR/.env 2>/dev/null | head -1" 2>/dev/null) || true
    if [ -n "$existing" ] && [ "${#existing}" -le 600 ]; then
      eval "$existing"
      echo "SESSION_SECRET сохранён с сервера — сессии не сбросятся после деплоя."
    fi
  fi
  build_server_env() {
    local f="$1"
    > "$f"
    # Ограничиваем длину значений, иначе sed/printf получают "Argument list too long"
    put() { local v="${1:0:4000}"; local k="$2"; if [ -n "$v" ]; then echo -n "${k}=\"" >> "$f"; printf '%s' "$v" | sed 's/["\\]/\\&/g' >> "$f"; echo '"' >> "$f"; fi; true; }
    put "${PORT:-3080}" "PORT"
    [ -z "$SESSION_SECRET" ] && SESSION_SECRET=$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | base64)
    put "$SESSION_SECRET" "SESSION_SECRET"
    put "${SESSION_SECURE:-false}" "SESSION_SECURE"
    # Всегда пишем localhost (на VPS не должно быть base): берём пароль из DB_PASSWORD или из DATABASE_URL
    if [ -n "${DB_PASSWORD:-}" ]; then
      db_url="postgresql://ping_moot:${DB_PASSWORD}@localhost:5432/ping_moot"
    else
      db_url="${DATABASE_URL:-}"
      db_url="${db_url//@base/@localhost}"
      db_url="${db_url//base:5432/localhost:5432}"
    fi
    put "$db_url" "DATABASE_URL"
    put "$ADMIN_LOGIN" "ADMIN_LOGIN"
    put "$ADMIN_PASSWORD" "ADMIN_PASSWORD"
    put "$FCM_SERVER_KEY" "FCM_SERVER_KEY"
    put "$OPENROUTER_API_KEY" "OPENROUTER_API_KEY"
    put "$OPENROUTER_MODEL" "OPENROUTER_MODEL"
    put "$CALLS_DEBUG" "CALLS_DEBUG"
    put "$GROUP_CALLS_ENABLED" "GROUP_CALLS_ENABLED"
    put "$GROUP_CALLS_SERVER_ASR_ENABLED" "GROUP_CALLS_SERVER_ASR_ENABLED"
    put "$CALL_TRANSCRIPTS_ASR_URL" "CALL_TRANSCRIPTS_ASR_URL"
    put "$CALL_TRANSCRIPTS_ASR_WS_URL" "CALL_TRANSCRIPTS_ASR_WS_URL"
    put "$CALL_TRANSCRIPTS_ASR_API_KEY" "CALL_TRANSCRIPTS_ASR_API_KEY"
    put "$CALLS_RING_TIMEOUT_MS" "CALLS_RING_TIMEOUT_MS"
    put "$CALLS_CALLER_WAIT_MS" "CALLS_CALLER_WAIT_MS"
    put "$CALLS_PENDING_TTL_MS" "CALLS_PENDING_TTL_MS"
    put "$S3_ENDPOINT" "S3_ENDPOINT"
    put "$S3_BUCKET" "S3_BUCKET"
    put "$S3_REGION" "S3_REGION"
    put "$S3_ACCESS_KEY" "S3_ACCESS_KEY"
    put "$S3_SECRET_KEY" "S3_SECRET_KEY"
    put "$S3_PUBLIC_ACL" "S3_PUBLIC_ACL"
  }
  ENV_TMP="/tmp/ping-moot-deploy-$$.env"
  trap "rm -f $ENV_TMP" EXIT
  build_server_env "$ENV_TMP"
  run_scp() { if [ -n "$SSHPASS" ]; then sshpass -e scp -o StrictHostKeyChecking=accept-new "$@"; else scp "$@"; fi; }
  run_scp "$ENV_TMP" "$SERVER_USER@$SERVER_HOST:$REMOTE_DIR/.env" || { echo "Ошибка записи .env"; exit 1; }
else
  if [ -f deploy.env ] && [ -z "${DATABASE_URL:-}" ]; then
    echo "=== В deploy.env нет DATABASE_URL — .env на сервере не трогаем. Заполни DATABASE_URL в deploy.env для обновления. ==="
  else
    echo "=== deploy.env отсутствует или пуст — .env на сервере не трогаем ==="
  fi
fi

# На сервере в .env хост должен быть localhost: правим base -> localhost в файле до установки
run_ssh "$SERVER_USER@$SERVER_HOST" "test -f $REMOTE_DIR/.env && sed -i.bak -e 's/@base/@localhost/g' -e 's/:base:5432/:localhost:5432/g' $REMOTE_DIR/.env && echo 'OK: .env (base->localhost)' || true"

echo "=== Установка зависимостей, миграции, рестарт на сервере ==="
PM2_APP_NAME_ESC="${PM2_APP_NAME:-ping-moot}"
run_ssh "$SERVER_USER@$SERVER_HOST" "cd $REMOTE_DIR && PORT=$REMOTE_PORT PM2_APP_NAME=\"$PM2_APP_NAME_ESC\" bash scripts/server-setup.sh" || { echo "Ошибка на сервере"; exit 1; }
