#!/usr/bin/env bash
# Проверки перед деплоем. Вызывается из deploy.sh после source deploy.env.
# Не блокирует деплой, только предупреждает. Правила: docs/DEPLOY_RULES.md

[ -n "$DEPLOY_SKIP_PRE_CHECK" ] && return 0

if [ -z "$DATABASE_URL" ] || [ "$DATABASE_URL" = "postgresql://ping_moot:@localhost:5432/ping_moot" ]; then
  echo "[pre-deploy] В deploy.env нет DATABASE_URL — приложение будет без БД (логины не сохранятся). Скрипт попытается восстановить URL с сервера."
fi

if [ -z "$SESSION_SECRET" ]; then
  echo "[pre-deploy] SESSION_SECRET пустой — при деплое будет сгенерирован."
fi

# TURN вшивается в клиент на этапе Vite-сборки: переменные должны быть в deploy.env и экспортироваться как VITE_*.
if [ -z "${VITE_TURN_URLS:-}" ] && [ -z "${VITE_TURN_URL:-}" ]; then
  echo "[pre-deploy] Нет VITE_TURN_URLS / VITE_TURN_URL — в проде звонки только через STUN; за жёстким NAT часто нужен TURN (см. docs/CALLS_TURN_SETUP.md, deploy.env.example)."
fi
if [ -n "${VITE_TURN_URLS:-}${VITE_TURN_URL:-}" ]; then
  u="${VITE_TURN_USERNAME:-}"
  p="${VITE_TURN_CREDENTIAL:-}"
  urls_csv="${VITE_TURN_URLS:-${VITE_TURN_URL:-}}"
  if { [ -n "$u" ] && [ -z "$p" ]; } || { [ -z "$u" ] && [ -n "$p" ]; }; then
    echo "[pre-deploy] TURN: задан только один из VITE_TURN_USERNAME / VITE_TURN_CREDENTIAL — для lt-cred-mech нужны оба; иначе клиент не передаст креды (см. call-ice-config.ts)."
  fi
  case "$urls_csv" in
    *transport=udp*) has_turn_udp=1 ;;
    *) has_turn_udp=0 ;;
  esac
  case "$urls_csv" in
    *transport=tcp*) has_turn_tcp=1 ;;
    *) has_turn_tcp=0 ;;
  esac
  case "$urls_csv" in
    *turns:*) has_turn_tls=1 ;;
    *) has_turn_tls=0 ;;
  esac
  if [ "$has_turn_udp" -ne 1 ] || [ "$has_turn_tcp" -ne 1 ] || [ "$has_turn_tls" -ne 1 ]; then
    echo "[pre-deploy] TURN topology выглядит неполной: желательно включить udp + tcp + turns (TLS, обычно 443) в VITE_TURN_URLS для LTE/VPN."
  fi

  turn_hosts_count="$(
    printf "%s" "$urls_csv" \
      | tr ',' '\n' \
      | sed -E 's#^[[:space:]]*turns?://?##; s#^[[:space:]]*turns?:##; s#\?.*$##; s#:[0-9]+$##; s#[[:space:]]##g' \
      | awk 'NF { print tolower($0) }' \
      | sort -u \
      | awk 'END { print NR+0 }'
  )"
  if [ "${turn_hosts_count:-0}" -lt 2 ]; then
    echo "[pre-deploy] TURN: найден один host. Для межрегиональной стабильности рекомендуется 2+ TURN endpoint (разные регионы)."
  fi
fi

# iOS/Android (Capacitor): в бандл сайта TURN попадает при npm run deploy; в IPA/APK — отдельно: npm run build:ios:prod / build:android:prod (тот же deploy.env).
if [ -z "${VITE_API_URL//[[:space:]]/}" ] && [ -z "${VITE_WS_URL//[[:space:]]/}" ] && [ -z "${VITE_SITE_ORIGIN//[[:space:]]/}" ]; then
  echo "[pre-deploy] Звонки в приложении: в deploy.env нет VITE_API_URL / VITE_WS_URL / VITE_SITE_ORIGIN — веб при одном домене ок; capacitor-build-prod-client.sh подставит https://pingos.ru. Другой домен: задайте явно (как публичный https сайта)."
fi
if [ -n "${VITE_API_URL//[[:space:]]/}" ] && [ -n "${VITE_WS_URL//[[:space:]]/}" ]; then
  case "${VITE_API_URL}${VITE_WS_URL}" in
    *http://*) echo "[pre-deploy] VITE_API_URL/VITE_WS_URL с http:// — для звонков в iOS лучше https:// (WKWebView / mixed content)." ;;
  esac
fi

if [ "${GROUP_CALLS_SERVER_ASR_ENABLED:-}" = "1" ]; then
  if [ -z "${CALL_TRANSCRIPTS_ASR_URL:-}" ]; then
    echo "[pre-deploy] GROUP_CALLS_SERVER_ASR_ENABLED=1, но нет CALL_TRANSCRIPTS_ASR_URL — server-setup подставит локальный http://127.0.0.1:8099/transcribe"
  fi
  if [ -z "${CALL_TRANSCRIPTS_ASR_WS_URL:-}" ]; then
    echo "[pre-deploy] GROUP_CALLS_SERVER_ASR_ENABLED=1, но нет CALL_TRANSCRIPTS_ASR_WS_URL — server-setup подставит ws://127.0.0.1:8100/stream"
  fi
fi

return 0
