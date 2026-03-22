#!/usr/bin/env bash
# Архив проекта без тяжёлых/секретных артефактов.
# Использование: bash scripts/backup-project.sh
# Результат: backups/ping-moot-YYYYMMDD-HHMMSS.tar.gz

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PARENT="$(dirname "$PROJECT_ROOT")"
BASENAME="$(basename "$PROJECT_ROOT")"
STAMP="$(date +%Y%m%d-%H%M%S)"
ARCHIVE_NAME="ping-moot-${STAMP}.tar.gz"
mkdir -p "$PROJECT_ROOT/backups"
ARCHIVE_PATH="$PROJECT_ROOT/backups/$ARCHIVE_NAME"

echo "=== Бэкап: $ARCHIVE_PATH ==="

tar -czf "$ARCHIVE_PATH" -C "$PARENT" \
  --exclude="${BASENAME}/node_modules" \
  --exclude="${BASENAME}/dist" \
  --exclude="${BASENAME}/backups" \
  --exclude="${BASENAME}/uploads" \
  --exclude="${BASENAME}/.local" \
  --exclude="${BASENAME}/android/.gradle" \
  --exclude="${BASENAME}/android/app/build" \
  --exclude="${BASENAME}/android/build" \
  --exclude="${BASENAME}/ios/App/build" \
  --exclude="${BASENAME}/ios/DerivedData" \
  --exclude="${BASENAME}/.env" \
  --exclude="${BASENAME}/deploy.env" \
  --exclude="${BASENAME}/deploy.env.tmp" \
  --exclude='.DS_Store' \
  "${BASENAME}"

SIZE="$(du -h "$ARCHIVE_PATH" | cut -f1)"
echo "=== Готово: $ARCHIVE_NAME ($SIZE) ==="
echo "Восстановление: tar -xzf $ARCHIVE_NAME -C /path/to/parent"
