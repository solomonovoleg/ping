#!/usr/bin/env bash
# Проверка deploy.env для звонков (WebRTC/TURN) и prod-сборки iOS/Android.
# Секреты не печатаются — только «задано» / «пусто» и вычисленные публичные URL.
#
#   npm run check:ios-calls-env
#   DEPLOY_ENV_FILE=deploy.test.env npm run check:ios-calls-env
set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE="${DEPLOY_ENV_FILE:-deploy.env}"
if [ ! -f "$ENV_FILE" ]; then
  echo "Нет файла $ENV_FILE — создай из deploy.env.example и заполни."
  exit 1
fi

while IFS= read -r line || [ -n "$line" ]; do
  [[ "$line" =~ ^[[:space:]]*# ]] && continue
  [[ -z "${line//[[:space:]]/}" ]] && continue
  line="${line#export }"
  [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]] && eval "$line"
done < "$ENV_FILE"

ok() { echo "  ✓ $1"; }
bad() { echo "  ✗ $1"; }
warn() { echo "  ! $1"; }

nonempty() {
  local v="${!1:-}"
  v="${v//[[:space:]]/}"
  [ -n "$v" ]
}

echo "=== Звонки + нативное приложение: $ENV_FILE ==="
echo ""

echo "TURN (обязателен для prod-деплоя и для нормальной работы за NAT/LTE)"
issues=0
if nonempty VITE_TURN_URLS || nonempty VITE_TURN_URL; then
  ok "VITE_TURN_URLS или VITE_TURN_URL задан"
else
  bad "Нет VITE_TURN_URLS и VITE_TURN_URL — в бандле только STUN, звонки часто не поднимаются"
  issues=$((issues + 1))
fi
if nonempty VITE_TURN_USERNAME && nonempty VITE_TURN_CREDENTIAL; then
  ok "VITE_TURN_USERNAME и VITE_TURN_CREDENTIAL заданы (значения скрыты)"
elif ! nonempty VITE_TURN_USERNAME && ! nonempty VITE_TURN_CREDENTIAL; then
  warn "Оба TURN-логина пусты — при наличии URL клиент может не передать lt-cred"
else
  bad "Задан только один из VITE_TURN_USERNAME / VITE_TURN_CREDENTIAL — нужны оба"
  issues=$((issues + 1))
fi
echo ""

echo "API и WebSocket (Capacitor: npm run build:ios:prod / build:android:prod)"
DEFAULT_ORIGIN="https://pingos.ru"
ORIGIN=""
for key in VITE_API_URL VITE_WS_URL VITE_SITE_ORIGIN; do
  v="${!key:-}"
  v="${v//[[:space:]]/}"
  if [ -n "$v" ]; then
    ORIGIN="${!key}"
    ORIGIN="${ORIGIN%/}"
    break
  fi
done
ORIGIN="${ORIGIN:-$DEFAULT_ORIGIN}"

if nonempty VITE_API_URL; then ok "VITE_API_URL задан"; else warn "VITE_API_URL пуст — в prod-native подставится хост: $ORIGIN (см. capacitor-build-prod-client.sh)"; fi
if nonempty VITE_WS_URL; then ok "VITE_WS_URL задан"; else warn "VITE_WS_URL пуст — подставится: $ORIGIN"; fi
if nonempty VITE_SITE_ORIGIN; then ok "VITE_SITE_ORIGIN задан"; else warn "VITE_SITE_ORIGIN пуст (не обязательно, если заданы API/WS)"; fi

case "${VITE_API_URL:-}${VITE_WS_URL:-}" in
  *http://*) warn "Есть http:// в API/WS — для iOS предпочтительно https://";;
esac

echo ""
echo "  → Как в scripts/capacitor-build-prod-client.sh: API=${VITE_API_URL:-$ORIGIN}  WS=${VITE_WS_URL:-$ORIGIN}"
echo ""

echo "Пуши входящего звонка (FCM + APNs) — отдельно от WebRTC"
if nonempty VITE_FIREBASE_API_KEY; then ok "VITE_FIREBASE_API_KEY задан (веб/часть клиента)"; else warn "VITE_FIREBASE_* пусты — веб-пуш с сайта может быть выключен"; fi
echo "  В Xcode нужен GoogleService-Info.plist и ключ APNs в Firebase — скрипт это не проверяет."
echo ""
echo "iOS CallKit (VoIP push на API-сервер)"
echo "  Системный экран входящего: миграция migrations/0051_users_ios_voip_token.sql + в **.env процесса Node API** (не обязательно в этом файле):"
echo "    APNS_VOIP_KEY_PATH или APNS_VOIP_KEY_P8, APNS_VOIP_KEY_ID, APNS_TEAM_ID, IOS_APP_BUNDLE_ID; dev: APNS_VOIP_USE_SANDBOX=1"
echo "  Подробности: корневой .env.example (блок «iOS CallKit / VoIP»)."
if nonempty APNS_VOIP_KEY_ID || nonempty APNS_TEAM_ID || nonempty APNS_VOIP_KEY_PATH || nonempty APNS_VOIP_KEY_P8; then
  if nonempty APNS_VOIP_KEY_ID && nonempty APNS_TEAM_ID && { nonempty APNS_VOIP_KEY_PATH || nonempty APNS_VOIP_KEY_P8; }; then
    ok "В $ENV_FILE заданы APNS VoIP переменные (сервер сможет слать voip)"
  else
    warn "В $ENV_FILE APNS VoIP задан частично — нужны APNS_VOIP_KEY_ID, APNS_TEAM_ID и APNS_VOIP_KEY_PATH или APNS_VOIP_KEY_P8"
  fi
else
  warn "APNS VoIP в $ENV_FILE не задан — если ключи только в .env на VPS, это нормально; иначе CallKit не получит push"
fi
echo ""

echo "Что сделать руками"
echo "  1) Если выше есть ✗ — поправь $ENV_FILE"
echo "  2) Сайт: npm run deploy (или deploy:preflight для полной проверки деплоя)"
echo "  3) iOS: npm run build:ios:prod с тем же deploy.env — иначе в IPA может быть старый TURN/хост"
echo ""

if [ "$issues" -gt 0 ]; then
  echo "Итог: не готово — исправь пункты с ✗"
  exit 1
fi
echo "Итог: для звонков из deploy.env минимум для TURN выглядит ок. Установленное на телефоне приложение скрипт не видит — пересобери IPA после смены env."
exit 0
