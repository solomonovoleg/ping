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
  if { [ -n "$u" ] && [ -z "$p" ]; } || { [ -z "$u" ] && [ -n "$p" ]; }; then
    echo "[pre-deploy] TURN: задан только один из VITE_TURN_USERNAME / VITE_TURN_CREDENTIAL — для lt-cred-mech нужны оба; иначе клиент не передаст креды (см. call-ice-config.ts)."
  fi
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
