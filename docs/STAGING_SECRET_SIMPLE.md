# Staging: залить на сервер

## Самый быстрый путь (без GitHub Actions, без секретов в GitHub)

У тебя уже есть **`deploy.staging.env`** локально — этого достаточно.

**Windows (PowerShell), из корня проекта:**

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\deploy-staging.ps1
```

**Или** если есть Git Bash / WSL:

```bash
npm run deploy:staging
```

Скрипт копирует `deploy.staging.env` → `deploy.env` и выполняет тот же `scripts/deploy.sh`, что и ручной прод-деплой. Через несколько минут стенд на `:3081` обновится.

---

## Секрет в GitHub (только если нужен автодеплой из Actions)

GitHub **сам не знает** пароли от сервера. Их нужно **один раз** вставить в настройках репозитория.

**Не присылай пароли GitHub или токены в чат с ИИ** — это небезопасно.

## Вариант А — вручную (2 минуты)

1. Открой: **GitHub → репозиторий ping → Settings → Secrets and variables → Actions**.
2. Кнопка **New repository secret**.
3. **Name:** `STAGING_DEPLOY_ENV` (копируй как есть).
4. **Secret:** открой у себя на компе файл **`deploy.staging.env`**, выдели **всё** (Ctrl+A), скопируй (Ctrl+C), вставь в поле секрета.
5. **Add secret**.
6. Зайди в **Actions → Deploy staging → Run workflow** (или запушь что-нибудь в `feature/dev`).

Готово: следующий запуск уже соберёт и зальёт на стенд.

---

## Вариант Б — одна команда (если установлен GitHub CLI)

В корне проекта, в терминале:

```bash
gh auth login
```

Потом:

**Windows (PowerShell):**

```powershell
.\scripts\set-staging-deploy-secret.ps1
```

**Mac / Linux:**

```bash
bash scripts/set-staging-deploy-secret.sh
```

Скрипт сам прочитает `deploy.staging.env` и создаст секрет `STAGING_DEPLOY_ENV`.
