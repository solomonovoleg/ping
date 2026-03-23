# PING MOOT — полная карта проекта

**Единый документ:** структура репозитория, где искать код, куда класть новое, связанные гайды.

---

## Обязательное правило ведения

**Любой новый модуль** (новая папка в `client/src/features/`, новый домен в `server/`, новый значимый пакет в `shared/`, новый подпроект вроде `server/admin/ops/`) **дописывается в этот файл в том же PR**, в подходящую таблицу или раздел «Журнал модулей».

- Одна строка: **путь**, **назначение**, при необходимости **ссылка на README** внутри модуля.
- Если модуль переименован или удалён — поправить карту в том же PR, что и код.
- Детальные алгоритмы и чеклисты по-прежнему живут в узких документах (`CHAT_DETAIL_RULES.md`, `AI_SEARCH_ALGORITHM.md` и т.д.); здесь только **навигация и границы**.

*При противоречии между этим файлом и кодом приоритет у кода — затем обновить карту.*

---

## Оглавление

1. [Верхний уровень](#верхний-уровень)
2. [Клиент (`client/`)](#клиент-client)
3. [Сервер (`server/`)](#сервер-server)
4. [Общий слой (`shared/`)](#общий-слой-shared)
5. [Прочее в репозитории](#прочее-в-репозитории)
6. [Слои и потоки данных](#слои-и-потоки-данных)
7. [Куда добавлять новый код](#куда-добавлять-новый-код)
8. [Правила модулей и размер файлов](#правила-модулей-и-размер-файлов)
9. [Журнал модулей (дополнять при появлении нового)](#журнал-модулей-дополнять-при-появлении-нового)
10. [Связанная документация](#связанная-документация)
11. [Миграции и деплой (сводка)](#миграции-и-деплой-сводка)

---

## Верхний уровень

```text
client/     React UI, страницы, features, hooks, API adapters (Vite)
server/     Express API, WebSocket (calls, group-calls, realtime), upload, storage
shared/     Схемы Drizzle, общие типы и константы (без runtime-логики приложения)
EDGE/       Микросервис геймификации (Express + TS): `EDGE/server/index.ts` → `dist/edge.cjs`; PM2 только при `EDGE_PM2_ENABLED=1`
ПИНГОК МИКРО/  Отдельный процесс голосового NLU/оверлея (Express), см. README; `npm run dev:pingok-micro`
docs/       Продуктовые и архитектурные документы, гайды
scripts/    Деплой, миграции, сиды
ios/        Capacitor / Xcode
android/    Capacitor / Gradle
```

Знакомство с кодом по порядку: `client` → `server` → `shared` → `docs`.

---

## Клиент (`client/`)

### Корень `client/src/`

| Путь | Назначение |
|------|------------|
| `pages/` | Маршруты (wouter), тонкая сборка: хуки фич + layout |
| `features/` | Доменная логика экранов: hooks, components, utils по сценарию |
| `components/` | Переиспользуемый UI, `ui/` — дизайн-система |
| `contexts/` | Глобальный runtime (напр. `AuthContext`, `CallContext`) |
| `hooks/` | Кросс-фичевые хуки |
| `lib/` | Запросы к API, сокеты, звук, утилиты без тяжёлого UI-state |
| `admin/` | Оболочка админки клиента |

### Features — карта доменов

| Домен | Папка | Назначение |
|--------|--------|------------|
| Чат | `features/chat/` | Сообщения, композер, vibe, pulse-шаблоны (`pulse-template/`), хуки (`hooks/`), вынесенные куски экрана без контракта send/actions — `chat/chat-detail/` |
| Звонки 1:1 | `features/call/` | WebRTC, контроллер, стор, типы, утилиты записи/экрана |
| Групповые звонки | `features/group-call/` | Комната, mesh, UI (`ui/pulse-ai/`), транскрипты, WS URL, флаги |
| Профиль (оболочка PULSE) | `features/profile/pulse-profile/` | `PulseProfileLayout`, тема, layout-блоки |
| Профиль (экран пользователя) | `features/profile/user-profile/` | `useUserProfilePage`, `hooks/`, `model/`, `components/`, `components/profile-pins/` (закреплённое), `i18n.ru.ts` |
| Блокировка пользователя (клиент) | `features/user-blocking/` | Пресеты и API `UserBlockSubmitter`, диалог `UserBlockAlertDialog`, полоса «заблокированы» `BlockedByPeerComposer`; точки входа: чат, профиль, контекст-меню комментария |
| Лента | `features/feed/` | Компоненты ленты (напр. `FeedHeader`) |
| Посты (обрезка видео и др.) | `features/posts/` | Например `video-trim/` |
| Доска / треки | `features/board/tracks/` | Треки, модалки |
| История звонков в борде | `features/board/call-history/` | Список/деталь, связка с треками |
| Уведомления | `features/notifications/` | Колокол, хуки непрочитанного |
| Админ ops (клиент) | `features/admin-ops/` | Секции платформы, трафик, отчёты, API диска, публичные бары — см. `api.ts`, `i18n.ru.ts` |
| EDGE companion (клиент) | `features/edge-companion/` | Лента: `EdgeCompanionFeedCard` → `EdgeCompanionFeedHero` + `EdgeFeedSurfacePager` + **`feed-delight/`** (вход карточки, подсказка свайпа, аура/тап-всплеск в ленте, акцент CTA — только UI); полный экран: Embla в `companion-surfaces/`; `edge-feed-play-state.ts`, `edge-companion-navigation.ts` |
| Настройки — данные | `features/settings/` | Карточка «Данные и память»: кэш медиа, сохранённые сообщения, скачивание JSON (`SettingsDataMemoryCard`); экран `/settings/data` |

### Прочее на клиенте

| Путь | Назначение |
|------|------------|
| `components/story-viewer/` + `StoryViewer.tsx` | Просмотр сториз, портал |
| `components/PostExternalVideoEmbed.tsx`, `PostCaptionInlineParts.tsx`, `lib/post-external-video.ts` | Посты: внешнее видео по ссылке в тексте — превью у видимой карточки (IntersectionObserver), iframe только по тапу; метка провайдера вместо длинного URL |
| `pages/admin/` | Страницы админки, в т.ч. `Disk.tsx` (статистика диска) |

Подробнее про профиль: `client/src/features/profile/user-profile/README.md`.

---

## Сервер (`server/`)

### Регистрация

- Точка входа HTTP/WS: `server/routes.ts` (подключение доменов, static `/uploads`, сессия, shield).
- Bootstrap: `server/index.ts`.

### HTTP-домены (рядом обычно `routes.ts`; часто `service.ts`, при необходимости `repository.ts`, `serializers.ts`)

| Домен | Папка | Назначение |
|--------|--------|------------|
| Авторизация | `auth/` | Сессии, вход |
| Пользователи | `users/` | Профили, подписки, блоки, контакты; `edge-follow-hook.ts` — EDGE XP за первую подписку на автора кампании |
| Закреплённое в профиле | `profile-pins/` | Папки и элементы (пост/сториз), обложки — `routes.ts`, `service.ts` |
| Чаты | `chats/` | Чаты, участники, чтение |
| Сообщения | `messages/` | Лента сообщений, отправка, редактирование |
| Сохранённые сообщения | `saved-messages/` | Избранное в мессенджере |
| AI-чат | `ai-chat/` | Диалог с AI |
| AI Search | `ai-search/` | Поиск, индексация — см. `docs/AI_SEARCH_ALGORITHM.md` |
| ПИНГОК МИКРО (API) | `pingok-micro/` | `routes.ts`: parse, memory-search, **execute**, send-dm, **start-call**; `time-parse.ts`, `execute-service.ts` |
| Напоминания (Пингок) | `reminders/` | `GET /api/reminders/due`, `POST /api/reminders/:id/dismiss` |
| Service Chat | `service-chat/` | Хост-сообщения: шаблоны цепочек after-read, рассылки, локальная/глобальная обратная связь |
| EDGE adapter | `edge/` | Прокси `/api/edge/*`; participant task/follow-reward; **creator:** `GET /api/edge/my-campaigns`, `POST/GET/PATCH /api/edge/creator/campaigns` (+ `:edgeId`) |
| Посты | `posts/` | Лента, CRUD, просмотры; `edge-task-hook.ts` — фоновый EDGE XP за view/react/share при `edge_id` |
| Лента (ранг + снапшот) | `feed/`, `feed-worker/` | `feed/config.ts`, `rank-global-public-feed.ts`, `load-global-feed-page.ts`, `snapshot-store.ts`; воркер пересчитывает `feed_global_snapshot`, API читает готовый порядок |
| Комментарии | `comments/` | Комментарии к постам |
| Реакции | `reactions/` | Реакции на посты |
| Сториз | `stories/` | Сториз, просмотры |
| Уведомления | `notifications/` | Пуш/лента уведомлений |
| Рефералы | `referrals/` | Реферальная логика |
| Звонки 1:1 (HTTP) | `calls/` | Токены и HTTP-часть; WS — `calls/ws.ts` |
| Групповые звонки | `group-calls/` | HTTP + отдельный WS transport (подключается из `routes.ts`) |
| Транскрипты звонков | `call-transcripts/` | Сохранение/выдача транскриптов |
| Треки (борд) | `tracks/` | Треки и сообщения из чатов |
| Орфография | `spellcheck/` | Проверка орфографии |
| Превью ссылок | `link-preview/` | Разбор URL |
| Перевод | `translate/` | Перевод сообщений |
| Vibe чата | `vibe/` | Темы/вайб чата |
| Админка | `admin/` | Дашборд, пользователи, аудит, feed, ingest; **парсер ВК** — UI `features/admin-vk-parser/`, прокси `admin/vk-parser`, микросервис **`PARSER/`** |
| Ops (платформа) | `admin/ops/` | Публичные/админские HTTP для платформы, отчёты, traffic shield, **диск** (`disk-stats.service.ts`, `disk.admin-http`) — см. `server/admin/ops/README.md` |

### Загрузки файлов

| Путь | Назначение |
|------|------------|
| `upload/voice.ts`, `post-media.ts`, `story-media.ts`, `chat-media.ts`, `avatar.ts`, `cover.ts` | Эндпоинты загрузки в `uploads/` |

### Инфраструктура сервера

| Путь | Назначение |
|------|------------|
| `db/` | Подключение Drizzle, ensure-колонок/схем |
| `storage/` | `IStorage`, `DbStorage`, `MemStorage`, общий доступ к данным |
| `realtime/chat.ts` | Подписки на чаты, fanout событий |
| `middleware/` | Напр. `api-shield.ts` |
| `admin/telemetry.ts` | Телеметрия модулей API |

---

## Общий слой (`shared/`)

| Путь | Назначение |
|------|------------|
| `schema/` | Таблицы Drizzle и zod/insert-схемы: `users`, `chats`, `messages`, `posts`, `stories`, `profile-pins`, `user-reminders`, `voice-tasks`, `service-chat`, `notifications`, `tracks`, `platform-settings`, `content-reports`, … |
| `schema/index.ts` | Реэкспорт схем |
| `constants.ts` | Общие константы |
| `edge-task-preset-config.ts` | Пресеты заданий EDGE: типы и парсинг `taskPresets` / `verify` (платформа + EDGE) |
| `call-signaling.ts`, `ws-call-handshake.ts` | Контракты звонков |
| `chat-vibe-types.ts`, `post-media-layout.ts`, `post-video.ts` | Общие типы/утилиты для UI и API |

Правило: в `shared` — только контракты и схемы, не бизнес-оркестрация.

---

## Прочее в репозитории

| Путь | Назначение |
|------|------------|
| `docs/` | Все `.md` гайды; **карта проекта — этот файл** |
| `scripts/` | `deploy.sh`, `backup-project.sh` (`npm run backup` → `backups/*.tar.gz`), **`run-migrations.cjs`** (цепочка основной БД — см. **`docs/MIGRATIONS_AND_DEPLOY_CHECKLIST.md`**), сиды, `migrate-*.cjs` |
| `ios/`, `android/` | Нативные оболочки Capacitor |
| `uploads/` | Локальные файлы (не коммитить медиа) |
| `ПИНГОК МИКРО/` | Микросервис голосовых команд **в репозитории**: `server/` (Express, NLU), `client/` (`PingokMicroOverlay`: STT, parse, поиск в памяти, лента, remind/plan/task, сообщение, звонок; `NavPulseCenterLogoButton` — long-press в `AppLayout`, реэкспорт из `@pingok-micro`, **не заглушать**), `shared/` типы; `npm run dev:pingok-micro`; секреты только в `.env` (см. `.gitignore` внутри каталога) |
| `EDGE/` | Отдельный микросервис геймификации: модульные `rules/service/routes`, свой запуск `npm run dev:edge`, UIX-подбор `EDGE/docs/GAMIFICATION_UIX_GITHUB.md`, **спека движка кампаний** `EDGE/docs/EDGE_ENGINE_ARCHITECTURE.md` |

База данных (смысл таблиц, слой storage): `docs/DB.md`.

---

## Слои и потоки данных

### HTTP

1. UI вызывает функции из `client/src/lib/*`.
2. Запрос на `server/<domain>/routes.ts`.
3. Route вызывает `service` / `repository` / `storage`.
4. Ответ как DTO → клиент обновляет кэш / состояние.

### Чат realtime

1. `useCall` держит WebSocket `/calls`.
2. Подписка на чат: `subscribeChat(chatId, cb)`.
3. Сервер: `server/realtime/chat.ts`.
4. События: сообщения, typing, список чатов и т.д. — локальный fanout и invalidate.

### Звонки 1:1

1. Токен: `/api/calls/token`.
2. WS `wss://…/calls` с протоколом `ping.call.v1` + токен.
3. Signaling → WebRTC (`simple-peer` на клиенте).

*(Детали и планы улучшений: `docs/CALL_REALTIME_IMPROVEMENT_PLAN.md`, `docs/CALLS_GROUP.md`.)*

---

## Куда добавлять новый код

| Что | Куда |
|-----|------|
| Новый экран | `client/src/pages/` |
| Сценарий экрана | `client/src/features/<домен>/` |
| Общий UI | `client/src/components/` или `components/ui/` |
| API-клиент, хелперы | `client/src/lib/` |
| Новый HTTP-домен | `server/<домен>/routes.ts` + `service.ts` и при необходимости `repository.ts`, `serializers.ts` |
| Общая схема/тип | `shared/schema/` или корень `shared/` |
| Новая таблица БД | `shared/schema/` + миграция / `db:push` по принятому процессу |

---

## Правила модулей и размер файлов

1. **Страница = проводка:** в `pages/*` не держать тяжёлую бизнес-логику — только хуки фич и JSX.
2. **Импорты:** фича может тянуть `lib/*` и общие компоненты; избегать циклов `features/A` ↔ `features/B`.
3. **Чистые функции** (парсинг API, derived поля) — в `model/` или `utils/` рядом с фичей.
4. **Локализация по фиче:** для новых зон — `i18n.ru.ts` внутри папки фичи (пока нет глобального i18n).
5. **Порог ~500 строк** в одном файле — сигнал вынести подмодули (хуки, компоненты, секции).

Пересчёт крупнейших файлов клиента:

```bash
cd client/src && wc -l $(find . \( -name '*.ts' -o -name '*.tsx' \)) | sort -n -r | head -40
```

---

## Журнал модулей (дополнять при появлении нового)

*Добавляйте строки с датой или PR по желанию. Старые строки не удалять без удаления кода.*

| Дата / PR | Модуль (путь) | Назначение |
|-----------|---------------|------------|
| (начало карты) | `docs/PROJECT_MAP.md` | Единая карта проекта; правило — обновлять при новых модулях |
| | `client/src/features/chat/chat-detail/` | UI без логики хуков; композер и превью медиа: полосы, вложения, орфография, **`ChatDetailVoicePreviewModal`**, **`ChatDetailVideoNoteModal`** (+ список, меню, AI) |
| | `client/src/features/admin-ops/` | Клиентские секции ops-платформы, `fetchOpsDisk` |
| | `server/admin/ops/` | HTTP ops: платформа, отчёты, traffic shield, диск (`GET /api/admin/ops/disk`) |
| 2026-03 | `server/admin/ops/disk-stats.service.ts`, `host-snapshot.ts`, `disk.admin-http.ts`, `client/src/pages/admin/Disk.tsx` | Админка: объём медиа по типам, БД, statfs; RAM/CPU и размер папки проекта относительно тома и проекта |
| 2026-03 | `migrations/0019_chat_member_prefs.sql`, `shared/schema/chat-member-prefs.ts`, `server/chats/*`, `client/src/pages/Chats.tsx`, `ChatDetailLifecycleSection.tsx` | Список чатов: закрепить/скрыть/полки, долгое нажатие, скрытые (pull-hold), удалить у себя/у всех; API `PATCH/DELETE .../me`, `DELETE .../for-all` |
| | `server/ai-search/` | AI Search бэкенд |
| | `shared/schema/platform-settings.ts`, `content-reports.ts` | Платформа и репорты контента |
| | `server/profile-pins/`, `shared/schema/profile-pins.ts`, `client/src/lib/profile-pins.ts`, `client/.../profile-pins/` | Закреплённое на профиле: папки, посты/сториз, обложки; миграция `migrations/0016_profile_pins.sql` |
| | `client/src/lib/profile-cover-editor.ts`, `client/src/components/ProfileCoverAdjustModal.tsx` | Редактор обложки профиля: сетка, pan/zoom, экспорт JPEG; экран «Редактировать профиль» |
| | `client/src/lib/avatar-square-crop.ts` | Утилиты квадратного кропа аватара (профиль сквиркл / чаты круг); `AvatarCropModal` |
| 2026-03 | `server/security/ssrf-guard.ts` | Базовая защита от SSRF для исходящих fetch по пользовательскому URL (сейчас — link-preview) |
| 2026-03 | `client/src/lib/reels-video/` | Бесшовный цикл видео (`useSeamlessVideoLoop`), жесты ленты: двойной тап, удержание ×2 / сдвиг вверх ×3 (`useReelsFeedVideoGestures`); `FeedInlineVideo`, аватар-видео |
| 2026-03 | `ПИНГОК МИКРО/`, `server/pingok-micro/routes.ts` | Голос: оверлей + long-press в `AppLayout`; `POST /api/pingok-micro/v1/parse` + `POST .../v1/memory-search` (`tryGlobalMemorySearch`); интенты find/show — поиск в оверлее и переход в чат/пост; `shared/parse-heuristic.ts`; опционально отдельный процесс `POST /v1/parse` |
| 2026-03 | `server/reminders/`, `migrations/0021_user_reminders_voice_tasks.sql`, `usePingokRemindersPoll` | Напоминания и задачи Пингок: таблицы `user_reminders`, `voice_tasks`; `POST /api/pingok-micro/v1/execute` + `send-dm`; опрос due + тост в `AppLayout` |
| 2026-03 | `server/service-chat/`, `shared/schema/service-chat.ts`, `migrations/0022_service_chat.sql`, `client/src/pages/admin/ServiceChat.tsx` | Service Chat: выбор хоста, шаблонные цепочки after-read для новых пользователей, рассылки all/selected/personal, папка `Приглашения`, глобальная и локальная обратная связь |
| 2026-03 | `client/src/lib/chat-offline-store.ts`, `client/src/lib/media-offline-cache.ts`, `client/src/hooks/useOfflineResolvedMediaUrl.ts` | Android/offline: локальный кеш списка чатов, последних сообщений и уже просмотренных медиа; резолв локального media URL для офлайн-открытия |
| 2026-03 | `EDGE/`, `server/edge/`, `client/src/lib/edge-gamification.ts` | Новый изолированный EDGE микросервис (gamification/game logic) + тонкий адаптер `/api/edge/*` в основной платформе; модуль `companion` с состоянием персонажа, заданиями и лидербордом |
| 2026-03 | `EDGE/docs/EDGE_ENGINE_ARCHITECTURE.md` | Архитектура движка: кампании, surfaces, задания (EDGE + platform), лидерборд, призы/итоги, Board создателя, эволюция под новые UI (каталог) |
| 2026-03 | `client/src/features/edge-companion/`, `client/src/pages/EdgeCompanion.tsx`, `client/src/pages/Posts.tsx` | EDGE в ленте: блок кампании в теле поста (`posts.edge_id`), те же метрики что у обычного поста; `MeasuredFeedItem` + `recordPostView` при скролле; экран `/edge/companion` |
| 2026-03 | `GET /api/edge/companion/campaign-config`, `client/src/lib/edge-gamification.ts` | Клиент `fetchEdgeCompanionCampaignConfig`; прокси на EDGE, без upstream — `503` (`edge_upstream_not_configured` / `edge_companion_unavailable`) |
| 2026-03 | `docs/EDGE_MICROSERVICE_PLAN.md` | План выноса EDGE в отдельный микросервис (`EDGE/`, своя БД, роутеры по подпапкам, файлы ≤200 строк, билд в `dist/edge.cjs`, PM2, прокси с платформы) |
| 2026-03 | `docs/EDGE_PRODUCT_SPEC.md` | Продукт EDGE: тип интерактивного контента на борде; типы (персонаж, рулетка, каталог, квиз, квест, челлендж); создатель/участники; задания (персонаж/глобальные/коммерческие); баллы, лидерборд, гибкие призы и выдача в ЛС через платформу |
| 2026-03 | `EDGE/campaign/*`, `EDGE/migrations/0003_edge_prize_winners.sql`, `POST /v1/campaign/draw`, `server/admin/edge-prize.routes.ts` | Розыгрыш: случайные победители среди участников (исключая уже награждённых по `gift_key`), `edge_prize_winners`; платформа `POST /api/admin/edge/draw-prize` + ЛС победителям |
| 2026-03 | `client/src/features/edge-companion/edge-uix.ts` | Токены поверхностей EDGE Companion: `EDGE_CARD`, `EDGE_INSET`, чипы и кнопки в стиле `--uix-*` / `primary`, без «радужных» градиентов вне системы |
| 2026-03 | `EDGE/participant/leaderboard` + `interact`, `client/.../EdgeLeaderboardCard.tsx` | Лидерборд по XP (JOIN participants + character_states), ранг «я» через `ROW_NUMBER`; действия `play`/`pet` (+XP/+happy, кулдаун 4 ч в `extra`); прокси `/api/edge/participant/leaderboard`, `/interact` |
| 2026-03 | `EDGE/participant/character-rules.ts`, `repo.ts`, `service.ts` | Логика персонажа: decay happy, mood, streak по `extra.lastFedYmd`, `careDeadlineAt`; платформа без заглушек — только прокси или 503 |
| 2026-03 | `EDGE/` (`server/`, `config/`, `health/`, `companion/`, `participant/`, `middleware/`, `db/`, `migrations/`), `dist/edge.cjs`, `server/edge/upstream-client.ts` | Микросервис; БД: `edge_campaigns`, `edge_participants`, `edge_character_states`; API участника; платформа: `GET/POST /api/edge/participant/*` (requireAuth) + прокси; UI Companion: `EdgeParticipantPetCard`, `EdgePetVisualCluster`, `EdgePetStatsPanel`, `edge-pet-display-helpers.ts` |
| 2026-03 | `docs/EDGE_DATABASE.md` | Отдельная БД EDGE, миграции, поле `public_id` = `posts.edge_id` |
| 2026-03 | `migrations/0023_posts_edge_id.sql`, `scripts/migrate-posts-edge-id.cjs`, `server/posts/service.ts` + `routes.ts` | Колонка `edge_id`, `parsePostEdgeId`, выдача в ленте/деталке/сохранённых; `POST /api/posts` принимает `edgeId` |
| 2026-03 | `EDGE/migrations/0004_edge_task_grants.sql`, `EDGE/tasks/`, `POST /v1/participant/task`, `server/edge/call-participant-task.ts`, `server/posts/edge-task-hook.ts`, `server/reactions/routes.ts` | Задания ленты: идемпотентный XP за просмотр/реакцию/шаринг поста с `edge_id`; прокси `POST /api/edge/participant/task` |
| 2026-03 | `EDGE/tasks/preset-tasks-parse.ts`, `apply-preset-task.ts`, `taskPresets` в `campaign-config`, `BoardEdgeNew` (ключи `game_*`/`global_*`/`commercial_*`), `EdgePresetTasksCard.tsx`, `postEdgeParticipantTask` | Пресеты из мастера: XP по `config_json.taskPresets`, дедуп `edge_task_grants`, срок от `joined_at`, UI «Получить XP» в Companion |
| 2026-03 | `shared/edge-task-preset-config.ts`, `server/edge/verify-preset-platform.ts`, `companion-preset-from-response.ts`, поле `verify` в пресетах, `creatorPlatformUserId` в campaign-config | Проверка пресетов: платформа (follow / react / comment к посту с `edge_id`), EDGE (min level/xp/streak); без проверки — `verify.type: honor` |
| 2026-03 | `EDGE/participant/game-script-metrics.ts`, `shared/edge-task-preset-config.ts` (`edge_game_*`, `ping_*`), `BoardEdgeNew` (скрипты по scope), `EdgeParticipantPetCard` (tap/toilet/calm) | Скрипты заданий: счётчики за UTC-день и серия заходов в `character.extra`; глобальные проверки PING (рефералы, посты, профиль, комменты, реакции); UI мастера и компаньона |
| 2026-03 | `docs/MIGRATIONS_AND_DEPLOY_CHECKLIST.md`, `scripts/run-migrations.cjs` (+ `migrate-users-columns.cjs`) | Единая памятка: три контура миграций; в цепочку добавлен пропущенный скрипт колонок `users` (модерация) |
| 2026-03 | `EDGE/follow-reward/`, `follow_creator`, `POST /v1/participant/follow-reward`, `server/edge/call-follow-reward.ts`, `server/users/edge-follow-hook.ts`, `storage.addFollow` → boolean | Награда за подписку: XP при первой подписке на создателя кампании с `follow_reward_enabled`; прокси `POST /api/edge/participant/follow-reward` |
| 2026-03 | `client/src/features/edge-companion/edge-companion-navigation.ts`, `docs/EDGE_PRODUCT_SPEC.md` §8, `AGENTS.md` | EDGE как пост: соц.метрики платформы; Companion `back` → лента или страница поста в профиле |
| 2026-03 | `EDGE/companion/campaign-ui-config.ts`, `companionUi` в campaign-config, `client/.../companion-surfaces/*`, Embla pager | Полноэкранный Companion: свайп-разделы, порядок из `config_json.companion.surfaceOrder`, статья/итоги в JSON |
| 2026-03 | `EdgeCompanionFeedHero.tsx`, `EdgeFeedSurfacePager.tsx`, `EdgeFeedCharacterSlide.tsx`, `render-feed-slide.tsx`, `edge-feed-play-state.ts` | EDGE в посте: горизонтальные экраны как у companion; новичок (нули + призыв) vs прогресс; CTA «Начать игру» / «Вернуться в игру»; `touch-pan-x` + capture `stopPropagation` чтобы не цеплять свайп вкладок с краёв |
| 2026-03 | `client/src/features/edge-companion/feed-delight/*`, `feed-delight/index.ts`, `index.css` (`.edge-feed-*`) | Полировка UI: entrance карточки (`variant=feed`), `build-swipe-hint` + строка под точками в ленте и в `CompanionSurfacePager`, аура/«Ещё тап!»/подарок в ленте, пульс CTA; `EdgeCompanionFeedCard` default `feed`, `banner` без entrance; `ARCHITECTURE.md` |
| 2026-03 | `EdgeCompanionCharacterHero.tsx`, `EdgeParticipantPetCard.tsx`, `/edge/:edgeId`, `edge-companion-navigation.ts` | Companion: короткий URL `/edge/{edgeId}?back=` + редирект с `/edge/companion?edgeId=`; экран персонажа без карточек у метрик; облако — одна фраза настроения; одна оранжевая CTA + «Ещё действия» (меню) |
| 2026-03 | `EDGE/companion/prize-results-repo.ts`, `build-results-live.ts`, `resultsLive` в campaign-config; `EDGE/campaign/companion-config-update.ts`, `POST /v1/campaign/companion-config`; `server/admin/edge-companion-admin.routes.ts`; `client/.../admin/EdgeCompanion.tsx` | Итоги розыгрыша из `edge_prize_winners`; админка JSON для `companion` |
| 2026-03 | `useChatMessages.ts`, `Chats.tsx`, `ChatMessageRow.tsx`, `message-delivery-status.ts`, `lib/external-video.ts`, `ExternalVideoEmbedCard.tsx`, `server/chats/service.ts` | Чат: стартовый скролл к первому непрочитанному (`myLastReadAt`), единые галочки доставки/прочтения для текста/аудио/кружка; превью YouTube/RuTube/Яндекс по тапу; список чатов: бейдж непрочитанных и сортировка по последнему сообщению |
| 2026-03 | `EDGE/creator/` (`campaign-mutate-repo`, `merge-creator-config`, `POST/PATCH/GET` campaigns), `BoardEdgeNew.tsx` (мастер), `edge-creator.ts`, `server/edge/routes.ts` | Создание/редактирование кампании с Борда; `companion.character` + PNG в Companion; пост с `?edgeId=` |
| 2026-03 | `EDGE/follow-reward/follow-dm-config.ts`, `server/users/edge-follow-dm-sender.ts`, `call-follow-reward.ts` | Авто-ЛС подписчику от создателя по `followRewardDm` после первого follow |
| 2026-03 | `EDGE/campaign/draw-eligible.ts`, `prize-rules-parse.ts`, `gifts-parse` quantity, `companion/interact-lock.ts` | Розыгрыш: топ-N пул, first/random, лимит призов; блокировка interact по статусу/дате |
| 2026-03 | `ПИНГОК МИКРО/` (включён в git), `ПИНГОК МИКРО/.gitignore`, корневой `.gitignore` | Микросервис голоса/оверлея версионируется в репо; `.env` в каталоге не коммитится |
| 2026-03 | `script/build.ts` → `dist/pingok-micro.cjs`, `ecosystem.config.cjs`, `scripts/deploy.sh`, `docs/DEPLOY.md` | Деплой: второй процесс PM2 `pingok-micro` (порт 3091), переменные `PINGOK_MICRO_*` из deploy.env; nginx-префикс для SPA |
| 2026-03 | `client/src/features/user-blocking/`, `server/users/routes.ts` (`note` + явные флаги), `server/chats/service.ts` (`blockedByOther`), `server/calls/ws.ts` (отказ звонка при `restrictChat`), `CommentsModal`, `UserProfile`, `ChatDetail` | Блокировка: пресеты чат/соц/полная, опциональный комментарий для заблокированного; после блока из DM — вопрос «удалить чат у себя»; у заблокированного — плашка и отключены композер и звонки |
| 2026-03 | **`PARSER/`** (`server/index`, `http/v1-router`, `storage/repo`, `parser/*`, `migrations/`), `dist/parser.cjs`, `server/parser/proxy.ts`, `server/internal/parser-publish.ts`, `shared/schema/vk-parser.ts`, `admin/vk-parser` | Микросервис парсера ВК (отдельный процесс, порт `PARSER_PORT`); платформа: прокси админки + `POST /internal/parser/publish` (секрет `PARSER_SERVICE_SECRET`); БД общая с платформой; `PARSER_UPSTREAM_URL` на платформе |
| 2026-03 | `client/src/features/admin-vk-parser/`, `pages/admin/VkParser.tsx` | UI админки парсера ВК: карточки, диалоги, хуки данных/мутаций; страница — re-export; UIX: скелетоны, AlertDialog удаления, keepPreviousData + баннер обновления, a11y, TapScale + хаптик на CTA; очередь: `VkParserQueueAnimatedList` (`AnimatePresence` + `motion.li`, `prefers-reduced-motion` → статический список) |
| 2026-03 | `PARSER/parser/admin-service-bindings.ts`, `admin-service-items.ts`, `admin-service-run.ts`, `parser/service.ts` | Админ-логика парсера разнесена; `service.ts` только re-export для `http/v1-router` |
| 2026-03 | `client/src/features/settings/`, `client/src/pages/SettingsData.tsx`, `client/src/lib/user-data-export.ts`, `server/users/privacy-export.ts`, `GET /api/users/me/data-export`, `dataExportLimiter` | Экран `/settings/data`; выгрузка JSON (профиль, подписки, чаты с участниками, избранные сообщения, посты до лимита, id сохранённых постов); клиент скачивает файл с `Content-Disposition` |
| 2026-03 | `migrations/0030_dm_scheduled_calls.sql`, `shared/schema/dm-scheduled-calls.ts`, `server/storage/*`, `server/pingok-micro/execute-service.ts`, `server/chats/routes.ts` (`GET/POST .../pingok-scheduled-call`), `client/src/features/pingok/`, `client/src/lib/pingok-scheduled-call.ts` | Пингок: при однозначном контакте запланированный звонок — строка `dm_scheduled_calls`, баннер в `ChatDetail` (личка), скрытие у себя или у обоих, автоскрытие через 5 мин после времени; тост «скоро звонок» в окне чата в интервале за 5 мин до события; голосовая задача «в трек … — …» пишет в существующий трек (скрытый групповой чат `__pingok_track_src`) |
| 2026-03 | `server/pingok-micro/time-parse.ts` (перенос/отмена звонка), `execute-service.ts`, `routes.ts` (`confirm-schedule-call`, `scheduled-calls-pre-window`), `usePingokScheduledCallsPreEventPoll.tsx` | Пингок «как у колонок»: перенос/отмена запланированного звонка голосом; выбор контакта при нескольких совпадениях при планировании; глобальный тост за 5 мин до звонка; синхронизация `user_reminders` при переносе |
| 2026-03 | `migrations/0031_feed_global_snapshot.sql`, `server/feed/*`, `server/feed-worker/index.ts`, `dist/feed-worker.cjs`, `ecosystem.config.cjs` (`FEED_WORKER_PM2_ENABLED`) | Глобальная лента: воркер пишет снапшот порядка в `feed_global_snapshot`; `GET /api/posts` без hashtag/q читает готовый список + фильтр блокировок, без ранжирования на запросе; fallback при отсутствии/протухшем снапшоте |
| 2026-03 | `client/src/components/PostExternalVideoEmbed.tsx`, `PostCaptionInlineParts.tsx`, `lib/post-external-video.ts`, `lib/external-video.ts` (VK), `Posts.tsx`, `PostDetail.tsx`, `UserProfilePostsContent.tsx`, `ExternalVideoEmbedCard.tsx` | Посты: первая ссылка YouTube/RuTube/VK/Яндекс в тексте — полноширинная карточка 16:9 с превью (YouTube — постер CDN; остальное — ленивый `GET /api/link-preview` у видимой карточки), iframe после тапа; только ссылка — без дублирующей подписи; VK — кнопка «Смотреть в ВКонтакте» без iframe |
| 2026-03 | `client/src/features/call/call-ice-config.ts`, `scripts/pre-deploy-check.sh`, `docs/CALLS_TURN_SETUP.md` | WebRTC TURN: `getIceServers()` из `VITE_TURN_*` (креды только пара username+credential); pre-deploy — напоминание без TURN и предупреждение при неполной паре кредов; анонимный TURN без предупреждения |
| 2026-03 | `server/calls/ws.ts` (`closeExistingCallSocketsForUser`, очередь `messageChain` на сокет), `client/src/lib/realtime-socket-transport.ts`, `docs/CALLS_RELIABILITY.md` | Звонки: один `/calls` WS на пользователя; сериализация входящих сообщений (иначе `call.offer` до завершения async `call.invite` → сессии нет, SDP теряется); клиент — `wsRef`/двойной сокет; сводка инвариантов |
| 2026-03 | `server/service-chat/service.ts` (`processServiceChatQueue`) | Service-chat: исправлен `UPDATE … FROM due JOIN …` — в PostgreSQL нельзя ссылаться на алиас **целевой** строки `UPDATE` внутри цепочки `FROM`; join к `thread`/`steps` через `service_chat_step_states base` |
| 2026-03 | `client/src/lib/call-audio-route.ts`, `CallModal.tsx`, `call-controller.ts`, `ios/.../CallAudioRoutePlugin.swift`, `android/.../CallAudioRoutePlugin.java` | Голосовой звонок в приложении: по умолчанию громкая связь, кнопка переключения на разговорный динамик (Capacitor-плагин `CallAudioRoute`); в браузере кнопка скрыта |
| 2026-03 | `server/calls/session.ts` (`findRingingSessionBetween`), `server/calls/ws.ts`, `docs/CALLS_EDGE_CASES.md` | Invite после await: защита от двух почти одновременных `call.invite` между парой A↔B; документ по краевым сценариям звонка |
| 2026-03 | `server/calls/session.ts`, `server/calls/ws.ts`, `client/src/lib/realtime-socket-transport.ts`, `client/src/features/call/call-controller.ts`, `client/src/components/CallModal.tsx`, `docs/CALLS_1TO1_RELEASE_CHECKLIST.md` | Hardening 1:1: идемпотентный lifecycle `hangup/cancel`, call-route для multi-socket, reconnect backoff+jitter+circuit-breaker, фиксированные статусы UI и единый pre-release чеклист |
| 2026-03 | `docs/ENV_REFERENCE.md`, `scripts/deploy.sh` (`build_server_env`), `.env.example`, `deploy.env.example` | Аудит env: справочник; в серверный `.env` при деплое добавлены ранее «терявшиеся» ключи (сессия, пул PG, AI Search, FEED*, PARSER*, DISK*, ADMIN_CONTENT*, EDGE_PRIZE_*, VOICE_MESSAGE_ASR_LANGUAGE и др.); исправлено имя `VITE_CALLS_ACCEPT_TIMEOUT_MS` в `.env.example` |

---

## Миграции и деплой (сводка)

Полный порядок миграций **основной БД**, **EDGE**, **PARSER**, что делает `deploy` / `server-setup.sh`, и чеклист после многих PR — в **`docs/MIGRATIONS_AND_DEPLOY_CHECKLIST.md`**.

---

## Связанная документация

| Документ | Зачем |
|----------|--------|
| `docs/MIGRATIONS_AND_DEPLOY_CHECKLIST.md` | Три контура миграций + порядок `run-migrations.cjs` + чеклист |
| `docs/ARCHITECTURE.md` | Короткий индекс ссылок |
| `docs/API_AUTH_AND_PUBLIC.md` | Авторизация (cookie + Bearer), публичные API, PATCH/PUT |
| `docs/DEV_HANDOFF_CURSOR.md` | Handoff для разработчиков |
| `docs/AI_HANDOFF_ARCHITECTURE.md` | Handoff для ИИ-агента |
| `docs/QUALITY_CHECKLIST.md`, `docs/UIX_SPECIALIST_GUIDE.md` | Качество UI |
| `docs/CHAT_DETAIL_RULES.md` | Контракт хуков чата |
| `docs/DEPLOY_RULES.md` | Деплой |
| `docs/CALLS_TURN_SETUP.md` | Coturn / TURN для звонков (`VITE_TURN_*`, проверка бандла) |
| `docs/CALLS_RELIABILITY.md` | Звонки 1:1: инварианты (один WS на пользователя, порядок accept/offer), чеклист регрессий |
| `docs/CALLS_EDGE_CASES.md` | Звонки 1:1: дубли сокетов/хуков, glare, обрыв связи, перезагрузка страницы |
| `docs/CALLS_1TO1_RELEASE_CHECKLIST.md` | Smoke/regression чеклист 1:1 перед релизом (happy path, redial, glare, ws drop, multi-tab) |
| `docs/ENV_REFERENCE.md` | Сводка `VITE_*` / серверных env, что копирует `deploy.sh` в `.env` на VPS |
| `docs/DB.md` | БД и storage |
| `docs/EDGE_PRODUCT_SPEC.md`, `docs/EDGE_MICROSERVICE_PLAN.md`, `docs/EDGE_DATABASE.md`, `docs/EDGE_FUNCTIONAL_ROADMAP.md` | Продукт, план, БД и пошаговый функционал EDGE |
| `AGENTS.md` | Контекст репозитория для агентов |

---

## Чек перед merge крупных структурных изменений

1. `npm run check` / при необходимости `npm run build`.
2. Обновлён **`docs/PROJECT_MAP.md`** (таблицы + журнал модулей).
3. Нет «тихого» расхождения: новые папки перечислены, удалённые — убраны из карты.
