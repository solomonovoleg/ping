# Деплой PING MOOT

**Где вся документация по деплою и БД:** см. **deploy/ГДЕ-ДОКУМЕНТАЦИЯ.md** (в репо и на сервере в `/var/www/ping-moot/deploy/`).

- **Папка**: отдельная на VPS (например `/var/www/ping-moot`).
- **Порт**: 3080.
- **БД**: отдельная база `ping_moot` (и пользователь по желанию).
- **Чтобы не терять доступ к БД:** храни `DATABASE_URL` в **deploy.env** в корне проекта — при каждом `npm run deploy` он записывается в `.env` на сервере.

## Данные доступа к серверу

Хранятся в **`deploy.env`** в корне проекта (файл в `.gitignore`, в репозиторий не попадает):

- `VPS_HOST` — IP или домен (например 130.49.150.92)
- `VPS_USER` — пользователь SSH (например root)
- `VPS_PASSWORD` — пароль (чтобы не вводить при каждом деплое)
- `VPS_PATH`, `PORT` — по необходимости

Для входа без ввода пароля при деплое: установи **sshpass** (`brew install sshpass` на Mac). Тогда `./scripts/deploy.sh` подхватит пароль из `deploy.env`. Альтернатива: настрой вход по ключу — `ssh-copy-id root@130.49.150.92`.

## Заливка на VPS

Из **корня проекта** (локально):

```bash
# deploy.sh сам подхватывает deploy.env
./scripts/deploy.sh
# или с явной подгрузкой:
source deploy.env 2>/dev/null; ./scripts/deploy.sh
```

Либо через deploy/upload.sh:

```bash
source deploy.env && ./deploy/upload.sh
```

Скрипт: собирает проект, копирует всё на сервер (без node_modules и .git), ставит на сервере `npm ci --omit=dev`. Дальше на VPS остаётся запустить приложение (см. ниже).

Первый раз на VPS создай папку: `ssh user@host "mkdir -p /var/www/ping-moot"`.

## После заливки на VPS

1. **БД и .env (обязательно)**  
   На сервере в папке приложения создай файл `.env` (его не деплоим — он только на сервере):

   ```bash
   ssh root@ТВОЙ_СЕРВЕР
   cd /var/www/ping-moot
   nano .env
   ```

   Содержимое (подставь свои значения):

   ```
   DATABASE_URL=postgresql://ping_moot:ТВОЙ_ПАРОЛЬ_ОТ_БД@localhost:5432/ping_moot
   SESSION_SECRET=длинная-случайная-строка-для-сессий
   PORT=3080
   ```

   Пароль в `DATABASE_URL` должен совпадать с паролем пользователя PostgreSQL `ping_moot`. Если пользователь/БД ещё не созданы:

   ```bash
   sudo -u postgres psql -c "CREATE USER ping_moot WITH PASSWORD 'твой_пароль';"
   sudo -u postgres psql -c "CREATE DATABASE ping_moot OWNER ping_moot;"
   ```

   Затем миграции: `cd /var/www/ping-moot && npx drizzle-kit@latest push --config=drizzle.config.ts` (нужен .env с DATABASE_URL).

   **Таблица комментариев**: при каждом деплое автоматически запускается `scripts/migrate-post-comments.cjs` — он создаёт таблицу `post_comments`, если её нет. Если видишь ошибку «password authentication failed», проверь пароль в `DATABASE_URL` в `.env` на сервере (должен совпадать с паролем пользователя `ping_moot` в PostgreSQL). После исправления пароля можно вручную запустить: `node scripts/migrate-post-comments.cjs`.

2. Запуск на порту 3080:  
   Приложение подхватывает переменные из `.env`.  
   `pm2 start ecosystem.config.cjs` или `pm2 restart ping-moot` после правок .env.

Подробно: [docs/DEPLOY.md](../docs/DEPLOY.md).

## Домен pingos.ru на сервере с другими проектами

На одном сервере могут быть несколько сайтов с разными доменами. Конфиг для PING MOOT обрабатывает **только** `pingos.ru` и `www.pingos.ru`; остальные домены продолжают работать своими конфигами.

**Безопасно добавить сайт (ничего не перезаписывать):**

На сервере, из папки проекта (после деплоя она в `/var/www/ping-moot`):

```bash
cd /var/www/ping-moot
sudo bash scripts/setup-nginx-on-server.sh
```

Скрипт создаёт только файл **pingos.ru** в `sites-available`, не трогает другие конфиги. Перед перезагрузкой nginx выполняется `nginx -t` — при ошибке reload не произойдёт и остальные сайты не пострадают.

Вручную (если скрипт не использовать):

```bash
sudo cp /var/www/ping-moot/deploy/nginx-ping-moot.conf /etc/nginx/sites-available/pingos.ru
sudo ln -sf /etc/nginx/sites-available/pingos.ru /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## Ошибка: «Сервер не может подключиться к базе данных»

Она появляется, когда **DATABASE_URL** в `.env` на сервере пустой, неверный или БД ещё не создана.  

**Надолго:** добавь в **deploy.env** (локально) строку `DATABASE_URL=postgresql://ping_moot:ПАРОЛЬ@localhost:5432/ping_moot` и при следующем деплое доступ восстановится.  

**Сейчас** — на сервере по SSH:

**1. Создать БД и пользователя (один раз):**
```bash
sudo -u postgres psql -c "CREATE DATABASE ping_moot;"
sudo -u postgres psql -c "CREATE USER ping_moot WITH PASSWORD 'ТВОЙ_ПАРОЛЬ_БД';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ping_moot TO ping_moot;"
sudo -u postgres psql -c "\\c ping_moot" -c "GRANT ALL ON SCHEMA public TO ping_moot;"
```
(подставь свой пароль вместо `ТВОЙ_ПАРОЛЬ_БД`)

**2. Прописать DATABASE_URL в .env приложения:**

Папка проекта на сервере: `/var/www/ping-moot`. Отредактируй `.env`:
```bash
cd /var/www/ping-moot
nano .env
```
Добавь или исправь строку (подставь свой пароль):
```
DATABASE_URL=postgresql://ping_moot:ТВОЙ_ПАРОЛЬ_БД@localhost:5432/ping_moot
```

**3. Применить схему и перезапустить приложение:**
```bash
cd /var/www/ping-moot
source .env 2>/dev/null || true
export $(grep -v '^#' .env | xargs)
npm run db:push
pm2 restart ping-moot
```

После этого обнови страницу входа — ошибка должна пропасть.

---

## Как проверить, что деплой прошёл успешно

**Почему не видно изменений?** Почти всегда мешает кэш браузера. Сервер уже отдаёт новую версию, но браузер подставляет старую страницу и старый JS.

**Что сделать по шагам:**

1. **Проверить, какая версия на сервере**  
   Открой в браузере (лучше в новой вкладке):  
   **http://130.49.150.92:3080/api/build-info**  
   Должен открыться JSON вида: `{"version":"5","note":"..."}`.  
   Цифра `version` — это версия текущей сборки на сервере (после последнего деплоя она увеличивается).

2. **Обновить страницу входа без кэша**  
   Открой главную: **http://130.49.150.92:3080**  
   Сделай жёсткое обновление:
   - **Windows / Linux:** `Ctrl + Shift + R`
   - **Mac:** `Cmd + Shift + R`  
   Либо открой сайт в режиме **инкогнито** (тогда кэш не используется).

3. **Убедиться, что подтянулась новая версия**  
   Внизу экрана входа должна быть строка **«Версия N»** (или больше).  
   Если версия совпадает с цифрой из `/api/build-info`, значит загружена актуальная сборка.

1. **Страница открывается**  
   Открой `http://ТВОЙ_СЕРВЕР:3080` — должна загрузиться форма входа.

2. **Версия приложения внизу экрана входа**  
   Под формой отображается **«Версия N»**. С каждым деплоем N увеличивается (файл `.build-number` в корне проекта). Если после деплоя видишь прежнее число — сделай жёсткое обновление (Ctrl+Shift+R / Cmd+Shift+R).

3. **Поведение формы**  
   - Подсказка в поле «Телефон»: **«Введите номер»** (не два формата).  
   - При вводе цифр номер отображается в формате **+7 (XXX) XXX-XX-XX**.  
   - Есть слоган: «Персональный мессенджер! Максимальная приватность».

4. **API и авторизация**  
   - Регистрация с номером и паролем создаёт аккаунт.  
   - Вход с теми же данными перенаправляет в приложение или на онбординг (имя/фамилия).

5. **Миграции**  
   В логе деплоя должна быть строка «Миграции БД (drizzle-kit push)» без ошибок. Или на сервере: `cd /var/www/ping-moot && . ./.env && npx drizzle-kit push`.

6. **Процесс на сервере**  
   По SSH: `pm2 list` — процесс `ping-moot` в статусе `online`.
