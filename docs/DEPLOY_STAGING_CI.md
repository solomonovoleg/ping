# Автодеплой staging с GitHub Actions

После настройки **каждый push в ветку `feature/dev`** собирает проект и заливает его на твой staging (тот же `scripts/deploy.sh`, что и при локальном `npm run deploy`). **Мерж в `main` не нужен.**

## Что сделать один раз

### 1. Секрет `STAGING_DEPLOY_ENV`

1. GitHub → репозиторий → **Settings** → **Secrets and variables** → **Actions**.
2. **New repository secret** → имя: **`STAGING_DEPLOY_ENV`**.
3. В значение вставь **полный текст** файла как у локального staging-деплоя (аналог `deploy.staging.env`), построчно, как в обычном `deploy.env`.

Обязательно для staging:

| Переменная | Зачем |
|------------|--------|
| `VPS_HOST`, `VPS_USER`, `VPS_PASSWORD` | SSH (как сейчас в `deploy.sh`) |
| `VPS_PATH` | Например `/var/www/ping-moot-staging` |
| `PORT` | Например `3081` |
| `PM2_APP_NAME` | Уникальное имя, например `ping-moot-staging` (не перезаписывать prod) |
| `DATABASE_URL` | Staging-БД на сервере |
| `SESSION_SECRET` | Свой для стенда |
| `VITE_*` | Что нужно для сборки (например `VITE_WS_URL`) |

Шаблон без секретов: **`deploy.staging.env.example`** в корне репо.

> **Важно:** в файле для CI должно быть **`PM2_APP_NAME`**, не `APP_NAME` — именно его читает `scripts/deploy.sh`.

### 2. (Опционально) Environment `staging`

Можно завести GitHub **Environment** `staging` и хранить там тот же секрет — удобно для защиты ветки или approvers. В текущем workflow секрет читается из **repository secrets**; environment не обязателен.

### 3. SSH по паролю

Workflow ставит **`sshpass`**, чтобы работал текущий `deploy.sh` с `VPS_PASSWORD`. Более безопасный вариант на будущее — вход по **SSH deploy key** и доработка скрипта без пароля.

## Проверка

- **Actions** → workflow **Deploy staging** → последний run должен быть зелёным.
- Открой стенд в браузере (например `http://<VPS>:3081/`) с жёстким обновлением (Ctrl+F5).

## Ручной запуск

**Actions** → **Deploy staging** → **Run workflow** (ветка `feature/dev` или с какой клонировали — по умолчанию текущая default branch для dispatch может отличаться; при необходимости выбери ref).

## Безопасность

- Не коммить `deploy.staging.env` с паролями — в `.gitignore` добавлен `deploy.staging.env`.
- Секреты только в **GitHub Secrets** / **Environment secrets**.
