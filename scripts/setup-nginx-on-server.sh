#!/usr/bin/env bash
# Подключает только домен pingos.ru (PING MOOT) к nginx. Другие сайты не трогает.
# Запускать НА СЕРВЕРЕ из папки проекта: cd /var/www/ping-moot && sudo bash scripts/setup-nginx-on-server.sh

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CONFIG_NAME="pingos.ru"
SOURCE="$PROJECT_DIR/deploy/nginx-ping-moot.conf"
AVAILABLE="/etc/nginx/sites-available/$CONFIG_NAME"
ENABLED="/etc/nginx/sites-enabled/$CONFIG_NAME"

if [ ! -f "$SOURCE" ]; then
  echo "Файл не найден: $SOURCE"
  exit 1
fi

echo "=== Добавление только pingos.ru в nginx (остальные сайты не меняются) ==="
cp "$SOURCE" "$AVAILABLE"
echo "Создан: $AVAILABLE"
ln -sf "$AVAILABLE" "$ENABLED"
echo "Включён: $ENABLED"

echo "Проверка конфигурации nginx..."
nginx -t
echo "Перезагрузка nginx..."
systemctl reload nginx
echo "Готово. pingos.ru и www.pingos.ru теперь ведут на этот проект (порт 3080)."
