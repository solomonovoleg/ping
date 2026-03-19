#!/usr/bin/env bash
# Заливка staging БЕЗ GitHub Actions: deploy.staging.env → deploy.env → scripts/deploy.sh
set -e
cd "$(dirname "$0")/.."
SRC="deploy.staging.env"
if [ ! -f "$SRC" ]; then
  echo "Нет $SRC — скопируй deploy.staging.env.example и заполни." >&2
  exit 1
fi
cp "$SRC" deploy.env
echo "=== Использую deploy.env из $SRC ==="
exec bash scripts/deploy.sh "$@"
