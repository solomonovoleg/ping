# Деплой PING MOOT на VPS

На VPS у тебя несколько проектов: у каждого свой домен и **своя БД**. Этот проект живёт в **отдельной папке**, на **порту 3080** и с **отдельной базой PostgreSQL**.

**Деплой одной командой:** заполни `deploy.env` (VPS_HOST, VPS_USER, VPS_PASSWORD, **DATABASE_URL**) и выполни `npm run deploy`. Правила про .env и DATABASE_URL — в `docs/DEPLOY_RULES.md`.

### Staging на том же VPS

Отдельная папка, порт, БД и имя PM2 — иначе staging перезапишет production.

| Переменная | Пример staging |
|------------|----------------|
| `VPS_PATH` | `/var/www/ping-moot-staging` |
| `PORT` | `3081` |
| `PM2_APP_NAME` | `ping-moot-staging` |
| `DATABASE_URL` | `postgresql://ping_moot_staging:…@localhost:5432/ping_moot_staging` |

На сервере: отдельный пользователь и БД PostgreSQL, nginx (если нужен) — прокси на `127.0.0.1:3081`. Удобно держать второй файл, например `deploy.staging.env`, и перед деплоем `cp deploy.staging.env deploy.env` или вызывать скрипт с подстановкой переменных.

**Автодеплой staging с GitHub:** push в `feature/dev` — см. **`docs/DEPLOY_STAGING_CI.md`** (секрет `STAGING_DEPLOY_ENV`, шаблон `deploy.staging.env.example`). Мерж в `main` не требуется.

---

## Где документация

- **В репозитории:** `docs/DEPLOY.md` (этот файл), `docs/DB.md`, `deploy/README.md`, `deploy/CHECKLIST.md`, `deploy/create-db.sh`.
- **На сервере:** после деплоя та же документация лежит в папке проекта:  
  `docs/DEPLOY.md`, `deploy/README.md` и т.д.  
  Путь к проекту: **`/var/www/ping-moot`** (или значение `VPS_PATH` из `deploy.env`).

---

## 0. Один файл настроек (deploy.env) — сюда пишем всё, чтобы не терять

Все переменные для деплоя и для приложения на сервере хранятся в **одном файле** `deploy.env` — его не коммитят в git.

**Как устроен деплой** (подробно: `docs/DEPLOY_RULES.md`):

- **Источник истины для .env на сервере — deploy.env.** Если в `deploy.env` задан **DATABASE_URL**, при **каждом** `npm run deploy` скрипт перезаписывает `.env` на сервере из `deploy.env` (PORT, SESSION_SECRET, DATABASE_URL, ADMIN_*, S3_*, OPENROUTER_* и т.д.). Править .env вручную на сервере не нужно.
- Если в `deploy.env` **нет** DATABASE_URL, скрипт **не трогает** .env на сервере (чтобы не затереть существующее подключение к БД).

**Первый раз** обязательно добавь `DATABASE_URL` в `deploy.env`. На сервере хост должен быть **localhost**: `postgresql://ping_moot:ПАРОЛЬ@localhost:5432/ping_moot`. Можно задать отдельно `DB_PASSWORD` — тогда скрипт сам соберёт строку `postgresql://ping_moot:ПАРОЛЬ@localhost:5432/ping_moot`. Если в `.env` на сервере когда-то попал хост `base`, скрипт при деплое сам заменит его на `localhost`.

**Пароль БД (ping_moot):** хранится в `deploy.env` — переменные **DB_PASSWORD** и **DATABASE_URL**. Файл в `.gitignore`, в репозиторий не попадает.  
Если ты сменил пароль в `deploy.env`, зайди на **VPS по SSH** и **один раз на сервере** выполни (подставь пароль из `DB_PASSWORD`):

```bash
sudo -u postgres psql -d postgres -c "ALTER USER ping_moot WITH PASSWORD 'ПАРОЛЬ_ИЗ_DEPLOY_ENV';"
```

После этого задеплой снова (`npm run deploy`) — миграции и приложение будут использовать новый пароль.

---

**Один раз сделай:**

```bash
cp deploy.env.example deploy.env
```

Открой `deploy.env` и заполни минимум:

- **VPS_HOST** — IP или домен сервера
- **VPS_USER** — пользователь SSH (часто `root`)
- **VPS_PASSWORD** — пароль от сервера (или настрой ключ и можно не указывать)
- **SESSION_SECRET** — можно оставить пустым, при деплое сгенерируется сам
- **DATABASE_URL** — **обязательно** (строка подключения к PostgreSQL), иначе после деплоя доступ к БД пропадёт

По желанию добавь **S3_*** (облако для медиа), **ADMIN_LOGIN** / **ADMIN_PASSWORD**.

При каждом `npm run deploy`: сборка, заливка кода, запись `.env` на сервер из `deploy.env` (если задан DATABASE_URL), миграции, рестарт PM2.

---

## Схема на VPS

| Параметр        | Значение для PING MOOT   |
|-----------------|---------------------------|
| Папка проекта   | отдельная, например `/var/www/ping-moot` или `~/ping-moot` |
| Порт            | **3080** (только этот проект) |
| База данных     | отдельная БД, например **ping_moot** |
| Домен           | свой (в nginx указываешь свой server_name) |

---

## 1. Папка и код

Создай отдельную папку под проект и залей код:

```bash
# пример: отдельная папка под проект
mkdir -p /var/www/ping-moot
cd /var/www/ping-moot

git clone <url-репозитория> .
# или залей файлы через scp/rsync
```

Дальше все команды — из этой папки.

---

## 2. Отдельная база данных (PostgreSQL)

Один раз создай **отдельную БД** для PING MOOT (не трогая БД других проектов).

Под пользователем `postgres` или своим суперпользователем:

```bash
sudo -u postgres psql -c "CREATE DATABASE ping_moot;"
```

Опционально — отдельный пользователь только для этой БД:

```bash
sudo -u postgres psql -c "CREATE USER ping_moot WITH PASSWORD 'твой_пароль';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ping_moot TO ping_moot;"
sudo -u postgres psql -c "\\c ping_moot" -c "GRANT ALL ON SCHEMA public TO ping_moot;"
```

Строка подключения **только для этого проекта**:

- Если один пользователь на все БД:  
  `postgresql://postgres:пароль@localhost:5432/ping_moot`
- Если пользователь `ping_moot`:  
  `postgresql://ping_moot:твой_пароль@localhost:5432/ping_moot`

Эту строку задаёшь в **DATABASE_URL** только для приложения PING MOOT.

---

## 3. Сборка и переменные

В папке проекта:

```bash
cd /var/www/ping-moot   # твоя папка
npm ci
npm run build
```

Переменные окружения **только для этого приложения**:

- **PORT=3080** — приложение слушает только 3080.
- **SESSION_SECRET** — своя длинная случайная строка для сессий.
- **SESSION_SECURE=true** — обязательно для доступа по HTTPS (иначе куки сессии не сохраняются, в консоли 401). Для локального HTTP используй **SESSION_SECURE=false**. При деплое через `scripts/server-setup.sh` по умолчанию подставляется `SESSION_SECURE=true`.
- **DATABASE_URL** — строка подключения к БД **ping_moot** (см. выше).

**Медиа (фото постов, голосовые, картинки в чате):** по умолчанию сохраняются в папку **uploads/** на диске сервера. При пересоздании сервера или очистке папки они пропадут. Чтобы всё грузилось в облако и не пропадало, задай S3-совместимое хранилище (Cloud.ru Evolution Object Storage и др.):

- **S3_ENDPOINT** — URL хранилища (например `https://s3.cloud.ru`).
- **S3_BUCKET** — имя бакета.
- **S3_ACCESS_KEY** и **S3_SECRET_KEY** — ключи доступа.
- **S3_REGION** — опционально (по умолчанию `ru-central-1`).

Если все четыре переменные заданы, загрузки идут в S3 и в ответах отдаются полные URL; иначе файлы пишутся в `uploads/` на сервере. Пример в `.env.example`.

Применить схему в своей БД (один раз):

```bash
export DATABASE_URL="postgresql://ping_moot:пароль@localhost:5432/ping_moot"
npm run db:push
```

**Если деплоишь через `scripts/deploy.sh`** — миграции (в т.ч. колонки `users.last_seen_at` и `users.fcm_token`) запускаются на сервере автоматически при каждом деплое. Ничего вручную делать не нужно.

---

## 4. Запуск на порту 3080

Порт по умолчанию в коде — **3080**. Запуск:

```bash
export PORT=3080
export SESSION_SECRET=твой-секрет
export DATABASE_URL="postgresql://ping_moot:пароль@localhost:5432/ping_moot"
npm run start
```

Или через PM2 (из папки проекта):

```bash
pm2 start ecosystem.config.cjs
```

В `ecosystem.config.cjs` уже указаны `PORT: 3080` и путь к `dist/index.cjs`. Секрет и **DATABASE_URL** задай в `env` в этом файле или через `pm2 start ... --env DATABASE_URL=...`.

---

## 5. Nginx — свой домен на 3080

У других проектов свои `server { }` и свои порты. Для PING MOOT добавь отдельный блок со своим доменом и проксированием на **3080**:

```nginx
server {
    listen 80;
    server_name ping-moot.твой-домен.ru;   # свой домен для этого проекта

    location / {
        proxy_pass http://127.0.0.1:3080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Проверка и перезагрузка:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

**Звонки (WebSocket):** чтобы аудио/видео звонки работали, nginx должен проксировать не только HTTP, но и **WebSocket** (upgrade на `/calls`). Добавь в тот же `location /` или отдельный `location /calls`:

```nginx
location / {
    proxy_pass http://127.0.0.1:3080;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

Если фронт открывается с **другого домена** (например CDN или отдельный хост), при сборке задай **VITE_WS_URL** — тот же хост, где висит Node (и nginx). Тогда клиент будет поднимать WebSocket к правильному серверу. Пример в `.env` при сборке: `VITE_WS_URL=https://ping-moot.твой-домен.ru`.

---

## Деплой одной командой (из корня проекта)

1. Создай **`deploy.env`** в корне (если его нет: `cp deploy.env.example deploy.env`). Заполни минимум:

```bash
VPS_HOST=130.49.150.92
VPS_USER=root
VPS_PASSWORD=твой_пароль_ssh
DATABASE_URL=postgresql://ping_moot:ПАРОЛЬ_БД@localhost:5432/ping_moot
# опционально: VPS_PATH=/var/www/ping-moot, PORT=3080
```

Для входа без пароля: `brew install sshpass` (Mac) или настрой ключ: `ssh-copy-id root@IP`.

2. Запусти деплой:

```bash
npm run deploy
```

Скрипт: сборка → заливка на сервер → запись `.env` на сервере из `deploy.env` (если задан DATABASE_URL) → установка зависимостей, миграции, перезапуск PM2.

---

## Кратко

- **Папка**: отдельная (например `/var/www/ping-moot`).
- **Порт**: **3080** (только для этого приложения).
- **БД**: отдельная БД **ping_moot** (и при желании пользователь `ping_moot`), **DATABASE_URL** только для этого проекта.
- **Домен**: свой, в nginx проксируешь на `127.0.0.1:3080`.

Так PING MOOT не пересекается с другими проектами на VPS ни по папке, ни по порту, ни по БД.
