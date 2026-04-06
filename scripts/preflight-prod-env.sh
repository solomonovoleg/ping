#!/usr/bin/env bash
# Проверка deploy.env перед npm run deploy (те же правила, что deploy.sh).
# Запуск: bash scripts/preflight-prod-env.sh
#        DEPLOY_ENV_FILE=deploy.staging.env bash scripts/preflight-prod-env.sh
set -euo pipefail
cd "$(dirname "$0")/.."
ENV_FILE="${DEPLOY_ENV_FILE:-deploy.env}"
if [ ! -f "$ENV_FILE" ]; then
  echo "Нет файла $ENV_FILE"
  exit 1
fi
while IFS= read -r line || [ -n "$line" ]; do
  [[ "$line" =~ ^[[:space:]]*# ]] && continue
  [[ -z "${line//[[:space:]]/}" ]] && continue
  line="${line#export }"
  [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]] && eval "$line"
done < "$ENV_FILE"

missing=()
add() {
  local n="$1"
  local v="${!n:-}"
  v="${v//[[:space:]]/}"
  if [ -z "$v" ]; then missing+=("$n"); fi
}

echo "=== Preflight: $ENV_FILE ==="
add VPS_HOST
add VPS_USER
add DATABASE_URL
if [ -z "${DEPLOY_CLOUD_OPTIONAL:-}" ] || [ "${DEPLOY_CLOUD_OPTIONAL:-}" = "0" ]; then
  add S3_ENDPOINT
  add S3_BUCKET
  add S3_REGION
  add S3_ACCESS_KEY
  add S3_SECRET_KEY
  fcm_cfg_ok=""
  [ -n "${FCM_SERVER_KEY//[[:space:]]/}" ] && fcm_cfg_ok=1
  [ -n "${GOOGLE_APPLICATION_CREDENTIALS//[[:space:]]/}" ] && fcm_cfg_ok=1
  [ -n "${FCM_SERVICE_ACCOUNT_JSON//[[:space:]]/}" ] && fcm_cfg_ok=1
  [ -n "${FCM_SERVICE_ACCOUNT_B64//[[:space:]]/}" ] && fcm_cfg_ok=1
  if [ -z "$fcm_cfg_ok" ]; then
    missing+=("FCM_SERVER_KEY_или_GOOGLE_APPLICATION_CREDENTIALS_или_FCM_SERVICE_ACCOUNT_B64")
  fi
else
  echo "(DEPLOY_CLOUD_OPTIONAL=1: S3 и FCM не проверяются)"
fi
add OPENROUTER_API_KEY
if [ -z "${VITE_TURN_URLS:-}" ] && [ -z "${VITE_TURN_URL:-}" ]; then
  missing+=("VITE_TURN_URLS_или_VITE_TURN_URL")
fi
add VITE_TURN_USERNAME
add VITE_TURN_CREDENTIAL

case "${NEW_TEL_CALL_PASSWORD_ENABLED:-}" in
  1|true|TRUE|yes|on|ON)
    add NEW_TEL_AUTH_KEY
    add NEW_TEL_SIGN_KEY
    ;;
esac

if [ "${EDGE_PM2_ENABLED:-0}" = "1" ]; then
  add EDGE_DATABASE_URL
  add EDGE_SERVICE_SECRET
  add EDGE_UPSTREAM_URL
fi
if [ "${PARSER_PM2_ENABLED:-0}" = "1" ]; then
  add PARSER_SERVICE_SECRET
  add PARSER_UPSTREAM_URL
  add PARSER_PLATFORM_URL
fi
if [ "${PINGOK_MICRO_PM2_ENABLED:-1}" != "0" ]; then
  add PINGOK_MICRO_CORS_ORIGIN
fi

# Не смешивать тест и прод
db="${DATABASE_URL:-}"
if echo "$db" | grep -qiE 'ping_moot_test|_test@|/ping_moot_test'; then
  echo "ОШИБКА: DATABASE_URL похож на ТЕСТОВУЮ БД. Для прода должен быть ping_moot (или отдельный прод-инстанс), не ping_moot_test."
  exit 2
fi

if [ ${#missing[@]} -gt 0 ]; then
  echo "Не хватает переменных (заполни в $ENV_FILE):"
  printf '  - %s\n' "${missing[@]}"
  exit 1
fi

echo "OK: обязательные переменные для npm run deploy заданы."
echo "Проверь вручную: VPS_PATH/PORT/PM2_APP_NAME, CORS/CSRF для домена, EDGE/PARSER порты не конфликтуют."
exit 0
