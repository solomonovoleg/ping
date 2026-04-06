#!/usr/bin/env bash
# Деплой: сборка → загрузка на сервер → миграции → рестарт PM2.
# .env на VPS: при заданном DATABASE_URL перезаписывается из переменных окружения деплоя (см. build_server_env).
# npm run deploy — только deploy.env.
# npm run deploy:test — сначала deploy.env (все секреты, S3, TURN, New-Tel…), затем deploy.test.env (только тест: папка, порт, БД, домен VITE_*, порты микросервисов). Ничего не переносить вручную.

set -e
cd "$(dirname "$0")/.."

DEPLOY_ENV_FILE="${DEPLOY_ENV_FILE:-deploy.env}"
DEPLOY_MERGE_WITH="${DEPLOY_MERGE_WITH:-}"

load_deploy_env_file() {
  local f="$1"
  [ -f "$f" ] || return 0
  while IFS= read -r line || [ -n "$line" ]; do
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ -z "${line//[[:space:]]/}" ]] && continue
    line="${line#export }"
    [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]] && eval "$line"
  done < "$f"
}

# Vite видит только экспортированные переменные. На macOS /bin/bash 3.2 нет ${!VITE_@} — цикл не экспортировал бы VITE_*.
# Повторно читаем строки VITE_* из тех же файлов, что уже смержены в shell, и делаем export (порядок = приоритет тестового слоя).
export_vite_from_deploy_files() {
  for f in "$@"; do
    [ -f "$f" ] || continue
    while IFS= read -r line || [ -n "$line" ]; do
      [[ "$line" =~ ^[[:space:]]*# ]] && continue
      [[ -z "${line//[[:space:]]/}" ]] && continue
      line="${line#export }"
      if [[ "$line" =~ ^VITE_[A-Za-z0-9_]+= ]]; then
        eval "export $line" || true
      fi
    done < "$f"
  done
}

# Перезапуск с пустым окружением, иначе при большом deploy.env sed/ssh получают "Argument list too long"
if [ -z "${DEPLOY_CLEAN_ENV:-}" ] && [ -f "$DEPLOY_ENV_FILE" ]; then
  if [ -n "$DEPLOY_MERGE_WITH" ] && [ ! -f "$DEPLOY_MERGE_WITH" ]; then
    echo "Ошибка: для слияния нужен файл $DEPLOY_MERGE_WITH (создай из deploy.env.example и заполни)."
    exit 1
  fi
  MERGE_ARG=()
  [ -n "$DEPLOY_MERGE_WITH" ] && MERGE_ARG=( "DEPLOY_MERGE_WITH=$DEPLOY_MERGE_WITH" )
  CLEAN_ARGS=( "PATH=$PATH" "HOME=${HOME:-/tmp}" "TERM=${TERM:-dumb}" "DEPLOY_CLEAN_ENV=1" "DEPLOY_ENV_FILE=$DEPLOY_ENV_FILE" )
  # Иначе env -i съедает флаги с командной строки: DEPLOY_SKIP_ENV_VERIFY=1 npm run deploy
  [ -n "${DEPLOY_SKIP_ENV_VERIFY:-}" ] && CLEAN_ARGS+=( "DEPLOY_SKIP_ENV_VERIFY=$DEPLOY_SKIP_ENV_VERIFY" )
  [ -n "${DEPLOY_VERIFY_MINIMAL:-}" ] && CLEAN_ARGS+=( "DEPLOY_VERIFY_MINIMAL=$DEPLOY_VERIFY_MINIMAL" )
  exec env -i "${CLEAN_ARGS[@]}" "${MERGE_ARG[@]}" bash "$0" "$@"
fi

if [ ! -f "$DEPLOY_ENV_FILE" ]; then
  if [ -n "$DEPLOY_MERGE_WITH" ]; then
    if [ ! -f "$DEPLOY_MERGE_WITH" ]; then
      echo "Сначала нужен $DEPLOY_MERGE_WITH (все ключи как для прода)."
      echo "Создай: cp deploy.env.example deploy.env и заполни, затем снова: npm run deploy:test"
      exit 1
    fi
    if [ -f deploy.test.env.example ]; then
      cp deploy.test.env.example "$DEPLOY_ENV_FILE"
      chmod 600 "$DEPLOY_ENV_FILE" 2>/dev/null || true
      echo "=== Создан $DEPLOY_ENV_FILE (накладывается поверх $DEPLOY_MERGE_WITH) ==="
      echo "Открой файл и поправь только DATABASE_URL (тестовая БД) и при необходимости домен вместо pingdepo.ru."
      echo "S3, TURN, New-Tel, FCM и остальное уже в $DEPLOY_MERGE_WITH — не копируй вручную."
      exit 0
    fi
  fi
  if [ "$DEPLOY_ENV_FILE" != "deploy.env" ]; then
    if [ -f deploy.env.example ]; then
      echo "=== Создаю $DEPLOY_ENV_FILE из deploy.env.example ==="
      cp deploy.env.example "$DEPLOY_ENV_FILE"
      SECRET=$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | base64 | tr -d '\n')
      (grep -v '^SESSION_SECRET=' "$DEPLOY_ENV_FILE" 2>/dev/null; echo "SESSION_SECRET=$SECRET") > "$DEPLOY_ENV_FILE.tmp" && mv "$DEPLOY_ENV_FILE.tmp" "$DEPLOY_ENV_FILE"
      echo "Готово. Заполни переменные в $DEPLOY_ENV_FILE и повтори деплой."
      exit 0
    fi
    echo "Нет $DEPLOY_ENV_FILE. Укажи существующий файл окружения деплоя."
    exit 1
  fi
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

if [ -n "$DEPLOY_MERGE_WITH" ]; then
  if [ ! -f "$DEPLOY_MERGE_WITH" ]; then
    echo "Ошибка: npm run deploy:test требует $DEPLOY_MERGE_WITH — полный файл как для прода (S3, ключи, TURN, New-Tel). Создай: cp deploy.env.example deploy.env и заполни."
    exit 1
  fi
  echo "=== База (секреты и ключи): $DEPLOY_MERGE_WITH ==="
  load_deploy_env_file "$DEPLOY_MERGE_WITH"
  echo "=== Тестовый слой (порты, домен, тестовая БД): $DEPLOY_ENV_FILE ==="
  load_deploy_env_file "$DEPLOY_ENV_FILE"
  DEPLOY_ENV_HINT="$DEPLOY_MERGE_WITH + $DEPLOY_ENV_FILE"
else
  echo "=== Читаю $DEPLOY_ENV_FILE ==="
  load_deploy_env_file "$DEPLOY_ENV_FILE"
  DEPLOY_ENV_HINT="$DEPLOY_ENV_FILE"
fi

# New-Tel: в .env часто пишут NEWTEL_* без подчёркивания NEW_TEL — подставляем в канонические имена для записи на VPS.
if [ -z "${NEW_TEL_AUTH_KEY:-}" ] && [ -n "${NEWTEL_AUTH_KEY:-}" ]; then NEW_TEL_AUTH_KEY="$NEWTEL_AUTH_KEY"; fi
if [ -z "${NEW_TEL_SIGN_KEY:-}" ] && [ -n "${NEWTEL_SIGN_KEY:-}" ]; then NEW_TEL_SIGN_KEY="$NEWTEL_SIGN_KEY"; fi
if [ -z "${NEW_TEL_CALL_PASSWORD_ENABLED:-}" ] && [ -n "${NEWTEL_CALL_PASSWORD_ENABLED:-}" ]; then
  NEW_TEL_CALL_PASSWORD_ENABLED="$NEWTEL_CALL_PASSWORD_ENABLED"
fi
if [ -z "${NEW_TEL_API_BASE:-}" ] && [ -n "${NEWTEL_BASE_URL:-}" ]; then NEW_TEL_API_BASE="$NEWTEL_BASE_URL"; fi
if [ -z "${NEW_TEL_API_BASE:-}" ] && [ -n "${NEWTEL_API_URL:-}" ]; then NEW_TEL_API_BASE="$NEWTEL_API_URL"; fi

need_var() {
  local name="$1"
  local val="${!name:-}"
  if [ -z "$val" ]; then
    echo "Ошибка: не задано $name (смотри $DEPLOY_ENV_HINT)"
    return 1
  fi
  return 0
}

echo "=== Проверка окружения деплоя ($DEPLOY_ENV_HINT) ==="
need_var VPS_HOST || exit 1
need_var VPS_USER || exit 1

if [ "${EDGE_PM2_ENABLED:-0}" = "1" ]; then
  need_var EDGE_DATABASE_URL || exit 1
  need_var EDGE_SERVICE_SECRET || exit 1
  need_var EDGE_UPSTREAM_URL || exit 1
fi

if [ "${PARSER_PM2_ENABLED:-0}" = "1" ]; then
  need_var PARSER_SERVICE_SECRET || exit 1
  need_var PARSER_UPSTREAM_URL || exit 1
  need_var PARSER_PLATFORM_URL || exit 1
fi

if [ "${PINGOK_MICRO_PM2_ENABLED:-1}" = "1" ]; then
  need_var PINGOK_MICRO_CORS_ORIGIN || exit 1
fi

if [ -n "${API_HUB_BRIDGE_URL:-}" ] || [ -n "${API_HUB_SERVICE_SECRET:-}" ]; then
  need_var API_HUB_SERVICE_SECRET || exit 1
fi

# Ни одна критичная переменная не должна быть пустой (отключить только для отладки: DEPLOY_SKIP_ENV_VERIFY=1).
# Урезанный режим (только БД+S3): DEPLOY_VERIFY_MINIMAL=1
# DEPLOY_CLOUD_OPTIONAL=1 — не требовать S3_* и FCM (медиа на диске сервера, пуши через FCM не настроены). См. deploy/S3-CLOUD-RU.md.
if [ -z "${DEPLOY_SKIP_ENV_VERIFY:-}" ]; then
  deploy_env_missing=()
  deploy_env_push() {
    local n="$1"
    local v="${!n:-}"
    v="${v//[[:space:]]/}"
    if [ -z "$v" ]; then
      deploy_env_missing+=("$n")
    fi
  }
  deploy_env_push DATABASE_URL
  if [ -z "${DEPLOY_CLOUD_OPTIONAL:-}" ] || [ "${DEPLOY_CLOUD_OPTIONAL:-}" = "0" ]; then
    deploy_env_push S3_ENDPOINT
    deploy_env_push S3_BUCKET
    deploy_env_push S3_REGION
    deploy_env_push S3_ACCESS_KEY
    deploy_env_push S3_SECRET_KEY
  else
    echo "=== DEPLOY_CLOUD_OPTIONAL=1: проверка S3_* пропущена (медиа без Object Storage — как в server/upload) ==="
  fi
  if [ -z "${DEPLOY_VERIFY_MINIMAL:-}" ]; then
    if [ -z "${DEPLOY_CLOUD_OPTIONAL:-}" ] || [ "${DEPLOY_CLOUD_OPTIONAL:-}" = "0" ]; then
      fcm_cfg_ok=""
      [ -n "${FCM_SERVER_KEY//[[:space:]]/}" ] && fcm_cfg_ok=1
      [ -n "${GOOGLE_APPLICATION_CREDENTIALS//[[:space:]]/}" ] && fcm_cfg_ok=1
      [ -n "${FCM_SERVICE_ACCOUNT_JSON//[[:space:]]/}" ] && fcm_cfg_ok=1
      [ -n "${FCM_SERVICE_ACCOUNT_B64//[[:space:]]/}" ] && fcm_cfg_ok=1
      if [ -z "$fcm_cfg_ok" ]; then
        deploy_env_missing+=("FCM_задай_FCM_SERVER_KEY_legacy_или_v1_GOOGLE_APPLICATION_CREDENTIALS_FCM_SERVICE_ACCOUNT_B64")
      fi
    else
      echo "=== DEPLOY_CLOUD_OPTIONAL=1: FCM не обязателен (пуши не шлются, пока не задашь ключ / service account в deploy.env) ==="
    fi
    deploy_env_push OPENROUTER_API_KEY
  fi
  # TURN обязателен и при DEPLOY_VERIFY_MINIMAL=1 — иначе бандл уходит только со STUN и «не соединяется» за NAT.
  if [ -z "${DEPLOY_ALLOW_NO_TURN:-}" ]; then
    if [ -z "${VITE_TURN_URLS:-}" ] && [ -z "${VITE_TURN_URL:-}" ]; then
      deploy_env_missing+=("VITE_TURN_URLS_или_VITE_TURN_URL")
    fi
    deploy_env_push VITE_TURN_USERNAME
    deploy_env_push VITE_TURN_CREDENTIAL
  else
    echo "=== DEPLOY_ALLOW_NO_TURN=1: VITE_TURN_* не проверяются (только LAN/отладка) ==="
  fi
  case "${NEW_TEL_CALL_PASSWORD_ENABLED:-}" in
    1|true|TRUE|True|yes|YES|on|ON)
      deploy_env_push NEW_TEL_AUTH_KEY
      deploy_env_push NEW_TEL_SIGN_KEY
      ;;
  esac
  if [ ${#deploy_env_missing[@]} -gt 0 ]; then
    echo "=== Ошибка: перед деплоем эти переменные не должны быть пустыми ==="
    printf '  - %s\n' "${deploy_env_missing[@]}"
    echo "Заполни в $DEPLOY_ENV_HINT (часто достаточно одного deploy.env)."
    echo "Только для отладки: DEPLOY_SKIP_ENV_VERIFY=1  |  урезанный: DEPLOY_VERIFY_MINIMAL=1 (TURN всё равно обязателен)  |  без TURN: DEPLOY_ALLOW_NO_TURN=1  |  без облака/FCM: DEPLOY_CLOUD_OPTIONAL=1"
    exit 1
  fi
fi

# VITE_* → export для `npm run build` (совместимо с bash 3.2).
if [ -n "$DEPLOY_MERGE_WITH" ]; then
  export_vite_from_deploy_files "$DEPLOY_MERGE_WITH" "$DEPLOY_ENV_FILE"
else
  export_vite_from_deploy_files "$DEPLOY_ENV_FILE"
fi
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
# tsx/vite в devDependencies. npm ci без NPM_CONFIG_PRODUCTION=false при NODE_ENV=production их не ставит → падает сборка.
# npm run build вызывает node --import tsx (не ищет бинарь tsx в PATH).
NPM_CONFIG_PRODUCTION=false npm ci --legacy-peer-deps 2>/dev/null || NPM_CONFIG_PRODUCTION=false npm install --legacy-peer-deps
# Для звонков/клиента: переменные VITE_* уже экспортированы выше.
# Веб-пуши FCM: VITE_FIREBASE_* задаются в deploy.env → попадают только в бандл (не в server .env). См. deploy.env.example.
if [ -n "${VITE_FIREBASE_VAPID_KEY:-}" ] && [ -z "${VITE_FIREBASE_API_KEY:-}" ]; then
  echo "=== Предупреждение: есть VITE_FIREBASE_VAPID_KEY, но нет VITE_FIREBASE_API_KEY (и остальных VITE_FIREBASE_*) — веб-пуш не заработает. Дополни $DEPLOY_ENV_HINT ==="
fi
if [ -n "${VITE_FIREBASE_API_KEY:-}" ] && [ -z "${VITE_FIREBASE_VAPID_KEY:-}" ]; then
  echo "=== Предупреждение: есть VITE_FIREBASE_API_KEY, но нет VITE_FIREBASE_VAPID_KEY — FCM getToken в браузере не сработает. Дополни $DEPLOY_ENV_HINT ==="
fi
# Звонки iOS/Android: TURN уже вшит из deploy.env; для IPA/APK после деплоя — npm run build:ios:prod / build:android:prod (тот же deploy.env).
echo "=== Клиент (звонки): TURN + таймауты/флаги из VITE_* → бандл сайта. Натив: явно задайте в deploy.env VITE_API_URL и VITE_WS_URL (https вашего домена), если не pingos.ru; см. блок «iOS / Android» в deploy.env.example ==="
npm run build

# Снимок dist: build делает rm -rf dist в начале; параллельная сборка во время rsync даёт ENOENT на файлах.
DEPLOY_DIST_STAGE=$(mktemp -d "${TMPDIR:-/tmp}/ping-moot-dist.XXXXXX")
trap 'rm -rf "$DEPLOY_DIST_STAGE"' EXIT
cp -a dist/. "$DEPLOY_DIST_STAGE/"
echo "=== Снимок dist для загрузки: $DEPLOY_DIST_STAGE ==="

echo "=== Загрузка на $SERVER_USER@$SERVER_HOST ==="
run_ssh "$SERVER_USER@$SERVER_HOST" "mkdir -p $REMOTE_DIR $REMOTE_DIR/dist"
# exclude dist + P dist: иначе --delete может снести удалённый dist, раз его нет в списке источника
run_rsync -avz --delete \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude '.env' \
  --exclude 'uploads' \
  --exclude 'android/.gradle' \
  --exclude 'android/build' \
  --exclude 'android/app/build' \
  --exclude 'build-artifacts' \
  --exclude 'dist' \
  --filter 'P uploads/' \
  --filter 'P dist/' \
  --filter 'P secrets/' \
  . "$SERVER_USER@$SERVER_HOST:$REMOTE_DIR/"
echo "=== Загрузка dist (снимок после сборки) ==="
run_rsync -avz --delete "$DEPLOY_DIST_STAGE/" "$SERVER_USER@$SERVER_HOST:$REMOTE_DIR/dist/"

# .env на сервере: единственный источник правды — deploy.env. Если в deploy.env задан DATABASE_URL,
# при каждом деплое перезаписываем .env на сервере, чтобы не править его вручную и не путаться.
if [ -f "$DEPLOY_ENV_FILE" ] && [ -n "${DATABASE_URL:-}" ]; then
  echo "=== Запись .env на сервер (итог переменных после чтения файлов) ==="
  # Если SESSION_SECRET не задан в deploy.env — берём текущий с сервера, иначе после каждого деплоя все сессии сбрасываются
  if [ -z "${SESSION_SECRET:-}" ]; then
    existing=$(run_ssh "$SERVER_USER@$SERVER_HOST" "grep -E '^SESSION_SECRET=' $REMOTE_DIR/.env 2>/dev/null | head -1" 2>/dev/null) || true
    if [ -n "$existing" ] && [ "${#existing}" -le 600 ]; then
      eval "$existing"
      echo "SESSION_SECRET сохранён с сервера — сессии не сбросятся после деплоя."
    fi
  fi
  if [ -z "${FFMPEG_PATH:-}" ]; then
    ff_existing=$(run_ssh "$SERVER_USER@$SERVER_HOST" "grep -E '^FFMPEG_PATH=' $REMOTE_DIR/.env 2>/dev/null | head -1" 2>/dev/null) || true
    if [ -n "$ff_existing" ] && [ "${#ff_existing}" -le 512 ]; then
      export FFMPEG_PATH="${ff_existing#FFMPEG_PATH=}"
      FFMPEG_PATH="${FFMPEG_PATH%\"}"
      FFMPEG_PATH="${FFMPEG_PATH#\"}"
      echo "FFMPEG_PATH сохранён с сервера (статический ffmpeg с HEIF)."
    fi
  fi
  build_server_env() {
    local f="$1"
    > "$f"
    # Ограничиваем длину значений, иначе sed/printf получают "Argument list too long"
    put() { local v="${1:0:4000}"; local k="$2"; if [ -n "$v" ]; then echo -n "${k}=\"" >> "$f"; printf '%s' "$v" | sed 's/["\\]/\\&/g' >> "$f"; echo '"' >> "$f"; fi; true; }
    put "${PORT:-3080}" "PORT"
    put "$BUILD_VERSION" "BUILD_VERSION"
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
    put "$GOOGLE_APPLICATION_CREDENTIALS" "GOOGLE_APPLICATION_CREDENTIALS"
    put "$FCM_SERVICE_ACCOUNT_JSON" "FCM_SERVICE_ACCOUNT_JSON"
    put "$FCM_SERVICE_ACCOUNT_B64" "FCM_SERVICE_ACCOUNT_B64"
    # iOS CallKit: VoIP push через APNs (тот же .p8, что для Firebase APNs; topic = bundleId.voip). Задаётся в deploy.env → .env на VPS.
    put "$APNS_VOIP_KEY_PATH" "APNS_VOIP_KEY_PATH"
    put "$APNS_VOIP_KEY_P8" "APNS_VOIP_KEY_P8"
    put "$APNS_VOIP_KEY_ID" "APNS_VOIP_KEY_ID"
    put "$APNS_TEAM_ID" "APNS_TEAM_ID"
    put "$IOS_APP_BUNDLE_ID" "IOS_APP_BUNDLE_ID"
    put "$APNS_VOIP_USE_SANDBOX" "APNS_VOIP_USE_SANDBOX"
    put "$OPENROUTER_API_KEY" "OPENROUTER_API_KEY"
    put "$OPENROUTER_MODEL" "OPENROUTER_MODEL"
    put "$CALLS_DEBUG" "CALLS_DEBUG"
    put "$CALLS_DISCONNECT_GRACE_MS" "CALLS_DISCONNECT_GRACE_MS"
    put "$GROUP_CALLS_ENABLED" "GROUP_CALLS_ENABLED"
    put "$GROUP_CALLS_SERVER_ASR_ENABLED" "GROUP_CALLS_SERVER_ASR_ENABLED"
    put "${CALL_TRANSCRIPTS_ASR_URL:-http://127.0.0.1:8099/transcribe}" "CALL_TRANSCRIPTS_ASR_URL"
    put "$CALL_TRANSCRIPTS_ASR_WS_URL" "CALL_TRANSCRIPTS_ASR_WS_URL"
    put "$CALL_TRANSCRIPTS_ASR_API_KEY" "CALL_TRANSCRIPTS_ASR_API_KEY"
    put "$VOSK_ASR_ENABLED" "VOSK_ASR_ENABLED"
    put "$CALLS_RING_TIMEOUT_MS" "CALLS_RING_TIMEOUT_MS"
    put "$CALLS_CALLER_WAIT_MS" "CALLS_CALLER_WAIT_MS"
    put "$CALLS_PENDING_TTL_MS" "CALLS_PENDING_TTL_MS"
    put "$CALLS_SINGLE_SOCKET_PER_USER" "CALLS_SINGLE_SOCKET_PER_USER"
    put "$CALLS_WS_HEARTBEAT_MS" "CALLS_WS_HEARTBEAT_MS"
    put "$S3_ENDPOINT" "S3_ENDPOINT"
    put "$S3_BUCKET" "S3_BUCKET"
    put "$S3_REGION" "S3_REGION"
    put "$S3_ACCESS_KEY" "S3_ACCESS_KEY"
    put "$S3_SECRET_KEY" "S3_SECRET_KEY"
    put "$S3_PUBLIC_ACL" "S3_PUBLIC_ACL"
    put "$S3_USE_MINIO_CLIENT" "S3_USE_MINIO_CLIENT"
    put "$S3_SDK_TO_MINIO_FALLBACK" "S3_SDK_TO_MINIO_FALLBACK"
    put "$S3_MINIO_PATH_STYLE" "S3_MINIO_PATH_STYLE"
    put "$S3_PUT_MAX_RETRIES" "S3_PUT_MAX_RETRIES"
    put "$S3_PUT_RETRY_BASE_MS" "S3_PUT_RETRY_BASE_MS"
    # ПИНГОК МИКРО — отдельный PM2-процесс (dist/pingok-micro.cjs). CORS: домен SPA, через запятую.
    put "${PINGOK_MICRO_PORT:-3091}" "PINGOK_MICRO_PORT"
    put "$PINGOK_MICRO_CORS_ORIGIN" "PINGOK_MICRO_CORS_ORIGIN"
    put "$PINGOK_MICRO_PARSE_PER_MIN" "PINGOK_MICRO_PARSE_PER_MIN"
    put "$PINGOK_MICRO_PM2_ENABLED" "PINGOK_MICRO_PM2_ENABLED"
    put "$PINGOK_PM2_NAME" "PINGOK_PM2_NAME"
    # EDGE микросервис (опционально): прокси с платформы + отдельный PM2 при EDGE_PM2_ENABLED=1
    put "${EDGE_UPSTREAM_URL:-}" "EDGE_UPSTREAM_URL"
    put "$EDGE_URL" "EDGE_URL"
    put "$EDGE_SERVICE_SECRET" "EDGE_SERVICE_SECRET"
    put "${EDGE_PROXY_TIMEOUT_MS:-2500}" "EDGE_PROXY_TIMEOUT_MS"
    put "${EDGE_PORT:-3092}" "EDGE_PORT"
    put "$EDGE_BIND" "EDGE_BIND"
    put "$EDGE_PM2_ENABLED" "EDGE_PM2_ENABLED"
    put "$EDGE_PM2_NAME" "EDGE_PM2_NAME"
    put "$EDGE_DATABASE_URL" "EDGE_DATABASE_URL"
    put "$EDGE_PG_POOL_MAX" "EDGE_PG_POOL_MAX"
    put "$EDGE_PRIZE_NOTIFY_USER_ID" "EDGE_PRIZE_NOTIFY_USER_ID"
    # Сессия и БД (часто забывали при деплое из deploy.env)
    put "$SESSION_SAME_SITE" "SESSION_SAME_SITE"
    put "$SESSION_MAX_AGE_DAYS" "SESSION_MAX_AGE_DAYS"
    put "$SESSION_COOKIE_DOMAIN" "SESSION_COOKIE_DOMAIN"
    # CORS / CSRF / подпись upload URL (см. server/index.ts, csrf-protection-middleware, upload-access-signature)
    put "$CORS_ALLOWED_ORIGINS" "CORS_ALLOWED_ORIGINS"
    put "$CORS_REFLECT_ORIGIN_COMPAT" "CORS_REFLECT_ORIGIN_COMPAT"
    put "$CSRF_ALLOWED_ORIGINS" "CSRF_ALLOWED_ORIGINS"
    put "$CSRF_ENFORCE" "CSRF_ENFORCE"
    put "$UPLOAD_ACCESS_SECRET" "UPLOAD_ACCESS_SECRET"
    put "$UPLOADS_CHAT_PRIVATE_ENFORCE" "UPLOADS_CHAT_PRIVATE_ENFORCE"
    put "$UPLOADS_VOICE_PRIVATE_ENFORCE" "UPLOADS_VOICE_PRIVATE_ENFORCE"
    put "$SECURITY_AUDIT_DISABLED" "SECURITY_AUDIT_DISABLED"
    put "$PHONE_AT_REST_SECRET" "PHONE_AT_REST_SECRET"
    put "$PG_POOL_MAX" "PG_POOL_MAX"
    put "$AUTH_TOKEN_SECRET" "AUTH_TOKEN_SECRET"
    put "$BUSINESS_CHAT_MASTER_KEY" "BUSINESS_CHAT_MASTER_KEY"
    put "$PING_INVITE_APP_URL" "PING_INVITE_APP_URL"
    # New-Tel CallPassword (регистрация: подтверждение звонком). Задаётся в deploy.env → уезжает в .env на VPS.
    put "$NEW_TEL_CALL_PASSWORD_ENABLED" "NEW_TEL_CALL_PASSWORD_ENABLED"
    put "$NEW_TEL_AUTH_KEY" "NEW_TEL_AUTH_KEY"
    put "$NEW_TEL_SIGN_KEY" "NEW_TEL_SIGN_KEY"
    put "$NEW_TEL_API_BASE" "NEW_TEL_API_BASE"
    # Legacy: на сервер может уехать, код не читает — режим звонка только из админки (platform_settings).
    put "$REGISTER_REQUIRE_PHONE_CALL_VERIFICATION" "REGISTER_REQUIRE_PHONE_CALL_VERIFICATION"
    # OpenRouter / перевод
    put "$OPENROUTER_TRANSLATE_MODEL" "OPENROUTER_TRANSLATE_MODEL"
    put "$TRANSLATE_DEBUG" "TRANSLATE_DEBUG"
    # AI Search
    put "$AI_SEARCH_ENABLED" "AI_SEARCH_ENABLED"
    put "$AI_SEARCH_HOT_TTL_HOURS" "AI_SEARCH_HOT_TTL_HOURS"
    put "$AI_SEARCH_HOT_L1_MS" "AI_SEARCH_HOT_L1_MS"
    # Лента (основной процесс + feed-worker читает то же .env через dotenv в ecosystem)
    put "$FEED_ALGO_MODE" "FEED_ALGO_MODE"
    put "$FEED_BOOST_WINDOW_HOURS" "FEED_BOOST_WINDOW_HOURS"
    put "$FEED_BOOST_CAP_MINUTES" "FEED_BOOST_CAP_MINUTES"
    put "$FEED_REACTION_BOOST_MINUTES" "FEED_REACTION_BOOST_MINUTES"
    put "$FEED_COMMENT_BOOST_MINUTES" "FEED_COMMENT_BOOST_MINUTES"
    put "$FEED_SHARE_BOOST_MINUTES" "FEED_SHARE_BOOST_MINUTES"
    put "$FEED_ANTISPAM_VERY_NEW_HOURS" "FEED_ANTISPAM_VERY_NEW_HOURS"
    put "$FEED_ANTISPAM_NEW_HOURS" "FEED_ANTISPAM_NEW_HOURS"
    put "$FEED_ANTISPAM_VERY_NEW_FACTOR" "FEED_ANTISPAM_VERY_NEW_FACTOR"
    put "$FEED_ANTISPAM_NEW_FACTOR" "FEED_ANTISPAM_NEW_FACTOR"
    put "$FEED_RANKING_CANDIDATE_PADDING" "FEED_RANKING_CANDIDATE_PADDING"
    put "$FEED_RANKING_CANDIDATE_MIN" "FEED_RANKING_CANDIDATE_MIN"
    put "$FEED_RANKING_CANDIDATE_MAX" "FEED_RANKING_CANDIDATE_MAX"
    put "$FEED_SNAPSHOT_READ_ENABLED" "FEED_SNAPSHOT_READ_ENABLED"
    put "$FEED_SNAPSHOT_MAX_AGE_SEC" "FEED_SNAPSHOT_MAX_AGE_SEC"
    put "$FEED_WORKER_INTERVAL_SEC" "FEED_WORKER_INTERVAL_SEC"
    put "$FEED_WORKER_PM2_ENABLED" "FEED_WORKER_PM2_ENABLED"
    put "$FEED_WORKER_PM2_NAME" "FEED_WORKER_PM2_NAME"
    put "$FEED_WORKER_ONCE" "FEED_WORKER_ONCE"
    # Голос в чате → ASR (тот же URL, что для титров групповых звонков)
    put "$VOICE_MESSAGE_ASR_LANGUAGE" "VOICE_MESSAGE_ASR_LANGUAGE"
    # Админка «Диск»
    put "$DISK_STATFS_PATH" "DISK_STATFS_PATH"
    put "$DISK_PROJECT_PATH" "DISK_PROJECT_PATH"
    put "$DISK_PROJECT_DU_TIMEOUT_MS" "DISK_PROJECT_DU_TIMEOUT_MS"
    # Фоновый контент-ингест (опционально)
    put "$ADMIN_CONTENT_SOURCE_URL" "ADMIN_CONTENT_SOURCE_URL"
    put "$ADMIN_CONTENT_AUTHOR_USER_ID" "ADMIN_CONTENT_AUTHOR_USER_ID"
    put "$ADMIN_CONTENT_INTERVAL_MINUTES" "ADMIN_CONTENT_INTERVAL_MINUTES"
    put "$ADMIN_CONTENT_POSTS_PER_RUN" "ADMIN_CONTENT_POSTS_PER_RUN"
    # Платформа → PARSER (прокси админки + internal publish)
    put "$PARSER_UPSTREAM_URL" "PARSER_UPSTREAM_URL"
    put "$PARSER_PROXY_TIMEOUT_MS" "PARSER_PROXY_TIMEOUT_MS"
    put "$PARSER_SERVICE_SECRET" "PARSER_SERVICE_SECRET"
    # Процесс parser (PM2 читает .env через ecosystem; при включении PARSER_PM2_ENABLED)
    put "$PARSER_PLATFORM_URL" "PARSER_PLATFORM_URL"
    put "$PLATFORM_PORT" "PLATFORM_PORT"
    put "$PARSER_PORT" "PARSER_PORT"
    put "$PARSER_BIND" "PARSER_BIND"
    put "$PARSER_DATABASE_URL" "PARSER_DATABASE_URL"
    put "$PARSER_PG_POOL_MAX" "PARSER_PG_POOL_MAX"
    put "$VK_PARSER_TOKEN_KEY" "VK_PARSER_TOKEN_KEY"
    put "$PARSER_PM2_ENABLED" "PARSER_PM2_ENABLED"
    put "$PARSER_PM2_NAME" "PARSER_PM2_NAME"
    # API HUB bridge / internal bearer issue
    put "$API_HUB_SERVICE_SECRET" "API_HUB_SERVICE_SECRET"
    put "$API_HUB_BRIDGE_URL" "API_HUB_BRIDGE_URL"
    put "$API_HUB_BRIDGE_SECRET" "API_HUB_BRIDGE_SECRET"
    put "$API_HUB_BRIDGE_MAX_ATTEMPTS" "API_HUB_BRIDGE_MAX_ATTEMPTS"
    put "$API_HUB_BRIDGE_RETRY_BASE_MS" "API_HUB_BRIDGE_RETRY_BASE_MS"
    put "$API_HUB_BRIDGE_TIMEOUT_MS" "API_HUB_BRIDGE_TIMEOUT_MS"
    put "$FFMPEG_PATH" "FFMPEG_PATH"
    put "$FFMPEG_BIN" "FFMPEG_BIN"
  }
  ENV_TMP="/tmp/ping-moot-deploy-$$.env"
  trap "rm -f $ENV_TMP" EXIT
  build_server_env "$ENV_TMP"
  run_scp() { if [ -n "$SSHPASS" ]; then sshpass -e scp -o StrictHostKeyChecking=accept-new "$@"; else scp "$@"; fi; }
  run_scp "$ENV_TMP" "$SERVER_USER@$SERVER_HOST:$REMOTE_DIR/.env" || { echo "Ошибка записи .env"; exit 1; }
else
  if [ -f "$DEPLOY_ENV_FILE" ] && [ -z "${DATABASE_URL:-}" ]; then
    echo "=== Нет DATABASE_URL в итоге ($DEPLOY_ENV_HINT) — .env на сервере не трогаем. Укажи DATABASE_URL (в deploy.test.env для теста или в deploy.env). ==="
  else
    echo "=== deploy.env отсутствует или пуст — .env на сервере не трогаем ==="
  fi
fi

# На сервере в .env хост должен быть localhost: правим base -> localhost в файле до установки
run_ssh "$SERVER_USER@$SERVER_HOST" "test -f $REMOTE_DIR/.env && sed -i.bak -e 's/@base/@localhost/g' -e 's/:base:5432/:localhost:5432/g' $REMOTE_DIR/.env && echo 'OK: .env (base->localhost)' || true"

echo "=== Установка зависимостей, миграции, рестарт на сервере ==="
PM2_APP_NAME_ESC="${PM2_APP_NAME:-ping-moot}"
run_ssh "$SERVER_USER@$SERVER_HOST" "cd $REMOTE_DIR && PORT=$REMOTE_PORT PM2_APP_NAME=\"$PM2_APP_NAME_ESC\" bash scripts/server-setup.sh" || { echo "Ошибка на сервере"; exit 1; }

# deploy:test (DEPLOY_MERGE_WITH): иначе pingdepo.ru мог остаться на старом upstream → API/БД не те, «нет таблицы» в админке.
if [ -n "$DEPLOY_MERGE_WITH" ] && [ -f scripts/setup-nginx-pingdepo-on-server.sh ]; then
  echo "=== nginx: pingdepo.ru → тест (скрипт из репо; upstream в deploy/nginx-pingdepo.conf должен совпадать с PORT=$REMOTE_PORT) ==="
  if run_ssh "$SERVER_USER@$SERVER_HOST" "cd $REMOTE_DIR && test -f scripts/setup-nginx-pingdepo-on-server.sh && sudo bash scripts/setup-nginx-pingdepo-on-server.sh"; then
    echo "OK: nginx sites-enabled/pingdepo.ru обновлён и перезагружен."
  else
    echo "Предупреждение: nginx не обновлён (нет sudo, другой сервер или нет deploy/nginx-pingdepo.conf после rsync). На VPS: cd $REMOTE_DIR && sudo bash scripts/setup-nginx-pingdepo-on-server.sh"
  fi
fi

echo "=== Проверка сервисов на сервере ==="
if ! run_ssh "$SERVER_USER@$SERVER_HOST" "REMOTE_DIR='$REMOTE_DIR' PM2_APP_NAME_ESC='$PM2_APP_NAME_ESC' bash -s" <<'EOF'
set -e
cd "$REMOTE_DIR"
read_env() {
  key="$1"
  line=$(grep -E "^${key}=" .env 2>/dev/null | tail -1 || true)
  line="${line#${key}=}"
  line="${line%\"}"
  line="${line#\"}"
  printf "%s" "$line"
}

main_name="${PM2_APP_NAME_ESC:-ping-moot}"
pm2 describe "$main_name" >/dev/null 2>&1

edge_enabled=$(read_env EDGE_PM2_ENABLED)
edge_name=$(read_env EDGE_PM2_NAME); [ -z "$edge_name" ] && edge_name="ping-moot-edge"
edge_port=$(read_env EDGE_PORT); [ -z "$edge_port" ] && edge_port="3092"
if [ "$edge_enabled" = "1" ]; then
  pm2 describe "$edge_name" >/dev/null 2>&1
  curl -fsS --max-time 5 "http://127.0.0.1:${edge_port}/v1/health" >/dev/null
fi

parser_enabled=$(read_env PARSER_PM2_ENABLED)
parser_name=$(read_env PARSER_PM2_NAME); [ -z "$parser_name" ] && parser_name="ping-moot-parser"
parser_port=$(read_env PARSER_PORT); [ -z "$parser_port" ] && parser_port="3093"
if [ "$parser_enabled" = "1" ]; then
  pm2 describe "$parser_name" >/dev/null 2>&1
  curl -fsS --max-time 5 "http://127.0.0.1:${parser_port}/v1/health" >/dev/null
fi

pingok_enabled=$(read_env PINGOK_MICRO_PM2_ENABLED)
pingok_name=$(read_env PINGOK_PM2_NAME); [ -z "$pingok_name" ] && pingok_name="pingok-micro"
pingok_port=$(read_env PINGOK_MICRO_PORT); [ -z "$pingok_port" ] && pingok_port="3091"
if [ "$pingok_enabled" != "0" ]; then
  pm2 describe "$pingok_name" >/dev/null 2>&1
  curl -fsS --max-time 5 "http://127.0.0.1:${pingok_port}/health" >/dev/null
fi

feed_enabled=$(read_env FEED_WORKER_PM2_ENABLED)
feed_name=$(read_env FEED_WORKER_PM2_NAME); [ -z "$feed_name" ] && feed_name="ping-moot-feed-worker"
if [ "$feed_enabled" = "1" ]; then
  pm2 describe "$feed_name" >/dev/null 2>&1
fi
EOF
then
  echo "Проверка сервисов не пройдена. См. pm2 logs на сервере."
  exit 1
fi
echo "OK: сервисы на сервере прошли проверку."
