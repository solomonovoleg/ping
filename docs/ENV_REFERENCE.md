# Справочник переменных окружения

Единая точка: **локальная разработка** — `.env` (шаблон `.env.example`); **прод** — `deploy.env` (шаблон `deploy.env.example`).  
При деплое, если задан `DATABASE_URL`, скрипт **`scripts/deploy.sh`** собирает **серверный** `.env` на VPS из переменных, прочитанных из `deploy.env` (см. функцию `build_server_env` в конце файла).

Перед сборкой **`deploy.sh`** по умолчанию **не пускает деплой**, если пусты: `DATABASE_URL`, все обязательные `S3_*`, `FCM_SERVER_KEY`, `OPENROUTER_API_KEY`, пара `VITE_TURN_USERNAME` / `VITE_TURN_CREDENTIAL` и один из `VITE_TURN_URLS` / `VITE_TURN_URL`; при включённом New-Tel — ключи провайдера. См. `DEPLOY_SKIP_ENV_VERIFY` / `DEPLOY_VERIFY_MINIMAL` / `DEPLOY_ALLOW_NO_TURN` в `deploy.env.example`. При **`DEPLOY_VERIFY_MINIMAL=1`** FCM/OpenRouter могут не проверяться, но **TURN всё равно обязателен** (иначе в бандл не попадёт relay и звонки за NAT ломаются).

## Клиент (Vite) — только при сборке

Переменные **`VITE_*`** вшиваются в бандл на этапе `npm run build`. В `deploy.sh` перед сборкой они **экспортируются из `deploy.env`** (и при `deploy:test` — из базового файла, затем тестового), функция `export_vite_from_deploy_files`: так работает и **bash 3.2 на macOS** (без `${!VITE_@}`). Держите значения в **`deploy.env`**, иначе в проде останутся дефолты / пусто.  
**Важно:** `VITE_FIREBASE_*` **не** попадают в серверный `.env` на VPS — только в статический фронт при сборке; для отправки пушей на сервере по-прежнему нужен FCM v1 (`GOOGLE_APPLICATION_CREDENTIALS` / `FCM_SERVICE_ACCOUNT_B64` и т.д.).

| Переменная | Назначение |
|------------|------------|
| `VITE_API_URL` | Базовый URL API, если SPA отдаётся с другого хоста, чем бэкенд (`client/src/lib/api-base.ts`, `legal.ts`). Для Capacitor почти всегда задавайте явно (или через `VITE_SITE_ORIGIN`). |
| `VITE_WS_URL` | База для WebSocket звонков, если не совпадает с origin страницы (`client/src/lib/calls.ts`). |
| `VITE_SITE_ORIGIN` | Публичный `https://домен` без слэша; в `capacitor-build-prod-client.sh` подставляет API/WS, если они не заданы отдельно. |
| `VITE_PINGOK_MICRO_URL` | Fallback на отдельный процесс Пингока (`PingokMicroOverlay` и др.). |
| `VITE_TURN_URLS` / `VITE_TURN_URL` | ICE TURN (список или один URL). |
| `VITE_TURN_USERNAME` / `VITE_TURN_CREDENTIAL` | Пара для coturn lt-cred-mech; оба или ни одного (`call-ice-config.ts`). |
| `VITE_CALLS_ALLOW_P2P_ICE` | Если `1` / `true` — в проде для **1:1** не форсировать весь трафик через TURN (`iceTransportPolicy: relay` выкл.). По умолчанию при полном TURN в prod relay включён — лучше для Wi‑Fi ↔ LTE. |
| `VITE_PRIVACY_POLICY_URL` / `VITE_SUPPORT_EMAIL` | Ссылки для стора / легала. |
| `VITE_CALLS_RING_TIMEOUT_MS` | Таймаут гудка (клиент). |
| `VITE_CALLS_ACCEPT_TIMEOUT_MS` | Ожидание ответа на оффер и т.п. (по умолчанию 15000). |
| `VITE_CALLS_CONNECT_TIMEOUT_MS` | Установка соединения (по умолчанию 20000). |
| `VITE_CALLS_RECONNECT_TIMEOUT_MS` | Реконнект (по умолчанию 8000). |
| `VITE_CALLS_AUDIO_ONLY_FALLBACK` | `0` / `false` — отключить авто-переход video->audio при затяжной деградации сети; по умолчанию включён. |
| `VITE_CALLS_FEATURE_*` | Флаги UI звонков: `NETWORK_QUALITY`, `CAMERA_FLIP`, `SCREEN_SHARE`, `LOCAL_RECORDING`, `REACTIONS`, `CAPTIONS_RELAY`. |
| `VITE_GROUP_CALLS_ENABLED` | Модуль групповых звонков в клиенте. |
| `VITE_GROUP_CALLS_SERVER_ASR` | Клиентский флаг титров через сервер. |
| `VITE_GROUP_CALLS_ASR_PCM_STREAM` | Предпочитать PCM+WS вместо webm HTTP. |
| `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID` | Конфиг Web app в Firebase (вшивается в клиент для FCM в браузере). |
| `VITE_FIREBASE_STORAGE_BUCKET` | Опционально; иначе подставляется `{projectId}.appspot.com` (`web-push-firebase.ts`, плагин `firebase-sw-init`). |
| `VITE_FIREBASE_VAPID_KEY` | Публичный VAPID из Firebase → Cloud Messaging → Web Push certificates (`web-push-firebase.ts`). |

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
| `SESSION_MAX_AGE_DAYS` | Срок сессии в днях (кука и TTL в PostgreSQL для `connect-pg-simple`), по умолчанию 31. |
| `SESSION_COOKIE_DOMAIN` | Домен куки (например `.pingdepo.ru`), чтобы одна сессия работала на `www` и apex. |
| `CORS_ALLOWED_ORIGINS` | Список origin через запятую для браузерного API (`server/index.ts`). |
| `CORS_REFLECT_ORIGIN_COMPAT` | `1` — временно отражать Origin при совпадении с allowlist (осторожно). |
| `CSRF_ALLOWED_ORIGINS` | Origin для проверки CSRF на мутациях с сессией. |
| `CSRF_ENFORCE` | `1` — жёсткая проверка Referer/Origin. |
| `UPLOAD_ACCESS_SECRET` | Секрет подписи URL загрузок (иначе `AUTH_TOKEN_SECRET` / `SESSION_SECRET`). |
| `UPLOADS_CHAT_PRIVATE_ENFORCE` / `UPLOADS_VOICE_PRIVATE_ENFORCE` | `1` — принудительно приватные вложения в чате. |
| `SECURITY_AUDIT_DISABLED` | `1` — не писать security audit log. |
| `PHONE_AT_REST_SECRET` | Шифрование телефонов в БД. |
| `NEW_TEL_CALL_PASSWORD_ENABLED`, `NEW_TEL_AUTH_KEY`, `NEW_TEL_SIGN_KEY` | Подтверждение регистрации звонком (New-Tel API); ключи из кабинета провайдера. |
| `REGISTER_REQUIRE_PHONE_CALL_VERIFICATION` | **Не используется приложением** (остаётся в .env только как legacy). Включение звонка при регистрации — **админка → Операции → платформа**. |
| `PG_POOL_MAX` | Размер пула `pg` (`server/db/client.ts`). |
| `ADMIN_LOGIN` / `ADMIN_PASSWORD` | Админка. |
| `FCM_SERVER_KEY` | Пуши (звонок / сообщение). |
| `GOOGLE_APPLICATION_CREDENTIALS`, `FCM_SERVICE_ACCOUNT_JSON`, `FCM_SERVICE_ACCOUNT_B64` | FCM HTTP v1 (см. `.env.example`). |
| `APNS_VOIP_KEY_PATH` или `APNS_VOIP_KEY_P8`, `APNS_VOIP_KEY_ID`, `APNS_TEAM_ID`, `IOS_APP_BUNDLE_ID`, `APNS_VOIP_USE_SANDBOX` | Входящий звонок на iOS через CallKit (`server/push/apns-voip.ts`); задаются в `deploy.env` и уезжают на VPS через `build_server_env`. |
| `OPENROUTER_API_KEY` / `OPENROUTER_MODEL` / `OPENROUTER_TRANSLATE_MODEL` | AI и перевод в чате. |
| `S3_*` | Облачное хранилище медиа (`server/upload/s3.ts`). |
| `CALLS_DEBUG`, `CALLS_DISCONNECT_GRACE_MS`, `CALLS_RING_TIMEOUT_MS`, `CALLS_CALLER_WAIT_MS`, `CALLS_PENDING_TTL_MS` | Звонки 1:1 (сервер). |
| `CALLS_SINGLE_SOCKET_PER_USER` | `1` — один WS на пользователя (`server/calls/ws.ts`). |
| `CALLS_WS_HEARTBEAT_MS` | Интервал ping/pong WS звонков (мс, по умолчанию 30000). |
| `GROUP_CALLS_ENABLED`, `GROUP_CALLS_SERVER_ASR_ENABLED` | Групповые звонки и серверный ASR титров. |
| `CALL_TRANSCRIPTS_ASR_URL` | HTTP Vosk: расшифровка голосовых/видеокружков в чате и (при включённом клиенте) чанки титров группового звонка. |
| `CALL_TRANSCRIPTS_ASR_WS_URL`, `CALL_TRANSCRIPTS_ASR_API_KEY` | Потоковый Vosk WS и опциональный Bearer. |
| `VOSK_ASR_ENABLED=1` | В `deploy.env` / `.env` на VPS: при `server-setup.sh` запускается `scripts/setup-vosk-asr-on-server.sh` (без обязательного `GROUP_CALLS_SERVER_ASR_ENABLED`). |
| `VOICE_MESSAGE_ASR_LANGUAGE` | Язык для расшифровки голосовых в чате (`server/messages/voice-transcribe.ts`). |
| `AI_SEARCH_ENABLED`, `AI_SEARCH_HOT_TTL_HOURS`, `AI_SEARCH_HOT_L1_MS` | AI Search. |
| `FEED_ALGO_MODE`, `FEED_BOOST_*`, `FEED_RANKING_CANDIDATE_*` | Ранжирование (`server/feed/config.ts`). |
| `FEED_REACTION_BOOST_MINUTES`, `FEED_COMMENT_BOOST_MINUTES`, `FEED_SHARE_BOOST_MINUTES` | Бусты в ленте. |
| `FEED_ANTISPAM_VERY_NEW_HOURS`, `FEED_ANTISPAM_NEW_HOURS`, `FEED_ANTISPAM_VERY_NEW_FACTOR`, `FEED_ANTISPAM_NEW_FACTOR` | Антиспам по «возрасту» аккаунта. |
| `FEED_SNAPSHOT_READ_ENABLED`, `FEED_SNAPSHOT_MAX_AGE_SEC` | Чтение снапшота глобальной ленты. |
| `FEED_WORKER_*`, `FEED_WORKER_ONCE` | PM2-воркер снапшота; `FEED_WORKER_ONCE=1` — один прогон и выход. |
| `PINGOK_MICRO_*`, `PINGOK_PM2_NAME` | Отдельный процесс Пингока. |
| `EDGE_*` | Микросервис EDGE + прокси платформы. |
| `EDGE_PRIZE_NOTIFY_USER_ID` | От чьего имени слать ЛС победителям розыгрыша. |
| `PARSER_*`, `VK_PARSER_TOKEN_KEY` | Парсер ВК + секрет internal publish. |
| `DISK_*` | Админка «Диск». |
| `ADMIN_CONTENT_*` | Фоновый контент-ингест. |
| `AUTH_TOKEN_SECRET` | Отдельный секрет JWT (иначе fallback на `SESSION_SECRET`). |
| `BUILD_VERSION` | Строка версии API (`server/routes.ts`); при сборке выставляет `script/build.ts`, на VPS можно задать в `deploy.env`. |
| `BUSINESS_CHAT_MASTER_KEY` | Подпись/идемпотентность бизнес-чата (fallback: `SESSION_SECRET`, `API_HUB_BRIDGE_SECRET`). |
| `PING_INVITE_APP_URL` | Ссылка в шаблоне приглашения EDGE (`server/edge/ping-invite-pack.ts`). |
| `FFMPEG_BIN` | Альтернатива `FFMPEG_PATH` для бинарника ffmpeg (`server/lib/ffmpeg-bin.ts`). |
| `TRANSLATE_DEBUG` | Логи перевода. |
| `PLATFORM_PORT` | Fallback порта платформы для парсера, если не задан `PARSER_PLATFORM_URL` (`PARSER/config/env.ts`). |
| `PARSER_PG_POOL_MAX` | Пул PostgreSQL процесса парсера. |

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
