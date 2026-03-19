#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/.."

if [ ! -f deploy.staging.env ] && [ -f deploy.staging.env.example ]; then
  cp deploy.staging.env.example deploy.staging.env
  echo "Создан deploy.staging.env из примера. Заполни переменные и запусти снова."
  exit 0
fi

DEPLOY_ENV_FILE=deploy.staging.env bash scripts/deploy.sh "$@"
