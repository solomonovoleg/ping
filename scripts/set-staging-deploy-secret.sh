#!/usr/bin/env bash
# Читает deploy.staging.env и создаёт секрет STAGING_DEPLOY_ENV (нужны gh и gh auth login).
set -e
cd "$(dirname "$0")/.."
ENV_FILE="deploy.staging.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "Нет $ENV_FILE. Скопируй deploy.staging.env.example и заполни." >&2
  exit 1
fi
if ! command -v gh >/dev/null 2>&1; then
  echo "Установи GitHub CLI: https://cli.github.com/ и выполни: gh auth login" >&2
  exit 1
fi
REMOTE="$(git remote get-url origin 2>/dev/null)" || true
REPO=""
if echo "$REMOTE" | grep -qE 'github\.com[:/]([^/]+/[^/.]+)'; then
  REPO="$(echo "$REMOTE" | sed -E 's#.*github\.com[:/]([^/]+/[^/.]+).*#\1#')"
fi
if [ -z "$REPO" ]; then
  echo "Не удалось разобрать owner/repo из origin: $REMOTE" >&2
  exit 1
fi
echo "Репозиторий: $REPO"
gh secret set STAGING_DEPLOY_ENV --repo "$REPO" < "$ENV_FILE"  # stdin = весь файл
echo "Готово. Запусти Actions → Deploy staging или push в feature/dev."
