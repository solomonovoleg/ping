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

return 0
