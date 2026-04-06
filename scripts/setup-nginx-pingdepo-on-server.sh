#!/usr/bin/env bash
# Подключает тестовый домен pingdepo.ru к nginx для стенда (порт 5550).
# Запускать НА СЕРВЕРЕ из папки проекта: cd /var/www/ping-moot-test && sudo bash scripts/setup-nginx-pingdepo-on-server.sh

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CONFIG_NAME="pingdepo.ru"
SOURCE="$PROJECT_DIR/deploy/nginx-pingdepo.conf"
AVAILABLE="/etc/nginx/sites-available/$CONFIG_NAME"
ENABLED="/etc/nginx/sites-enabled/$CONFIG_NAME"

if [ ! -f "$SOURCE" ]; then
  echo "Файл не найден: $SOURCE"
  exit 1
fi

echo "=== Добавление только pingdepo.ru в nginx (остальные сайты не меняются) ==="
cp "$SOURCE" "$AVAILABLE"
echo "Создан: $AVAILABLE"
ln -sf "$AVAILABLE" "$ENABLED"
echo "Включён: $ENABLED"

echo "Проверка конфигурации nginx..."
nginx -t
echo "Перезагрузка nginx..."
systemctl reload nginx
echo "Готово. pingdepo.ru и www.pingdepo.ru теперь ведут на этот проект (порт 5550)."
