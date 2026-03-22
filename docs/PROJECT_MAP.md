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

---

## Верхний уровень

```text
client/     React UI, страницы, features, hooks, API adapters (Vite)
server/     Express API, WebSocket (calls, group-calls, realtime), upload, storage
shared/     Схемы Drizzle, общие типы и константы (без runtime-логики приложения)
EDGE/       Отдельный microservice для gamification и game logic (Express + TS)
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
| Лента | `features/feed/` | Компоненты ленты (напр. `FeedHeader`) |
| Посты (обрезка видео и др.) | `features/posts/` | Например `video-trim/` |
| Доска / треки | `features/board/tracks/` | Треки, модалки |
| История звонков в борде | `features/board/call-history/` | Список/деталь, связка с треками |
| Уведомления | `features/notifications/` | Колокол, хуки непрочитанного |
| Админ ops (клиент) | `features/admin-ops/` | Секции платформы, трафик, отчёты, API диска, публичные бары — см. `api.ts`, `i18n.ru.ts` |
| EDGE companion (клиент) | `features/edge-companion/` | UIX-карточка EDGE в ленте + компоненты интерактива персонажа для отдельной страницы |

### Прочее на клиенте

| Путь | Назначение |
|------|------------|
| `components/story-viewer/` + `StoryViewer.tsx` | Просмотр сториз, портал |
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
| Пользователи | `users/` | Профили, подписки, блоки, контакты |
| Закреплённое в профиле | `profile-pins/` | Папки и элементы (пост/сториз), обложки — `routes.ts`, `service.ts` |
| Чаты | `chats/` | Чаты, участники, чтение |
| Сообщения | `messages/` | Лента сообщений, отправка, редактирование |
| Сохранённые сообщения | `saved-messages/` | Избранное в мессенджере |
| AI-чат | `ai-chat/` | Диалог с AI |
| AI Search | `ai-search/` | Поиск, индексация — см. `docs/AI_SEARCH_ALGORITHM.md` |
| ПИНГОК МИКРО (API) | `pingok-micro/` | `routes.ts`: parse, memory-search, **execute**, send-dm; `time-parse.ts`, `execute-service.ts` |
| Напоминания (Пингок) | `reminders/` | `GET /api/reminders/due`, `POST /api/reminders/:id/dismiss` |
| Service Chat | `service-chat/` | Хост-сообщения: шаблоны цепочек after-read, рассылки, локальная/глобальная обратная связь |
| EDGE adapter | `edge/` | Лёгкая интеграция отдельного EDGE-сервиса: прокси `/api/edge/*` без нагрузки на core-модули |
| Посты | `posts/` | Лента, CRUD, просмотры |
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
| Админка | `admin/` | Дашборд, пользователи, аудит, feed, ingest; подпапки `admin/dashboard`, `admin/users`, … |
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
| `call-signaling.ts`, `ws-call-handshake.ts` | Контракты звонков |
| `chat-vibe-types.ts`, `post-media-layout.ts`, `post-video.ts` | Общие типы/утилиты для UI и API |

Правило: в `shared` — только контракты и схемы, не бизнес-оркестрация.

---

## Прочее в репозитории

| Путь | Назначение |
|------|------------|
| `docs/` | Все `.md` гайды; **карта проекта — этот файл** |
| `scripts/` | `deploy.sh`, `run-migrations.cjs`, сиды, миграции данных |
| `ios/`, `android/` | Нативные оболочки Capacitor |
| `uploads/` | Локальные файлы (не коммитить медиа) |
| `ПИНГОК МИКРО/` | Микросервис голосовых команд **в репозитории**: `server/` (Express, NLU), `client/` (оверлей + long-press логотипа), `shared/` типы; `npm run dev:pingok-micro`; секреты только в `.env` (см. `.gitignore` внутри каталога) |
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
| 2026-03 | `migrations/0023_posts_edge_id.sql`, `scripts/migrate-posts-edge-id.cjs`, `server/posts/service.ts` + `routes.ts` | Колонка `edge_id`, `parsePostEdgeId`, выдача в ленте/деталке/сохранённых; `POST /api/posts` принимает `edgeId` |
| 2026-03 | `useChatMessages.ts`, `Chats.tsx`, `ChatMessageRow.tsx`, `message-delivery-status.ts`, `lib/external-video.ts`, `ExternalVideoEmbedCard.tsx`, `server/chats/service.ts` | Чат: стартовый скролл к первому непрочитанному (`myLastReadAt`), единые галочки доставки/прочтения для текста/аудио/кружка; превью YouTube/RuTube/Яндекс по тапу; список чатов: бейдж непрочитанных и сортировка по последнему сообщению |
| 2026-03 | `ПИНГОК МИКРО/` (включён в git), `ПИНГОК МИКРО/.gitignore`, корневой `.gitignore` | Микросервис голоса/оверлея версионируется в репо; `.env` в каталоге не коммитится |

---

## Связанная документация

| Документ | Зачем |
|----------|--------|
| `docs/ARCHITECTURE.md` | Короткий индекс ссылок |
| `docs/API_AUTH_AND_PUBLIC.md` | Авторизация (cookie + Bearer), публичные API, PATCH/PUT |
| `docs/DEV_HANDOFF_CURSOR.md` | Handoff для разработчиков |
| `docs/AI_HANDOFF_ARCHITECTURE.md` | Handoff для ИИ-агента |
| `docs/QUALITY_CHECKLIST.md`, `docs/UIX_SPECIALIST_GUIDE.md` | Качество UI |
| `docs/CHAT_DETAIL_RULES.md` | Контракт хуков чата |
| `docs/DEPLOY_RULES.md` | Деплой |
| `docs/DB.md` | БД и storage |
| `AGENTS.md` | Контекст репозитория для агентов |

---

## Чек перед merge крупных структурных изменений

1. `npm run check` / при необходимости `npm run build`.
2. Обновлён **`docs/PROJECT_MAP.md`** (таблицы + журнал модулей).
3. Нет «тихого» расхождения: новые папки перечислены, удалённые — убраны из карты.
