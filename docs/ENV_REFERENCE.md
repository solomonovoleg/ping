# Справочник переменных окружения

Единая точка: **локальная разработка** — `.env` (шаблон `.env.example`); **прод** — `deploy.env` (шаблон `deploy.env.example`).  
При деплое, если задан `DATABASE_URL`, скрипт **`scripts/deploy.sh`** собирает **серверный** `.env` на VPS из переменных, прочитанных из `deploy.env` (см. функцию `build_server_env` в конце файла).

## Клиент (Vite) — только при сборке

Переменные **`VITE_*`** вшиваются в бандл на этапе `npm run build`. В `deploy.sh` перед сборкой экспортируются все уже заданные в shell переменные с префиксом `VITE_` (цикл `for v in ${!VITE_@}`). Их нужно держать в **`deploy.env`**, иначе в проде останутся дефолты / пусто.

| Переменная | Назначение |
|------------|------------|
| `VITE_API_URL` | Базовый URL API, если SPA отдаётся с другого хоста, чем бэкенд (`client/src/lib/api-base.ts`, `legal.ts`). |
| `VITE_WS_URL` | База для WebSocket звонков, если не совпадает с origin страницы (`client/src/lib/calls.ts`). |
| `VITE_PINGOK_MICRO_URL` | Fallback на отдельный процесс Пингока (`PingokMicroOverlay` и др.). |
| `VITE_TURN_URLS` / `VITE_TURN_URL` | ICE TURN (список или один URL). |
| `VITE_TURN_USERNAME` / `VITE_TURN_CREDENTIAL` | Пара для coturn lt-cred-mech; оба или ни одного (`call-ice-config.ts`). |
| `VITE_PRIVACY_POLICY_URL` / `VITE_SUPPORT_EMAIL` | Ссылки для стора / легала. |
| `VITE_CALLS_RING_TIMEOUT_MS` | Таймаут гудка (клиент). |
| `VITE_CALLS_ACCEPT_TIMEOUT_MS` | Ожидание ответа на оффер и т.п. (по умолчанию 15000). |
| `VITE_CALLS_CONNECT_TIMEOUT_MS` | Установка соединения (по умолчанию 20000). |
| `VITE_CALLS_RECONNECT_TIMEOUT_MS` | Реконнект (по умолчанию 8000). |
| `VITE_CALLS_FEATURE_*` | Флаги UI звонков: `NETWORK_QUALITY`, `CAMERA_FLIP`, `SCREEN_SHARE`, `LOCAL_RECORDING`, `REACTIONS`, `CAPTIONS_RELAY`. |
| `VITE_GROUP_CALLS_ENABLED` | Модуль групповых звонков в клиенте. |
| `VITE_GROUP_CALLS_SERVER_ASR` | Клиентский флаг титров через сервер. |
| `VITE_GROUP_CALLS_ASR_PCM_STREAM` | Предпочитать PCM+WS вместо webm HTTP. |

## Сервер (Node / PM2)

Читаются из **`.env` в корне проекта на сервере** (PM2 подхватывает через `ecosystem.config.cjs` → `dotenv`).

### Обязательные в проде (минимум)

| Переменная | Назначение |
|------------|------------|
| `DATABASE_URL` | PostgreSQL. |
| `SESSION_SECRET` | Секрет сессии (генерируется при первом `deploy.env`, на сервере сохраняется при пустом значении в deploy). |
| `SESSION_SECURE` | `true` при HTTPS (`server/auth/session.ts`). |
| `PORT` | Порт HTTP (по умолчанию 3080). |

### Частые опциональные

| Переменная | Назначение |
|------------|------------|
| `SESSION_SAME_SITE` | `none` + `SESSION_SECURE=true` для куки при разных поддоменах фронта и API. |
| `PHONE_AT_REST_SECRET` | Шифрование телефонов в БД. |
| `PG_POOL_MAX` | Размер пула `pg` (`server/db/client.ts`). |
| `ADMIN_LOGIN` / `ADMIN_PASSWORD` | Админка. |
| `FCM_SERVER_KEY` | Пуши (звонок / сообщение). |
| `OPENROUTER_API_KEY` / `OPENROUTER_MODEL` / `OPENROUTER_TRANSLATE_MODEL` | AI и перевод в чате. |
| `S3_*` | Облачное хранилище медиа (`server/upload/s3.ts`). |
| `CALLS_DEBUG`, `CALLS_DISCONNECT_GRACE_MS`, `CALLS_RING_TIMEOUT_MS`, `CALLS_CALLER_WAIT_MS`, `CALLS_PENDING_TTL_MS` | Звонки 1:1 (сервер). |
| `GROUP_CALLS_ENABLED`, `GROUP_CALLS_SERVER_ASR_ENABLED`, `CALL_TRANSCRIPTS_*` | Групповые звонки и ASR. |
| `VOICE_MESSAGE_ASR_LANGUAGE` | Язык для расшифровки голосовых в чате (`server/messages/voice-transcribe.ts`). |
| `AI_SEARCH_ENABLED`, `AI_SEARCH_HOT_TTL_HOURS`, `AI_SEARCH_HOT_L1_MS` | AI Search. |
| `FEED_*`, `FEED_SNAPSHOT_*` | Ранжирование и глобальный снапшот ленты (`server/feed/config.ts`). |
| `FEED_WORKER_*` | PM2-воркер снапшота (`ecosystem.config.cjs` + `dist/feed-worker.cjs`). |
| `PINGOK_MICRO_*`, `PINGOK_PM2_NAME` | Отдельный процесс Пингока. |
| `EDGE_*` | Микросервис EDGE + прокси платформы. |
| `EDGE_PRIZE_NOTIFY_USER_ID` | От чьего имени слать ЛС победителям розыгрыша. |
| `PARSER_*`, `VK_PARSER_TOKEN_KEY` | Парсер ВК + секрет internal publish. |
| `DISK_*` | Админка «Диск». |
| `ADMIN_CONTENT_*` | Фоновый контент-ингест. |
| `AUTH_TOKEN_SECRET` | Отдельный секрет JWT (иначе fallback на `SESSION_SECRET`). |
| `TRANSLATE_DEBUG` | Логи перевода. |

## Деплой: что попадает на сервер в `.env`

Все переменные из таблиц выше, для которых в `deploy.env` задано непустое значение, **должны** перечисляться в **`build_server_env`** внутри `scripts/deploy.sh`. Если чего-то нет в `put "$VAR" "VAR"` — значение из `deploy.env` **не запишется** на VPS (даже если вы его указали).

Актуальный список `put` — всегда в конце `build_server_env` в `scripts/deploy.sh`.

## Быстрая проверка после правок `deploy.env`

1. **Клиент:** после сборки искать ожидаемые литералы, например TURN: `rg "turn:" dist/public/assets/*.js`.
2. **Сервер:** на VPS `grep -E '^(OPENROUTER|S3_|SESSION_SAME_SITE|FEED_)' /var/www/ping-moot/.env` (путь заменить на свой).

## Связанные документы

- `docs/DEPLOY_RULES.md` — порядок деплоя и БД.
- `docs/CALLS_TURN_SETUP.md` — TURN / coturn.
- `.env.example`, `deploy.env.example` — комментарии и примеры.
