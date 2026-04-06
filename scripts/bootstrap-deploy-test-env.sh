#!/usr/bin/env bash
# Создаёт deploy.test.env из примера (если файла нет). Секреты остаются в deploy.env.
set -e
cd "$(dirname "$0")/.."
TARGET="deploy.test.env"
EXAMPLE="deploy.test.env.example"
BASE="deploy.env"
if [ -f "$TARGET" ]; then
  echo "Уже есть $TARGET — не перезаписываю."
  exit 0
fi
if [ ! -f "$BASE" ]; then
  echo "Сначала создай и заполни $BASE (как для прода): cp deploy.env.example deploy.env"
  exit 1
fi
if [ ! -f "$EXAMPLE" ]; then
  echo "Нет $EXAMPLE"
  exit 1
fi
cp "$EXAMPLE" "$TARGET"
chmod 600 "$TARGET" 2>/dev/null || true
echo "Создан $TARGET — открой и поправь только DATABASE_URL (и домен pingdepo.ru при необходимости)."
echo "Деплой теста: npm run deploy:test (подтянет ключи из $BASE автоматически)."
