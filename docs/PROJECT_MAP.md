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
api-hub/    Отдельный интеграционный API HUB (OAuth, chat API, realtime, webhooks, SDK); гайд для внешних сервисов: `api-hub/docs/EXTERNAL_SERVICE_AUTH_GUIDE.md`
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
| Чат: таблица из буфера | `features/chat/message-table/` | Сетка → inline \`\`\`table или файл CSV/XLSX (\`LargeTablePasteDialog\`); сервер chat-media + \`parse-chat-file-message-content\` для PDF/CSV/XLSX |
| Стикеры (чат) | `features/stickers/`, `client/src/lib/stickers.ts`, `server/stickers/`, `pages/SettingsStickers.tsx` | Наборы в S3 как WebP (до 512px), личные/публичные, поиск публичных в панели чата, тип сообщения `sticker` |
| Звонки 1:1 | `features/call/` | WebRTC, контроллер, стор, типы, утилиты записи/экрана |
| Групповые звонки | `features/group-call/` | Комната, mesh, UI (`ui/pulse-ai/`), транскрипты, WS URL, флаги |
| Профиль (оболочка PULSE) | `features/profile/pulse-profile/` | `PulseProfileLayout` / `PulseProfileLayoutInner`, `layout/hooks/usePulseProfileLayoutScroll`, `pulse-profile-meta-line`, секции layout; счётчики в герое: `StatCounter` + `pulse-stat-counter-math`, `useCountUp`, `PulseStatCounterFigures`, `PulseStatCounterSurface` (`memo`); карточка поста (`PulseProfilePostCard*`, `PulseProfileThemedPostCard`); вкладки, обложка, герой, identity |
| Профиль (экран пользователя) | `features/profile/user-profile/` | `useUserProfilePage`, `hooks/` (`useUserProfilePostMutations`, `useUserProfileStoryHighlightOpener`), `model/`, `components/` (в т.ч. `UserProfilePulse*`, `UserProfilePostsFeedSlot`, `UserProfileBlockedByPeerBanner`, `UserProfileStoryFileInput`, `UserProfileStoryViewerLayer`, `UserProfileChromeSheets`, `UserProfileMediaAndCommentsModals`), `components/profile-pins/`, `i18n.ru.ts` |
| Блокировка пользователя (клиент) | `features/user-blocking/` | Пресеты и API `UserBlockSubmitter`, диалог `UserBlockAlertDialog`, полоса «заблокированы» `BlockedByPeerComposer`; точки входа: чат, профиль, контекст-меню комментария |
| Стор-модерация UGC (блок 1) | `features/store-moderation/block-01-ugc/` | Жалобы в `POST /api/reports`: `ReportContentDialog`, пресеты причин; цели `post` / `user` / `message` / `story` / **`comment`**; интеграции в чат, ленту, пост, профиль, сториз, **модалку комментариев** |
| Админ: хаб «Модерация» | `features/admin-moderation/` | **`/admin/moderation`**: карточки входа в Операции, подразделы Apple и **Google Play**; один пункт меню (подсветка на дочерних маршрутах) |
| Стор-модерация: юридика (блок 2) | `features/store-moderation/block-02-legal/` | Публичные **Условия** (`TermsPage`, `terms-body/`), **политика** (`PrivacyBody`, `privacy-body/`), `LegalDocumentShell`, `LegalDocLink`, `/privacy` и `/terms`; `lib/legal.ts`, `lib/legal-navigation.ts` |
| Стор-модерация: админка App Review (блок 3) | `features/store-moderation/block-03-app-store-admin/` | Раздел **`/admin/store-review`**: цитата Apple §1.2 (UGC), чеклист, шаблон Review Notes; ссылка на «Операции» (жалобы) |
| Стор-модерация: Privacy / Connect (блок 4) | `features/store-moderation/block-04-app-privacy-connect/` | Раздел **`/admin/store-review-privacy`**: удаление аккаунта (требование Apple), App Privacy Details, export compliance, Support URL, NS*UsageDescription, ATT |
| Стор-модерация: листинг Connect (блок 5) | `features/store-moderation/block-05-app-store-metadata/` | Раздел **`/admin/store-review-metadata`**: скриншоты (реальный UI), §2.3 точность метаданных, возрастной рейтинг, локализации; ссылки на справку Apple |
| Стор-модерация: риски ревью Apple (блок 6) | `features/store-moderation/block-06-apple-review-risks/` | Раздел **`/admin/store-review-risks`**: IAP §3.1, подписки, §4.2 минимальная функциональность, §4.3 спам/дубликаты, §2.1 стабильность, entitlements / WebView-оболочка |
| Стор-модерация: Google Play (блок 7) | `features/store-moderation/block-07-google-play-admin/` | Раздел **`/admin/store-review-play`**: Data safety, UGC, политики; официальные ссылки support.google.com / play.google.com |
| Лента | `features/feed/` | Компоненты ленты (напр. `FeedHeader`) |
| Посты (обрезка видео, скелетон ленты) | `features/posts/` | `video-trim/`, `posts-feed-skeleton/PostsFeedSkeleton` для первой загрузки `/posts` |
| Доска / треки | `features/board/tracks/` | Треки, модалки |
| История звонков в борде | `features/board/call-history/` | Список/деталь, связка с треками |
| SENDER (борд) | `pages/BoardSender.tsx`, `lib/sender.ts` | Приветствие новым подписчикам в ЛС: настройки, превью, статистика; маршрут `/board/sender` |
| BUSINESS Chat Constructor (борд) | `pages/BoardBusiness.tsx`, `lib/business-chat.ts` | Конструктор бизнес-чата: авто-подключение по `endpoint + api key`, генерация команд, переход в `business`-чат |
| API HUB (борд) | `pages/BoardApiHub.tsx`, `Board.tsx`, `users.board_api_hub_prime_code`, админка «Пользователи» | Доступ по PRIME CODE из админки; плитка и `/board/api-hub`; в `/auth/me` — только `boardApiHubAccess` |
| Уведомления | `features/notifications/` | Колокол, хуки непрочитанного |
| Комментарии к постам (клиент) | `features/comments/` | Модалка, ответы, `comment-mentions/` (@ + контакты/подписки/поиск, `@[Имя](id)`), лайки, удаление; см. `features/comments/README.md`; `lib/comments.ts`, `components/CommentsModal.tsx` |
| Админ ops (клиент) | `features/admin-ops/` | Секции платформы, трафик, отчёты, API диска, публичные бары — см. `api.ts`, `i18n.ru.ts` |
| Оболочка UI админки | `features/admin-shell/` | Токены и компоненты макета: `AdminPageHeader`, `AdminStatCard`, `AdminPanelCard`, `AdminMetricTile`, `AdminShellProvider`; стили `admin-shell.css` (только внутри `[data-admin-shell]` в `AdminLayout`) |
| Медиа-студия (клиент) | `features/admin/media-studio/` | `/admin/media-studio`: synthetic users (список, создание, карточка с постами/просмотрами, аватар/обложка drag-and-drop); табы-заглушки групп и кампаний |
| EDGE companion (клиент) | `features/edge-companion/` | Лента: `EdgeCompanionFeedCard` → `EdgeCompanionFeedHero` + `EdgeFeedSurfacePager` + **`feed-delight/`** (вход карточки, подсказка свайпа, аура/тап-всплеск в ленте, акцент CTA — только UI); полный экран: Embla в `companion-surfaces/`; `edge-embla-scroll.ts`, `use-embla-viewport-height-sync.ts`, `edge-feed-play-state.ts`, `edge-companion-navigation.ts` |
| Push (клиент) | `features/push/` | `CreateStandalonePushDrawer`: быстрый Push подписчикам из Чаты → Push → исходящие (`POST /api/posts` + `sendToPush`); `constants.ts` (TTL, лимит текста) |
| EDGE MONEY (борд) | `features/edge-money-board/` | Мастер `/board/edge/new-money`; `invite-dm-fields/MoneyInviteDmFields.tsx` (шаблон ЛС + срок кодов при включённом «Пригласил друга»); `lib/edge-money-wizard.ts` (`hydrateMoneyInviteDm`, `inviteDmToMoneyPatch`) |
| EDGE MONEY (игрок) | `features/edge-money-template/` | Шаблон Prize Swipe + **`invite-friend-row/`** (коды в чат, прогресс, баллы); `lib/edge-money-public.ts`, `lib/edge-money-invite-api.ts` |
| EDGE MONEY (архитектура) | `docs/EDGE_MONEY_ARCHITECTURE.md` | Роли и потоки: что делает создатель (борд) vs участник, границы платформы/EDGE, текущие заглушки (события → баллы) |
| EDGE MONEY (приглашения) | `server/edge-money-invite/`, `lib/edge-money-invite-api.ts`, `docs/EDGE_MONEY_INVITE_FOUR_BLOCKS.md` | Партии + `POST/GET …/money/ping-invite-pack` / `invite-progress`; `money.inviteDm`; закрытие партии после регистраций по кодам |
| EDGE MONEY (чат — начисления) | `server/edge-money-chat-messages/`, `server/edge/fetch-money-chat-accrual-targets.ts`, `shared/schema/edge-money-chat-message-counters.ts`, `docs/edge-money-chat-scoring/` | Счётчики по (user, chat, edge); хук в `messages/service`; `GET /v1/money/chat-accrual-targets` + `chat_messages_milestone` в platform-events; правило `maxPointsPerDay` |
| EDGE MONEY (звонки — начисления) | `server/edge-money-call-minutes/`, `server/edge/fetch-money-call-accrual-targets.ts`, `shared/schema/edge-money-call-minute-counters.ts`, `calls/session.ts` (хук при `endSession`) | Полные минуты после `connected`; оба участника; `GET /v1/money/call-accrual-targets` + `video_call_minutes_milestone`, ключ `money_video_call` |
| EDGE MONEY (посты и реакции) | `server/edge-money-post-created/`, `server/edge-money-profile-likes/`, `shared/schema/edge-money-post-counters.ts`, `edge-money-profile-like-counters.ts`, `posts/create-post.ts`, `posts/post-mutate.ts`, `reactions/routes.ts` | Правила `post_created` / `profile_likes_received`: счётчики в основной БД, `GET /v1/money/post-accrual-targets` и `profile-like-accrual-targets`, события `post_created_milestone` / `profile_likes_received_milestone` |
| Настройки | `features/settings/` (`SettingsScreenShell`), `pages/Settings*.tsx` | Главная `/settings`: профиль, тема, выход; подстраницы `/settings/invites`, `/notifications`, `/chat`, `/media`, `/privacy`, `/more`, `/data` (`SettingsDataMemoryCard` — кэш, избранное, JSON) |
| Вход / регистрация / сброс пароля | `features/auth/login/`, `features/auth/password-reset/` | Контроллер и эффекты логина, форма, блок приглашения + New-Tel; панель восстановления пароля и `password-reset-api` |

### Прочее на клиенте

| Путь | Назначение |
|------|------------|
| `components/story-viewer/` + `StoryViewer.tsx` | Просмотр сториз, портал |
| `components/PostExternalVideoEmbed.tsx`, `PostCaptionInlineParts.tsx`, `lib/post-external-video.ts` | Посты: внешнее видео по ссылке в тексте — превью у видимой карточки (IntersectionObserver), iframe только по тапу; метка провайдера вместо длинного URL |
| `pages/admin/` | Страницы админки, в т.ч. `Disk.tsx` (статистика диска) |
| `lib/auth-return-path.ts`, `Login.tsx`, `Onboarding.tsx` | Возврат после входа/регистрации/онбординга на «глубокий» URL (пост в профиле `/profile/…/post/…`, `/edge/…`, лента и др.) через `sessionStorage`, whitelist без open redirect |

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
| Пользователи | `users/` | Профили, подписки, блоки, контакты; `edge-follow-hook.ts` — EDGE XP за первую подписку на автора кампании; вызов `sender/follow-hook` после новой подписки |
| SENDER | `sender/` | `GET/PATCH /api/sender/welcome` — модуль авто-ЛС подписчикам; `service.ts`, `follow-hook.ts` |
| Закреплённое в профиле | `profile-pins/` | Папки и элементы (пост/сториз), обложки — `routes.ts`, `service.ts` |
| Чаты | `chats/` | HTTP: `routes.ts` → `register-chats-routes-read.ts` / `register-chats-routes-write.ts`, хелперы `chats-route-helpers.ts`; сервис — модули `list-chats-for-user.ts`, `chat-dm-payload.ts`, `start-dm-for-user.ts`, папки, медиа/ссылки и т.д. + `service.ts` (реэкспорт) |
| Сообщения | `messages/` | Лента, отправка, правки; логика разнесена по файлам (`send-chat-message.ts`, `list-chat-messages.ts`, парсинг вложений/шаринга, `message-send-idempotency.ts`); публичный API — `service.ts` (реэкспорт) |
| Жалобы (валидация цели) | `reports/validate-report-target/`, `reports/validate-*-report/` | Оркестратор + отдельная папка на тип цели (`message` / `user` / `post` / `story` / `comment`); класс ошибки `reports-target-validation-error.ts` |
| Сохранённые сообщения | `saved-messages/` | Избранное в мессенджере |
| AI-чат | `ai-chat/` | Диалог с AI |
| AI Search | `ai-search/` | Поиск, индексация — см. `docs/AI_SEARCH_ALGORITHM.md` |
| ПИНГОК МИКРО (API) | `pingok-micro/` | `routes.ts`: parse, memory-search, **execute**, send-dm, **start-call**; `time-parse.ts`, `execute-service.ts` |
| Напоминания (Пингок) | `reminders/` | `GET /api/reminders/due`, `POST /api/reminders/:id/dismiss` |
| Service Chat | `service-chat/` | Хост-сообщения: шаблоны цепочек after-read, рассылки, локальная/глобальная обратная связь |
| BUSINESS Chat Constructor | `business-chat/` | Коннектор внешних API: авторазбор контракта, генерация команд, inbound/outbound webhook, retry/idempotency |
| EDGE adapter | `edge/` | Прокси `/api/edge/*`; participant task/follow-reward; **creator:** `GET /api/edge/my-campaigns`, `POST/GET/PATCH /api/edge/creator/campaigns` (+ `:edgeId`) |
| Посты | `posts/` | Лента, CRUD, просмотры, сохранённые; `service.ts` — только реэкспорт; подробная таблица файлов — подраздел **«Модули server/posts»** ниже; `edge-task-hook.ts` — EDGE XP за view/react/share при `edge_id` |
| Лента (ранг + снапшот) | `feed/`, `feed-worker/` | `global-feed-row.ts` (тип строки + Drizzle-select), `config.ts`, `rank-global-public-feed.ts`, `load-global-feed-page.ts`, `snapshot-store.ts`; воркер пересчитывает `feed_global_snapshot`, API читает готовый порядок |
| Комментарии к постам | `features/comments/` | `register-comments-routes.ts`; подпапки: `post-comments/`, `comment-replies/`, `comment-reactions/` (заготовка API), `comment-moderation/`, `shared/` — см. `server/features/comments/README.md` |
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
| Медиа-студия (админ) | `admin/media-studio/` | Синтетические пользователи, кампании публикаций, инвайты в группы по ссылке; ТЗ — `docs/ADMIN_MEDIA_STUDIO_SPEC.md` |
| Ops (платформа) | `admin/ops/` | Публичные/админские HTTP для платформы, отчёты, traffic shield, **диск** (`disk-stats.service.ts`, `disk.admin-http`) — см. `server/admin/ops/README.md` |

### Модули server/posts

HTTP: `routes.ts` только подключает регистраторы; сами хендлеры — в `posts-routes-*.ts`. Сервис — `service.ts` (barrel).

| Файл | Назначение |
|------|------------|
| `routes.ts` | `registerPostsRoutes`: порядок вызова `posts-routes-*` (как у монолита) |
| `posts-route-helpers.ts` | `postsRoutePostId` — разбор `req.params.postId` |
| `posts-routes-create.ts` | `POST /api/posts` |
| `posts-routes-read.ts` | `registerPostsFeedRoutes` — `GET /api/posts`, `GET /api/posts/:postId`; `registerPostsSavedListRoute` — `GET /api/me/saved-posts` |
| `posts-routes-activity.ts` | `registerPostsViewEngageRoutes` — `POST .../view`, `POST .../engage` |
| `posts-routes-mutate.ts` | `DELETE` / `PATCH /api/posts/:postId` |
| `posts-routes-share-save.ts` | Шаринг в ЛС, save / unsave |
| `service.ts` | Barrel: единая точка импорта (`./service` из `routes`, `parser-publish`, комментарии) |
| `posts-service-error.ts` | Ошибки домена с HTTP-статусом |
| `post-access.ts` | Доступ к посту для зрителя (`assert` / `ensure` + EDGE audience) |
| `post-edge-id.ts` | Парсинг `edge_id` для колонки поста |
| `create-post.ts` | Создание поста |
| `post-engagement.ts` | Просмотры и задел под engagement |
| `post-mutate.ts` | Удаление и правка своего поста |
| `post-share-save.ts` | Шаринг в ЛС, save/unsave |
| `list-posts-for-viewer.ts` | `listPostsForViewer`: оркестратор load → assemble |
| `list-posts-for-viewer-types.ts` | Типы `ListPostsFeedRow`, `ListPostsForViewerParams` |
| `list-posts-for-viewer-load.ts` | `loadListPostsFeedRows` — SQL, глобальный фид, ранжирование, фильтр EDGE audience |
| `list-posts-for-viewer-assemble.ts` | `assembleListPostsForViewer` — счётчики, реакции, комментарии, DTO для ответа |
| `get-post-by-id-detailed.ts` | Одна карточка поста (деталка) |
| `list-saved-posts-detailed.ts` | Сохранённые посты пользователя |
| `post-public-dto.ts` | Единые чистые хелперы для полей поста в JSON (автор, `channelName`, visibility, EDGE audience, хэштеги, `mediaLayout`) — лента, деталка, сохранённые |
| `edge-display-audience.ts` | Аудитория карточки EDGE, синхронизация с upstream |
| `edge-task-hook.ts` | Фоновые задачи EDGE после действий с постом |
| `normalize-post-media.ts` | Публичные URL медиа поста |
| `load-latest-comments.ts` | Последние комментарии для списков |
| `author-wall.ts` | Вспомогательная логика стены автора (если подключена роутами) |

### Модули server/feed

| Файл | Назначение |
|------|------------|
| `global-feed-row.ts` | `GlobalPublicFeedRow`, `globalPublicFeedSelectFields` — общая форма строки поста для снапшота, inline-ленты и `list-posts-for-viewer-load` |
| `config.ts` | Пороги ранжирования и TTL снапшота (`FEED_*` env) |
| `rank-global-public-feed.ts` | Кандидаты публичной ленты, `rankGlobalPublicCandidateRows`, `computeGlobalPublicFeedOrderedIds` (воркер) |
| `load-global-feed-page.ts` | `tryLoadGlobalPublicFeedPage` (снапшот), `loadGlobalPublicFeedPageInline` (fallback на запросе) |
| `snapshot-store.ts` | Чтение/запись `feed_global_snapshot` |

### Загрузки файлов

| Путь | Назначение |
|------|------------|
| `upload/voice.ts`, `upload/post-media/` (`register-post-media-upload-routes.ts` и вспомогательные файлы), `story-media.ts`, `chat-media.ts`, `avatar.ts`, `cover.ts` | Эндпоинты загрузки в `uploads/` |

### Инфраструктура сервера

| Путь | Назначение |
|------|------------|
| `db/` | Подключение Drizzle, ensure-колонок/схем |
| `storage/` | `IStorage`, `DbStorage`, `MemStorage`, `export const storage` — см. [модули `server/storage`](#модули-serverstorage) |
| `realtime/chat.ts` | Подписки на чаты, fanout событий |
| `middleware/` | Напр. `api-shield.ts` |
| `admin/telemetry.ts` | Телеметрия модулей API |

### Модули server/storage

| Файл | Назначение |
|------|------------|
| `index.ts` | Фабрика `storage`: `DbStorage` при `DATABASE_URL`, иначе `MemStorage` |
| `types.ts` | Контракт `IStorage` |
| `db-storage.ts` | `DbStorage` — фасад `IStorage`: делегирование в `db-storage-*-queries.ts`, в файле остаются vibe / reminders / voice / DM scheduled / Pingok |
| `mem-storage.ts` | `MemStorage` — in-memory для dev/тестов без БД |
| `mem-storage-heap.ts` | Общие карты/массивы состояния для `MemStorage` (контакты, папки, блоки, напоминания и т.д.) |
| `storage-constants.ts` | Общие константы слоя (напр. `STORAGE_INITIAL_PUBLIC_ID` для `public_id`) |
| `db-storage-schema-guards.ts` | Проверки ошибок БД при отсутствии миграций (`user_blocks` / restrict-колонки) |
| `db-storage-user-like-escape.ts` | Экранирование строки для ILIKE при поиске пользователей |
| `db-storage-user-phone-search.ts` | Условия Drizzle по телефону / `phone_lookup_hash` из поискового запроса |
| `db-storage-admin-user-search.ts` | Сборка OR-условия для `listUsersForAdmin` |
| `db-storage-referral-code-conditions.ts` | Общее условие «реферальный код ещё действителен» |
| `db-storage-purge-user.ts` | Транзакция полного удаления пользователя из БД |
| `db-storage-message-folder-conditions.ts` | Условие `messages.folder_id` (основная папка / конкретная) |
| `db-storage-unread-message-conditions.ts` | Условия подсчёта непрочитанных (не свои, не `system`) |
| `db-storage-referral-create-helpers.ts` | Нормализация `maxUses` и `adminNote` при создании рефкода |
| `db-storage-registration-series.ts` | Ряд дней UTC для `getUserRegistrationsByDay` |
| `db-storage-referral-counts-map.ts` | Сборка `Record<inviter, count>` для приглашённых |
| `db-storage-tracks-stats-merge.ts` | Слияние агрегатов `getTracksStats` (сообщения + сегменты звонков, `lastAddedAt`) |
| `db-storage-track-message-preview.ts` | Превью текста пункта трека для сообщения (обрезка / тип) |
| `db-storage-chat-title-for-tracks.ts` | Заголовки чата для списка трека: DM / группа / сессия звонка |
| `db-storage-track-list-mappers.ts` | Маппинг строк БД → DTO пункта трека и сортировка по `addedAt` |
| `db-storage-track-chat-name-map.ts` | Асинхронная карта `chatId → отображаемое имя` для `listTrackItems` |
| `db-storage-call-transcript-segment-payload.ts` | Сборка `values` / `onConflictDoUpdate.set` для `upsertCallTranscriptSegment` |
| `db-storage-call-participant-count-map.ts` | `groupBy` участников → `Map<callId, count>` для списка сессий |
| `db-storage-call-sessions-history-assemble.ts` | Слияние строк истории звонка с `participantCount` и `chatName` |
| `db-storage-call-session-chat-name-map.ts` | Карта имён чатов для `listCallSessionsHistory` (через `formatTrackCallSessionChatTitle`) |
| `db-storage-call-participant-lookup.ts` | Проверка участия пользователя в звонке (`findFirstCallParticipantId`) |
| `db-storage-user-profile-update-patch.ts` | Сборка `set` для `updateUserProfile` из `UpdateProfile` |
| `db-storage-follow-list-user-columns.ts` | Общий `select` публичных полей пользователя для списков follow / mutual |
| `db-storage-mutual-follow-to-target.ts` | Alias `follows` + условие «viewer подписан, mutual подписан на target» |
| `db-storage-follow-row-pluck.ts` | `pluck*` для `contactUserId` / `followingId` / `followerId` |
| `db-storage-user-presence-update-sets.ts` | Объекты `set` для last seen и FCM-токена |
| `db-storage-user-block-restrict-defaults.ts` | Дефолты флагов ограничений при блокировке (`restrict*` — как в `addBlock`) |
| `db-storage-user-block-note.ts` | Заметка при insert и нормализация из БД для API |
| `db-storage-user-block-full-restriction.ts` | Условие «полная блокировка» для фильтра ленты / связей |
| `db-storage-user-block-upsert-build.ts` | Сборка `values` + `onConflictDoUpdate.set` для `user_blocks` |
| `db-storage-user-block-relation-merge.ts` | Слияние id сторон без дублей после двух выборок |
| `db-storage-chat-metadata-update-patch.ts` | Частичный `set` для `updateChat` (имя, аватар) |
| `db-storage-chat-member-read.ts` | Единый `select` `last_read_at`, монотонное обновление, pluck участников / список чатов |
| `db-storage-chat-member-prefs-merge.ts` | Слияние patch + строки для upsert `chat_member_prefs` |
| `db-storage-chat-member-prefs-map.ts` | Строки prefs → `Map`, распознавание `42P01` (таблица не создана) |
| `db-storage-dm-chat-lookup-sql.ts` | SQL поиска DM между двумя пользователями (strict / loose) для транзакции |
| `db-storage-chat-folder-helpers.ts` | Имя основной папки, insert «Общий», trim имени, решение о переименовании |
| `db-storage-message-cursor.ts` | Курсор пагинации по `beforeMessageId` (`created_at` + условие `lt`) |
| `db-storage-message-content-normalize.ts` | Нормализация текста сообщения и транскрипта перед записью |
| `db-storage-chat-media-message-types.ts` | Список типов сообщений для медиа-галереи в чате |
| `db-storage-message-hidden-pluck.ts` | Извлечение id скрытых сообщений из строк выборки |
| `db-storage-message-chat-name-map.ts` | Карта имён чатов для списков сообщений (обёртка над трековым resolver без callRows) |
| `db-storage-search-messages-query-helpers.ts` | Лимит поиска сообщений, экранированный паттерн ILIKE по контенту |
| `db-storage-saved-message-list-preview.ts` | Превью контента в списке сохранённых |
| `db-storage-search-message-result-map.ts` | Сборка DTO результата поиска по сообщениям |
| `db-storage-saved-message-result-map.ts` | Сборка DTO списка сохранённых + превью |
| `db-storage-insert-returning-row.ts` | Первая строка из `insert().returning()` с единым сообщением об ошибке |
| `db-storage-scheduled-message-insert-values.ts` | Сборка значений вставки отложенного сообщения (trim контента, null→undefined) |
| `db-storage-scheduled-messages-due-batch.ts` | Верхняя граница и clamp лимита выборки «просроченных» |
| `db-storage-scheduled-messages-due-select.ts` | Select-поля и порядок `scheduled_at`, `id` для воркера |
| `db-storage-message-in-chat-condition.ts` | Условие «сообщение в этом чате» для get/update/delete |
| `db-storage-chat-vibe-state-upsert-payload.ts` | Сборка `values` + `onConflictDoUpdate.set` для `chat_vibe_state` |
| `db-storage-chat-vibe-insert-values.ts` | Значения вставки для `chat_vibe_batches` и `chat_vibe_history` |
| `db-storage-planner-title-normalize.ts` | Trim + fallback заголовка (напоминания / голосовые задачи / DM-звонок) |
| `db-storage-dm-scheduled-call-helpers.ts` | Константы окон grace/pre-event/planner-cutoff и выбор активной строки для участника |
| `db-storage-pingok-track-source-chat-sql.ts` | Сырой SQL служебного группового чата `__pingok_track_src` |
| `db-app-db.ts` | Тип `AppDb` (`ReturnType<typeof getDb>`) для вынесенных запросов |
| `db-storage-facade-queries.ts` | Реэкспорт всех `dbStorage*` query-функций по доменам для тонкого `DbStorage` |
| `db-storage-facade-context.ts` | Колбэки фасада в query-слой (`Pick<IStorage, …>` + `.bind`); `DbStorage` держит `pool` один раз |
| `db-storage-chat-name-resolver-deps.ts` | Сборка `ChatNameResolverDeps` из минимального `Pick<IStorage, …>` |
| `db-storage-segment-host.ts` | Тип среды `DbStorageSegmentHost` для вынесенных сегментов фасада |
| `db-storage-segment-account.ts` | Сегмент фасада: пользователи, админ, рефералы |
| `db-storage-segment-chat.ts` | Сегмент фасада: чаты, участники, prefs, DM |
| `db-storage-segment-messages.ts` | Сегмент фасада: сообщения, папки, отложенные, скрытые |
| `db-storage-segment-search-saved.ts` | Сегмент фасада: поиск и сохранённые сообщения |
| `db-storage-segment-tracks.ts` | Сегмент фасада: треки и пункты |
| `db-storage-segment-calls.ts` | Сегмент фасада: история звонков, транскрипт, подсказки |
| `db-storage-segment-social.ts` | Сегмент фасада: профиль/presence, контакты, подписки, блоки |
| `db-storage-segment-planner.ts` | Сегмент фасада: vibe, напоминания, голос, Pingok, DM-call |
| `db-storage-user-queries.ts` | Пользователи: get/search/create/publicId/related-by-signup/discoverable |
| `db-storage-admin-queries.ts` | Админ: stats, list, signup-risk (pool), block/delete/purge, роли |
| `db-storage-referral-queries.ts` | Рефералы: коды, consume, счётчики, регистрации по дням, invited |
| `db-storage-chat-core-queries.ts` | Чаты и участники: CRUD, prefs (через merge), DM get-or-create (pool) |
| `db-storage-chat-messages-queries.ts` | Непрочитанные, last_read, страницы сообщений / медиа / ссылки |
| `db-storage-chat-folders-and-scheduled-queries.ts` | Папки, CRUD сообщений, скрытые, отложенные |
| `db-storage-message-search-saved-queries.ts` | Поиск по сообщениям и сохранённые (`ChatNameResolverDeps`) |
| `db-storage-tracks-core-queries.ts` | Треки: create/list/get/update/delete, stats, `findBestUserTrackByName` |
| `db-storage-tracks-items-queries.ts` | Пункты трека: add message/segment, remove, done, `listTrackItems` |
| `db-storage-chat-vibe-queries.ts` | Chat Vibe: read/upsert state, batches, history на `AppDb` |
| `db-storage-user-reminder-queries.ts` | `user_reminders`: create, list due (именованный лимит), dismiss, reschedule |
| `db-storage-voice-task-queries.ts` | `voice_tasks`: create, list open с clamp лимита, complete |
| `db-storage-dm-scheduled-call-queries.ts` | `dm_scheduled_calls`: планировщик, активная строка участника, pre-event список |
| `db-storage-pingok-track-source-queries.ts` | Служебный чат треков Pingok: `pool` + deps (`upsertChatMemberPrefs`, `getChatById`) |
| `db-storage-user-profile-presence-queries.ts` | `updateUserProfile`, last seen, FCM token |
| `db-storage-contacts-follow-queries.ts` | Контакты и подписки: follow/unfollow, списки, mutual, счётчики |
| `db-storage-user-block-queries.ts` | Блокировки: add/remove/is, флаги, `getBlockedRelationIds` (на базе `user-block-*`) |
| `db-storage-call-session-queries.ts` | История звонков, участники, транскрипт, подсказки команд |
| `users-store.ts` | Состояние пользователей внутри `MemStorage` |
| `chats-store.ts` | Чаты в памяти |
| `messages-store.ts` | Сообщения в памяти |
| `referral-codes-store.ts` | Реферальные коды в памяти |

---

## Общий слой (`shared/`)

| Путь | Назначение |
|------|------------|
| `schema/` | Таблицы Drizzle и zod/insert-схемы: `users`, `chats`, `messages`, `posts`, `stories`, `profile-pins`, `user-reminders`, `voice-tasks`, `service-chat`, `sender-welcome`, `business-chat`, `notifications`, `tracks`, `platform-settings`, `content-reports`, … |
| `schema/index.ts` | Реэкспорт схем |
| `constants.ts` | Общие константы |
| `edge-task-preset-config.ts` | Пресеты заданий EDGE: типы и парсинг `taskPresets` / `verify` (платформа + EDGE) |
| `call-signaling.ts`, `ws-call-handshake.ts` | Контракты звонков |
| `chat-vibe-types.ts`, `post-media-layout.ts`, `post-video.ts` | Общие типы/утилиты для UI и API |
| `message-delivery-status.ts` | Контракт статусов исходящего на клиенте (`sending` / `sent` / `failed`) и связь с серверным курсором прочтения (`last_read`) |

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
| 2026-04 | `server/stickers/` (модуль: `register-sticker-routes`, `sticker-route-handlers-read/write`, `sticker-upload`, `repo`, `resolve-outgoing-sticker-content`, `index`), `client/src/features/stickers/`, `scripts/migrate-sticker-packs.cjs`, `shared/schema/sticker-packs.ts` | Стикер-паки: HTTP изолированно от `messages/`, UI панели чата и настроек, WebP, `type: sticker` |
| 2026-03 | `client/src/features/chat/message-table/` | Таблица: inline + большие → CSV или XLSX (`xlsx`, lazy chunk), `prepareLargeTablePasteData`, `LargeTablePasteDialog`; сервер и `ChatPdfAttachment` для CSV/XLSX |
| 2026-03 | `server/middleware/network/` (`request-timeout-middleware.ts`, `error-handler-middleware.ts`, `is-retryable-status.ts`, `api-not-found-middleware.ts`), `server/index.ts` | Сеть/стабильность API: глобальный timeout для `/api` (504 + `Retry-After` + `requestId`), JSON-ответ для неизвестных `/api/*`, единый формат ошибок с `retryable` для предсказуемого retry на клиенте |
| 2026-03 | `server/messages/*.ts` (split), `server/reports/validate-report-target/`, `shared/schema/message-send-idempotency.ts`, `scripts/migrate-message-send-idempotency.cjs`, `IStorage.getMessageById` | Чаты: модули сообщений ≤~250 строк/файл; валидация жалобы на `message`; идемпотентный POST (`Idempotency-Key` / `idempotencyKey`); таблица `message_send_idempotency` |
| 2026-03 | `server/chats/*.ts` (split service + read/write routes), `viewerMayDmTarget` в `start-dm` / `get-dm-by-public-id`, `reports/validate-report-target` (user/post/story) | Домен чатов без монолита `service.ts`; единый `respondChatsServiceError`; ЛС открываются с учётом `dmPolicy`; жалобы — проверка цели для всех типов UGC |
| 2026-03 | `server/posts/service.ts` + `list-posts-for-viewer.ts`, `get-post-by-id-detailed.ts`, `list-saved-posts-detailed.ts`, `post-public-dto.ts`, ранее `create-post`, `post-access`, `post-engagement`, `post-mutate`, `post-share-save`, `post-edge-id`, `posts-service-error` | Посты платформы: модули чтения/мутаций; `post-public-dto` — общие поля JSON (автор, visibility, EDGE audience и т.д.); контракт API без изменений, импорты из `posts/service` сохранены |
| 2026-03 | `server/posts/routes.ts`, `posts-routes-create.ts`, `posts-routes-read.ts`, `posts-routes-activity.ts`, `posts-routes-mutate.ts`, `posts-routes-share-save.ts`, `posts-route-helpers.ts` | HTTP постов разнесён по файлам; `registerPostsRoutes` сохраняет порядок регистрации маршрутов |
| 2026-03 | `server/posts/list-posts-for-viewer-types.ts`, `list-posts-for-viewer-load.ts`, `list-posts-for-viewer-assemble.ts`, `list-posts-for-viewer.ts` | Лента: разделение загрузки строк и сборки ответа (~200 строк на модуль) |
| 2026-03 | `server/feed/global-feed-row.ts`, правки `rank-global-public-feed.ts`, `load-global-feed-page.ts`, `list-posts-for-viewer-load.ts` | Единый тип/select для глобальной ленты; ранжирование hashtag/q через общий `rankGlobalPublicCandidateRows` (без дублирования алгоритма) |
| 2026-03 | `server/storage/storage-constants.ts`, `db-storage-schema-guards.ts`, `db-storage.ts`, `users-store.ts` | Константа старта `public_id` в одном месте; guard `user_blocks` вынесен из монолита `db-storage` |
| 2026-03 | `db-storage-user-like-escape.ts`, `db-storage-user-phone-search.ts`, `db-storage-admin-user-search.ts`, `db-storage-referral-code-conditions.ts`, `db-storage-purge-user.ts`, `db-storage.ts` | Вынесены: ILIKE-escape, телефонные условия поиска, админский поиск, условие валидности рефкода, purge-транзакция — без смены поведения API |
| 2026-03 | `db-storage-message-folder-conditions.ts`, `db-storage-unread-message-conditions.ts`, `db-storage-referral-create-helpers.ts`, `db-storage-registration-series.ts`, `db-storage-referral-counts-map.ts`, `db-storage.ts` | Условия папки/непрочитанных, хелперы рефкода, серия регистраций по дням, карта счётчиков приглашений |
| 2026-03 | `db-storage-tracks-stats-merge.ts`, `db-storage-track-message-preview.ts`, `db-storage-chat-title-for-tracks.ts`, `db-storage-track-list-mappers.ts`, `db-storage-track-chat-name-map.ts`, `db-storage.ts` | Треки в storage: чистые слияние статистики, превью контента, заголовки чатов, маппинг списка и карта имён — без смены ответа API |
| 2026-03 | `db-storage-call-transcript-segment-payload.ts`, `db-storage-call-participant-count-map.ts`, `db-storage-call-sessions-history-assemble.ts`, `db-storage-call-session-chat-name-map.ts`, `db-storage-call-participant-lookup.ts`, `db-storage.ts` | История звонков / транскрипт: payload upsert, карта счётчиков участников, сборка DTO списка сессий, имена чатов, общий lookup участника для сегментов и подсказок |
| 2026-03 | `db-storage-user-profile-update-patch.ts`, `db-storage-follow-list-user-columns.ts`, `db-storage-mutual-follow-to-target.ts`, `db-storage-follow-row-pluck.ts`, `db-storage-user-presence-update-sets.ts`, `db-storage.ts` | Профиль + соцграф в storage: патч обновления профиля, общий select списков подписок, бандл mutual-follow, pluck id-строк, сеты presence/FCM |
| 2026-03 | `db-storage-user-block-*.ts` (5 модулей), `db-storage.ts` | Блокировки: дефолты флагов и upsert вынесены, условие полной блокировки в одном месте, `getBlockedRelationIds` — два запроса параллельно (`Promise.all`), нормализация `blockNote` |
| 2026-03 | `db-storage-chat-*.ts`, `db-storage-dm-chat-lookup-sql.ts`, `db-storage.ts` | Чаты: единая выборка `last_read` для unread/lastRead/updateLastRead, монотонность курсора вынесена в функцию, prefs map + merge, SQL DM в константах |
| 2026-03 | `db-storage-chat-folder-helpers.ts`, `db-storage-message-cursor.ts`, `db-storage-message-content-normalize.ts`, `db-storage-chat-media-message-types.ts`, `db-storage-message-hidden-pluck.ts`, `db-storage.ts` | Папки чата + сообщения: общий курсор страницы для трёх выборок, константы медиа-типов, нормализация текста/транскрипта, тип `ChatFolder` без inline import, главная папка из одного билдера |
| 2026-03 | `db-storage-message-chat-name-map.ts`, `db-storage-search-messages-query-helpers.ts`, `db-storage-saved-message-list-preview.ts`, `db-storage-search-message-result-map.ts`, `db-storage-saved-message-result-map.ts`, `db-storage.ts` | Поиск и сохранённые: единая карта имён чатов с треками, экранирование ILIKE, лимит в константе, чистые мапперы DTO |
| 2026-03 | `db-storage-insert-returning-row.ts`, `db-storage-scheduled-message-insert-values.ts`, `db-storage-scheduled-messages-due-batch.ts`, `db-storage-scheduled-messages-due-select.ts`, `db-storage-message-in-chat-condition.ts`, `db-storage.ts` | Сообщения + отложенные: общий `returning`, условие chat+message, порядок выборки due (FIFO + стабильный id), clamp батча, trim отложенного контента |
| 2026-03 | `db-storage-chat-vibe-state-upsert-payload.ts`, `db-storage-chat-vibe-insert-values.ts`, `db-storage-planner-title-normalize.ts`, `db-storage-dm-scheduled-call-helpers.ts`, `db-storage-pingok-track-source-chat-sql.ts`, `db-storage.ts` | Chat Vibe: вынесены payload upsert и insert batch/history; планировщик — единый trim заголовков; DM scheduled calls — именованные окна и чистая функция выбора активной строки; Pingok — SQL константы |
| 2026-03 | `db-app-db.ts`, `db-storage-user-queries.ts`, `db-storage-admin-queries.ts`, `db-storage-referral-queries.ts`, `db-storage-chat-core-queries.ts`, `db-storage-chat-messages-queries.ts`, `db-storage-chat-folders-and-scheduled-queries.ts`, `db-storage-message-search-saved-queries.ts`, `db-storage-tracks-queries.ts`, `db-storage-call-session-queries.ts`, `db-storage-profile-social-queries.ts`, `db-storage.ts` | Крупный split: запросы вынесены в модули с сигнатурами `(db: AppDb, …)` / pool там, где транзакции; `DbStorage` — тонкий фасад + vibe/reminders/voice/DM/pingok; `upsertChatMemberPrefs` через `mergeChatMemberPrefsForUpsert` |
| 2026-03 | `db-storage-chat-vibe-queries.ts`, `db-storage-user-reminder-queries.ts`, `db-storage-voice-task-queries.ts`, `db-storage-dm-scheduled-call-queries.ts`, `db-storage-pingok-track-source-queries.ts`, `db-storage-tracks-core-queries.ts`, `db-storage-tracks-items-queries.ts`, `db-storage-user-profile-presence-queries.ts`, `db-storage-contacts-follow-queries.ts`, `db-storage-user-block-queries.ts`, `db-storage.ts` | Продолжение split: vibe/напоминания/голос/DM-call/Pingok-трек-чат и разрез треков (core vs items) + разрез профиля/соц/блоков; удалены `db-storage-tracks-queries.ts` и `db-storage-profile-social-queries.ts`; фасад — делегаты и колбэки для member prefs / reminders |
| 2026-03 | `db-storage-facade-queries.ts`, `db-storage-chat-name-resolver-deps.ts`, `db-storage.ts` | Фасад: один баррель реэкспорта query-слоя по доменам; явные deps для имён чатов (`Pick<IStorage, …>`); без смены контракта `IStorage` |
| 2026-03 | `server/admin/media-studio/`, `shared/schema/admin-media-studio.ts`, `migrations/0040_admin_media_studio.sql`, `scripts/migrate-admin-media-studio.cjs`, `docs/ADMIN_MEDIA_STUDIO_SPEC.md` | **Медиа-студия:** маркеры studio в `users`, таблицы кампаний и group-invites; API synthetic users (список, деталь, создание, PATCH профиля, загрузка аватара/обложки); UI `/admin/media-studio` в `client/src/features/admin/media-studio/` |
| 2026-03 | `db-storage-facade-context.ts`, `db-storage.ts` | Этап 2 фасада: `facadeCallbacks` с `.bind` для DM-call / Pingok / профиля / чатов; `this.pool` вместо повторных `getPool()` |
| 2026-03 | `db-storage-segment-*.ts` (8 файлов), `db-storage-segment-host.ts`, `db-storage.ts` | Фасад разнесён по доменным сегментам; `DbStorage` — проводка + `segment()` (`DbStorageSegmentHost`); контракт `IStorage` без изменений |
| 2026-03 | `client/src/pages/UserProfile.tsx`, `features/profile/user-profile/components/UserProfile*.{tsx}` (5 слоёв) | Страница профиля: вынесены баннер блокировки, input сториз, слой `StoryViewer` с мемоизацией маппинга API→viewer, шиты/блок-диалоги, модалки сториз+комментарии |
| 2026-03 | `hooks/useUserProfileStoryHighlightOpener.ts`, `UserProfilePulseActionRow`, `UserProfilePulsePinnedStrip`, `UserProfilePostsFeedSlot`, `UserProfilePulseAddContentStripGate`, `UserProfile.tsx` | Профиль: стабильный opener сториз (`useCallback`), мемо-слоты для action row / pins / ленты / «создать пост» |
| 2026-03 | `pulse-profile/layout/PulseProfileHero*.tsx`, `pulse-profile-hero-separators.ts`, `PulseProfileHeroCard.tsx` | PULSE герой-карточка профиля: вынесены кластер аватара, заголовок, меню, статистика; чистая функция разделителей; подкомпоненты с `memo` |
| 2026-03 | `PulseProfileCover*.tsx`, `pulse-profile-cover-parallax.ts`, `PulseProfileCoverHeader.tsx` | Обложка PULSE-профиля: медиа/плейсхолдер, виньетка, плашка @username, навигация; параллакс в чистой функции; слои с `memo` |
| 2026-03 | `pulse-profile-tabs-config.tsx`, `PulseProfileTabChip.tsx`, `PulseProfileTabsList.tsx`, `PulseProfilePostViewToggle.tsx`, `PulseProfileTabsRow.tsx` | Строка вкладок PULSE-профиля: конфиг табов, чип, список, переключатель сетка/список; `memo` на интерактивных кусках |
| 2026-03 | `pulse-profile-identity-spacing.ts`, `PulseProfileIdentityMutualGate.tsx`, `PulseProfileIdentityBio.tsx`, `PulseProfileIdentityExternalLink.tsx`, `PulseProfileIdentityActionSlot.tsx`, `PulseProfileIdentityBlock.tsx` | Блок личности под героем: отступ био от флага mutual, секции с `memo`, композиция в `PulseProfileIdentityBlock` |
| 2026-03 | `layout/hooks/usePulseProfileLayoutScroll.ts`, `pulse-profile-meta-line.ts`, `PulseProfileLayoutCoverSection.tsx`, `PulseProfileLayoutIdentityPinsSection.tsx`, `PulseProfileLayoutTabsAndFeed.tsx`, `PulseProfileLayoutInner.tsx` | Внутренний layout PULSE-профиля: скролл/параллакс в хуке, `metaLine` чистой функцией, секции обложки / identity+pins / табы+лента с `memo` |
| 2026-03 | `PulseProfilePostCardArticle.tsx`, `PulseProfilePostCardAvatarRing.tsx`, `PulseProfilePostCardHeaderMeta.tsx`, `PulseProfilePostCardHeader.tsx`, `PulseProfileThemedPostCard.tsx` | Карточка поста в PULSE-профиле: оболочка `article`, кольцо аватара, мета шапки, сборка шапки и тонкий оркестратор |
| 2026-03 | `pulse-stat-counter-math.ts`, `PulseStatCounterFigures.tsx`, `PulseStatCounterSurface.tsx`, `useCountUp.ts`, `StatCounter.tsx` | Счётчики статистики PULSE-профиля: easing в чистых функциях, мемо-слои цифр и кнопки/статики, длительность 850 ms в одной константе |
| 2026-03 | `shared/message-delivery-status.ts`, `OutgoingMessageFooter.tsx`, `format.ts` (доставка/прочтение), `PulseDmSentVideoNote` (title/aria у подписи кружка), `useMessageReadOnVisible`, `useSendMessage`, реконнект WS → refetch чата | Статусы исходящих; единый футер времени+галочек+a11y; PULSE-кружок: подсказки статуса; read у хвоста; refetch метаданных после /calls WS |
| 2026-03 | `api-hub/` | Отдельный микросервис API HUB: mock/OIDC auth, PG (сессии, партнёры, user_links, webhook outbox, ротация ключей), Redis fanout WS, S3 presigned media, прокси `/v1/me` → платформа `/api/auth/me`, метрики Prometheus, SDK и OpenAPI |
| 2026-03 | `server/sender/`, `shared/schema/sender-welcome.ts`, `scripts/migrate-sender-welcome.cjs`, `client/src/pages/BoardSender.tsx`, `client/src/lib/sender.ts`, `Board.tsx`, `/board/sender` | **SENDER:** приветствие в ЛС при новой подписке (текст + фото/видео), статистика подписчиков/доставок, `GET/PATCH /api/sender/welcome` |
| 2026-03 | `server/business-chat/`, `shared/schema/business-chat.ts`, `migrations/0038_business_chat_constructor.sql`, `client/src/pages/BoardBusiness.tsx`, `client/src/lib/business-chat.ts`, `Board.tsx`, `/board/business` | **BUSINESS Chat Constructor:** автоконфиг интеграций по контракту API, генерация команд, личный `business`-чат, inbound/outbound webhook, retry/idempotency |
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
| 2026-03 | `client/src/lib/touch-edge-swipe-physics.ts`, `hooks/use-touch-edge-swipe.ts`, `features/chat/hooks/useChatEdgeSwipeBack.ts` | Краевые свайпы (лента/чаты/рилсы, назад из диалога): порог ~10% ширины (коридор px) + «флик» по скорости, отмена только при явном вертикальном скролле |
| 2026-03 | `client/src/lib/reels-video/` | Бесшовный цикл видео (`useSeamlessVideoLoop`), жесты ленты: двойной тап, удержание ×2 / сдвиг вверх ×3 (`useReelsFeedVideoGestures`); `FeedInlineVideo`, аватар-видео |
| 2026-03 | `client/src/pages/ReelsFeed.tsx`, `features/reels/ReelsFeedSkeleton.tsx`, `ReelsPostShareSheet.tsx`, `ReelsVideoPoolLayer.tsx`, `lib/reels-video/reels-scroll-prefetch.ts`, `/reels` | Видео-лента: скелетон первой загрузки; пул из 3 `<video>`, preload ±2/±3, debounce `fetchNextPage`, шит «Поделиться»; вход из `Posts` |
| 2026-04 | `client/src/lib/isee-analytics.ts`, `POST /api/telemetry/client-event` (`isee.time_to_first_play`), `server/admin/telemetry/client-events-store.ts`, Ops «Модули» | iSee: throttled телеметрия time-to-first-play; смоук/HLS/бэкфилл — `docs/ISEE_SMOKE_CHECKLIST.md`, `docs/ISEE_HLS_ROADMAP.md`, `docs/MIGRATIONS_AND_DEPLOY_CHECKLIST.md` §6 |
| 2026-03 | `ПИНГОК МИКРО/`, `server/pingok-micro/routes.ts` | Голос: оверлей + long-press в `AppLayout`; `POST /api/pingok-micro/v1/parse` + `POST .../v1/memory-search` (`tryGlobalMemorySearch`); интенты find/show — поиск в оверлее и переход в чат/пост; `shared/parse-heuristic.ts`; опционально отдельный процесс `POST /v1/parse` |
| 2026-03 | `server/reminders/`, `migrations/0021_user_reminders_voice_tasks.sql`, `usePingokRemindersPoll` | Напоминания и задачи Пингок: таблицы `user_reminders`, `voice_tasks`; `POST /api/pingok-micro/v1/execute` + `send-dm`; опрос due + тост в `AppLayout` |
| 2026-03 | `server/service-chat/`, `shared/schema/service-chat.ts`, `migrations/0022_service_chat.sql`, `client/src/pages/admin/ServiceChat.tsx` | Service Chat: выбор хоста, шаблонные цепочки after-read для новых пользователей, рассылки all/selected/personal, папка `Приглашения`, глобальная и локальная обратная связь |
| 2026-03 | `client/src/lib/chat-offline-store.ts`, `client/src/lib/media-offline-cache.ts`, `client/src/hooks/useOfflineResolvedMediaUrl.ts` | Android/offline: локальный кеш списка чатов, последних сообщений и уже просмотренных медиа; резолв локального media URL для офлайн-открытия |
| 2026-04 | `client/src/lib/profile-offline-store.ts`, `client/src/lib/offline-session-cache.ts`, `Chats.tsx` (IDB-hydrate + `online`), `useUserProfileOtherProfileState.ts`, `BackgroundSyncBar.tsx`, `SettingsDataMemoryCard.tsx` | Кеш чужого профиля в IndexedDB (LRU); логаут — `clearSessionOfflineCaches` + `queryClient.clear`; чаты из IDB до сети; `online` → refetch; полоса фонового синка в чатах и на чужом профиле; в «Данные и память» — очистка кеша чатов/профилей без медиа |
| 2026-03 | `EDGE/`, `server/edge/`, `client/src/lib/edge-gamification.ts` | Новый изолированный EDGE микросервис (gamification/game logic) + тонкий адаптер `/api/edge/*` в основной платформе; модуль `companion` с состоянием персонажа, заданиями и лидербордом |
| 2026-03 | `EDGE/docs/EDGE_ENGINE_ARCHITECTURE.md` | Архитектура движка: кампании, surfaces, задания (EDGE + platform), лидерборд, призы/итоги, Board создателя, эволюция под новые UI (каталог) |
| 2026-03 | `client/src/features/edge-companion/`, `client/src/pages/EdgeCompanion.tsx`, `client/src/pages/Posts.tsx` | EDGE в ленте: блок кампании в теле поста (`posts.edge_id`), те же метрики что у обычного поста; `MeasuredFeedItem` + `recordPostView` при скролле; экран `/edge/companion` |
| 2026-03 | `GET /api/edge/companion/campaign-config`, `client/src/lib/edge-gamification.ts` | Клиент `fetchEdgeCompanionCampaignConfig`; прокси на EDGE, без upstream — `503` (`edge_upstream_not_configured` / `edge_companion_unavailable`) |
| 2026-03 | `docs/EDGE_MICROSERVICE_PLAN.md` | План выноса EDGE в отдельный микросервис (`EDGE/`, своя БД, роутеры по подпапкам, файлы ≤200 строк, билд в `dist/edge.cjs`, PM2, прокси с платформы) |
| 2026-03 | `docs/EDGE_PRODUCT_SPEC.md` | Продукт EDGE: тип интерактивного контента на борде; типы (персонаж, рулетка, каталог, квиз, квест, челлендж); создатель/участники; задания (персонаж/глобальные/коммерческие); баллы, лидерборд, гибкие призы и выдача в ЛС через платформу |
| 2026-03 | `docs/EDGE_LEADERBOARDS_AND_PRIZES_SPEC.md` | Два типа рейтингов (основной / дополнительный), вкл-выкл, вторая страница Companion; приз — в каком рейтинге участвует; момент выдачи → заморозка рейтинга до ручного сброса создателем |
| 2026-03 | `EDGE/campaign/*`, `EDGE/migrations/0003_edge_prize_winners.sql`, `POST /v1/campaign/draw`, `server/admin/edge-prize.routes.ts` | Розыгрыш: случайные победители среди участников (исключая уже награждённых по `gift_key`), `edge_prize_winners`; платформа `POST /api/admin/edge/draw-prize` + ЛС победителям |
| 2026-03 | `client/src/features/edge-companion/edge-uix.ts` | Токены поверхностей EDGE Companion: `EDGE_CARD`, `EDGE_INSET`, чипы и кнопки в стиле `--uix-*` / `primary`, без «радужных» градиентов вне системы |
| 2026-03 | `EDGE/participant/leaderboard` + `interact`, `client/.../EdgeLeaderboardCard.tsx` | Лидерборд по XP (JOIN participants + character_states), ранг «я» через `ROW_NUMBER`; действия `play`/`pet` (+XP/+happy, кулдаун 4 ч в `extra`); прокси `/api/edge/participant/leaderboard`, `/interact` |
| 2026-03 | `EDGE/participant/types.ts` (`platformUserId` в JSON для платформы), `server/edge/leaderboard-enrich.ts`, `EdgeLeaderboardCard` + `UserAvatar` | Лидерборд в клиенте: имя и аватар из `users` на платформе (batch по id участников); в браузер не отдаётся `platformUserId` |
| 2026-03 | `companion.surfaces`: `tasks` в `CompanionSurfaceId`, `TasksSurfacePanel`, `EdgePresetTasksCard` `variant="surface"`, `resolveVisibleSurfaces(taskPresetsCount)` | Свайп «Задания» слева от «Персонаж» (нормализация порядка в `campaign-ui-config` + клиент); яркий hero + карточки заданий; без заданий слайд скрыт; подсказка на экране персонажа |
| 2026-03 | `client/src/lib/auth-return-path.ts`, `Login.tsx`, `Onboarding.tsx` | После входа/регистрации возврат на сохранённый внутренний URL (пост автора `/profile/…/post/…`, EDGE и т.д.); новый пользователь — после онбординга тот же URL |
| 2026-03 | `client/src/features/auth/login/` (`useLoginPageController.ts`, `useLoginReferralQueryPrefill.ts`, `useLoginPhoneCallVerificationGate.ts`, `LoginMainFormView.tsx`, `LoginRegisterCallVerifyBlock.tsx`), `pages/Login.tsx` | Вход/регистрация: контроллер, префилл `?ref=`, флаг звонка New-Tel, UI формы; страница — тонкая оболочка |
| 2026-03 | `client/src/features/auth/password-reset/` (`password-reset-api.ts`, `ForgotPasswordPanel.tsx`, `useForgotPasswordPanel.ts`) | Восстановление пароля по звонку на клиенте |
| 2026-03 | `server/auth/new-tel/`, `register-password-reset-routes.ts`, `app-store-review-referral.ts` | New-Tel (регистрация и сброс), HTTP `/api/auth/password-reset/*`, рефкод App Store Review (`APP_STORE_REVIEW_REFERRAL_CODE`) |
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
| 2026-03 | `EdgeCompanionFeedHero.tsx`, `EdgeFeedSurfacePager.tsx`, `EdgeFeedCharacterSlide.tsx`, `render-feed-slide.tsx`, `edge-feed-play-state.ts`, `edge-embla-scroll.ts`, `use-embla-viewport-height-sync.ts` | EDGE в посте: квадрат 1:1; свайп между экранами без рейки табов в ленте (рейка + строка подсказки только в полноэкранном `CompanionSurfacePager`); лёгкие градиенты/шевроны по краям карусели в ленте; вертикаль — скролл ленты; высота viewport Embla под активный слайд |
| 2026-03 | `edge-intro-onboarding.ts`, `EdgeIntroFootnote.tsx`, `EDGE/.../game-script-metrics` (`edgeIntroTapCount`, `bumpIntroTapCount`), `participant/payload` `introTapCount`, `EdgeFeedSurfacePager`, `EdgeCompanion`, `CompanionSurfacePager` | Онбординг первого знакомства с EDGE: шаг 1 — **25 тапов** (счётчик на сервере); шаг 2 — заход в полную игру (`/edge/…`, флаг в `localStorage` после 25 тапов); шаг 3 — свайп на другой surface (если в кампании >1 экрана); блок-подсказка в ленте и на полном экране, тост при завершении |
| 2026-03 | `CompanionSurfacePager.tsx`, `EdgeCompanion.tsx`, `EdgeCompanionCampaignShell.tsx` | Полный `/edge/:id`: вертикальный скролл всей области под шапкой; слайды без внутреннего `overflow-y-auto`; Embla `dragThreshold` + синхронизация высоты viewport со слайдом |
| 2026-03 | `client/src/features/edge-companion/feed-delight/*`, `feed-delight/index.ts`, `index.css` (`.edge-feed-*`) | Полировка UI: entrance карточки (`variant=feed`), `build-swipe-hint` + строка под точками в ленте и в `CompanionSurfacePager`, аура/«Ещё тап!»/подарок в ленте, пульс CTA; `EdgeCompanionFeedCard` default `feed`, `banner` без entrance; `ARCHITECTURE.md` |
| 2026-03 | `EdgeCompanionCharacterHero.tsx`, `EdgeParticipantPetCard.tsx`, `/edge/:edgeId`, `edge-companion-navigation.ts` | Companion: короткий URL `/edge/{edgeId}?back=` + редирект с `/edge/companion?edgeId=`; экран персонажа без карточек у метрик; облако — одна фраза настроения; одна оранжевая CTA + «Ещё действия» (меню) |
| 2026-03 | `EDGE/companion/prize-results-repo.ts`, `build-results-live.ts`, `resultsLive` в campaign-config; `EDGE/campaign/companion-config-update.ts`, `POST /v1/campaign/companion-config`; `server/admin/edge-companion-admin.routes.ts`; `client/.../admin/EdgeCompanion.tsx` | Итоги розыгрыша из `edge_prize_winners`; админка JSON для `companion` |
| 2026-03 | `useChatMessages.ts`, `Chats.tsx`, `ChatMessageRow.tsx`, `message-delivery-status.ts`, `lib/external-video.ts`, `ExternalVideoEmbedCard.tsx`, `server/chats/service.ts` | Чат: стартовый скролл к первому непрочитанному (`myLastReadAt`), единые галочки доставки/прочтения для текста/аудио/кружка; превью YouTube/RuTube/Яндекс по тапу; список чатов: бейдж непрочитанных и сортировка по последнему сообщению |
| 2026-03 | `EDGE/creator/` (`campaign-mutate-repo`, `merge-creator-config`, `POST/PATCH/GET` campaigns), `BoardEdgeNew.tsx` (мастер), `edge-creator.ts`, `server/edge/routes.ts` | Создание/редактирование кампании с Борда; `companion.character` + PNG в Companion; пост с `?edgeId=` |
| 2026-03 | `EDGE/follow-reward/follow-dm-config.ts`, `server/users/edge-follow-dm-sender.ts`, `call-follow-reward.ts` | Авто-ЛС подписчику от создателя по `followRewardDm` после первого follow |
| 2026-03 | `EDGE/campaign/draw-eligible.ts`, `prize-rules-parse.ts`, `gifts-parse` quantity, `companion/interact-lock.ts` | Розыгрыш: топ-N пул, first/random, лимит призов; блокировка interact по статусу/дате |
| 2026-03 | `EDGE/money/`, `features/edge-money-board/`, `features/edge-money-template/`, `lib/edge-money-public.ts`, **`docs/EDGE_MONEY_ARCHITECTURE.md`** | EDGE MONEY: конфиг + борд + UI игрока; архитектура ролей (создатель vs пользователь) |
| 2026-03 | `server/edge-money-invite/`, `shared/schema/edge-money-invite-batches.ts`, `referral_codes.edge_money_invite_batch_id`, `scripts/migrate-edge-money-invite-batches.cjs`, **`docs/EDGE_MONEY_INVITE_FOUR_BLOCKS.md`** | EDGE MONEY приглашения: блок 1 — партии кодов, gate «следующая тройка», Drizzle + createReferralCode(batchId) |
| 2026-03 | `docs/edge-money-chat-scoring/` (`README.md`, `01`–`04`), `docs/EDGE_MONEY_ARCHITECTURE.md` (ссылка) | План модуля начисления за сообщения в ЛС: 4 файла ≤250 строк; продукт, платформа, EDGE, тесты/выкат |
| 2026-03 | `server/edge-money-chat-messages/`, `migrate-edge-money-chat-counters.cjs`, `EDGE/money/*` (chat-accrual-targets, `apply-chat-messages-milestone`, `sum-xp-for-task-key-utc-day`), `messages/service` | EDGE MONEY: баллы за сообщения в ЛС по диалогу, дневной лимит UTC, исключение service-chat |
| 2026-03 | `server/edge-money-call-minutes/`, `migrate-edge-money-call-counters.cjs`, `EDGE/money/call-accrual-targets`, `apply-video-call-minutes-milestone`, `calls/session` | EDGE MONEY: баллы за минуты звонка 1:1 (`video_call_minutes`), оба абонента |
| 2026-03 | `POST/GET /api/edge/money/ping-invite-pack` / `invite-progress`, `money-campaign-viewer-access.ts`, `money.inviteDm` (EDGE parse + merge), `lib/edge-money-invite-api.ts`, `auth/routes` + `after-consume` | Блок 2: выдача 3 кодов + ЛС + прогресс; закрытие партии после регистраций |
| 2026-03 | `EDGE/money/platform-events/*`, `POST/GET /v1/money/platform-events` + `invite-grants-sum`, `grants-repo.sumXpForTaskKey`, `forward-money-invite-registered.ts`, `invite-friend-row/EdgeMoneyInviteFriendRow.tsx` | Блоки 3–4: начисление XP за регистрацию по коду партии; UI приглашения в MONEY |
| 2026-03 | `EDGE/follow-reward/apply-follow-reward.ts`, `EDGE/money/platform-events/apply-money-follow-creator-reward.ts`, `EDGE/companion/follow-reward-campaigns.ts` (money исключён из companion follow XP), `list-published-money-campaign-ids-for-creator.ts` | MONEY: баллы за подписку на создателя по правилу `follow_creator` в `money.scoringRules` (отдельный grant `money_follow_creator`, без двойного XP companion `follow_creator`) |
| 2026-03 | `migrate-edge-money-post-profile-counters.cjs`, `EDGE/money/platform-events/apply-post-created-milestone.ts`, `apply-profile-likes-received-milestone.ts`, `server/edge-money-post-created/`, `server/edge-money-profile-likes/` | MONEY: начисления за публикацию постов (`post_created`) и первые реакции других на посты автора (`profile_likes_received`) |
| 2026-03 | `EDGE/migrations/0006_edge_participants_money_tracking.sql`, `EDGE/money/participant-money-tracking.ts`, `POST/GET /api/edge/money/start-tracking` + `tracking-started`, вкладка «Задания» | MONEY: явный старт отслеживания заданий; без `money_tracking_started_at` не считаются инвайты/чат/звонок/follow/post/лайки |
| 2026-03 | `invite-dm-fields/MoneyInviteDmFields.tsx`, `hydrateMoneyInviteDm` / `inviteDmToMoneyPatch` в `edge-money-wizard.ts` | Борд: настройка `money.inviteDm` на шаге «Баллы», если включено правило приглашений |
| 2026-03 | `ПИНГОК МИКРО/` (включён в git), `ПИНГОК МИКРО/.gitignore`, корневой `.gitignore` | Микросервис голоса/оверлея версионируется в репо; `.env` в каталоге не коммитится |
| 2026-03 | `client/src/features/comments/`, `server/features/comments/`, `lib/comments.ts` | Комментарии к постам: модуль из 5 подпапок (post-comments, comment-replies, comment-reactions, comment-moderation, shared); файлы порциями ≤200 строк |
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
| 2026-03 | `client/src/pages/HelpInviteFriends.tsx` (`/help/invite-friends`), `client/src/lib/invite-more-request.ts`, `server/referrals/invite-more-service.ts`, `shared/schema/referrals.ts` (`invite_more_requests`), `scripts/migrate-invite-more-requests.cjs`, админка `pages/admin/Referrals.tsx` | Поясняющая страница про приглашения: тексты, цифровые коды с копированием, заявка на расширение лимита; API `POST/GET …/referrals/invite-more-request*`, админ одобряет (+3/+5 к `users.referral_limit`) или отклоняет |
| 2026-03 | `scripts/prepare-capacitor-assets.mjs`, `npm run capacitor:assets`, devDependency `@capacitor/assets`; `build:android` / `build:ios` (+ prod) | Иконка лаунчера и сплэш Android/iOS генерируются из `client/public/logo.png` (копия в `assets/logo.png` не в git); PWA-ветка генерации отключена (`--android` / `--ios` отдельно, без `www/manifest.json`) |
| 2026-03 | `migrations/0034_users_board_api_hub_prime_code.sql`, `scripts/migrate-board-api-hub-prime.cjs`, `shared/schema/users.ts`, `server/auth/routes.ts`, `server/admin/users/routes.ts`, `client/.../Board.tsx`, `BoardApiHub.tsx`, `admin/Users.tsx` | PRIME CODE в админке: колонка `board_api_hub_prime_code`, флаг `boardApiHubAccess` в login/register/me, плитка и страница API HUB на Борде |
| 2026-03 | `server/internal/api-hub-issue-bearer.ts`, `api-hub/src/platform/issue-platform-bearer.ts`, `api-hub/.../auth-routes.ts` | Единый Bearer `pm.*` для HUB→платформа: `POST /internal/api-hub/issue-user-bearer` + `API_HUB_SERVICE_SECRET`; при OIDC и заданных `API_HUB_PING_PLATFORM_URL`/секрете HUB кладёт `pm.*` в сессию (проверка PRIME на платформе) |
| 2026-03 | `api-hub/src/platform/ping-chats-client.ts`, `ping-platform-session.ts`, `routes/chat-routes.ts`, SDK `addReaction`/`updateStatus` | Чаты HUB: при `pm.*` в сессии — прокси на `/api/chats` и сообщения PING; иначе demo store; реакции/read — опциональный `chatId` в теле для платформы |
| 2026-03 | `api-hub/.../ping-chats-client.ts` (`proxyPlatformListContacts`), `routes/profile-routes.ts` | `GET /v1/contacts` при `pm.*` → `/api/contacts?list=1`, поле `pingUserId`; `/v1/me` к платформе только с `pm.*` |
| 2026-03 | `proxyPlatformAddContact`, `POST /v1/contacts`, SDK `addContact` | Добавление контакта на платформе через HUB (`chat.write`, только `pm.*`) |
| 2026-03 | `proxyPlatformUploadChatMedia`, `routes/platform-upload-routes.ts`, `multer`, SDK `uploadPlatformChatMedia` | Прокси загрузки в чат PING: `POST /v1/platform/chat-media` → `/api/upload/chat-media` |
| 2026-03 | `server/integrations/api-hub-bridge.ts`, `server/messages/service.ts`, `api-hub/.../internal-platform-bridge.ts`, `bridge-targets.ts`, `repository.listActiveSessionsForBridgeTargets` | Realtime-мост платформа→HUB: `POST /internal/platform/chat-message` (`event`: created/updated/deleted/reactions/transcript); хуки в сообщениях, удалении, редактировании, реакциях, ASR; типы событий в `api-hub` `RealtimeEnvelope` |
| 2026-03 | `api-hub` мост: `API_HUB_BRIDGE_ALLOWED_IPS`, `TRUST_X_FORWARDED`, метрики `api_hub_bridge_*`, `Idempotency-Key` + дедуп на HUB; платформа — ретраи и ключ идемпотентности; OpenAPI/SDK `realtime-types`, `docs/integration-example.md` |
| 2026-03 | `api-hub/docs/EXTERNAL_SERVICE_AUTH_GUIDE.md`, `sdk/js` `completeOAuth(code, state?)` | Гайд для внешних сервисов: вход/регистрация через аккаунты PING, mock/OIDC, PRIME, `pm.*`, callback; SDK — `state` для OIDC |
| 2026-03 | `api-hub/src/infra/bridge-idem-redis.ts`, `tests/bridge.test.ts`, `docs/prometheus-bridge-alerts.example.yml` | Идемпотентность моста в Redis (`API_HUB_REDIS_URL`); `config` getters для bridge/redis в тестах; примеры Prometheus-алертов; интеграционные тесты моста (401/202/idem/IP); Redis-тест по `API_HUB_TEST_REDIS_URL` |
| 2026-03 | `client/src/features/store-moderation/block-01-ugc/`, `shared/schema/content-reports.ts` (`story`), интеграции в `ChatDetail`, `Posts`, `PostDetail`, `UserProfile`, `StoryViewer` | Блок 1 модерации сторов: UI жалоб на сообщение/пост/пользователя/сториз → `POST /api/reports`; файлы модуля ≤~200 строк; следующие блоки — отдельные папки |
| 2026-03 | `client/src/features/store-moderation/block-02-legal/`, `pages/Terms.tsx`, `App.tsx` (`/terms`), `lib/legal.ts` (`getTermsOfUseUrl`), `SettingsMore`, `Login`, `Privacy` | Блок 2: публичные Условия использования для сторов; ссылки из настроек, входа и политики |
| 2026-03 | `features/store-moderation/block-03-app-store-admin/`, `pages/admin/StoreReview.tsx`, `AdminLayout` (`/admin/store-review`), `AdminApp.tsx` | Блок 3: отдельный раздел админки под Apple App Review (§1.2 UGC, чеклист, шаблон Notes) |
| 2026-03 | `features/store-moderation/block-04-app-privacy-connect/`, `pages/admin/StorePrivacyCompliance.tsx`, `AdminLayout`, `AdminApp` | Блок 4: админка под удаление аккаунта, App Privacy, export compliance, plist / ATT |
| 2026-03 | `features/store-moderation/block-05-app-store-metadata/`, `pages/admin/StoreMetadataCompliance.tsx`, `AdminLayout`, `AdminApp` | Блок 5: листинг App Store (скриншоты, метаданные, age rating); ссылки на developer.apple.com |
| 2026-03 | `features/store-moderation/block-06-apple-review-risks/`, `pages/admin/StoreReviewRisks.tsx`, `AdminLayout`, `AdminApp`, перекрёстные ссылки в блоках 3–5 | Блок 6: доп. риски Apple Review (IAP, 4.2/4.3, performance, capabilities) |
| 2026-03 | `shared/schema/content-reports.ts` (`comment`), `CommentsModal` / `CommentRow` / `CommentBlockMenu`, `OpsReportsSection`, `features/admin-moderation/`, `AdminLayout`, `AdminApp`, `Ops`, сторы 3–6 | Жалобы на комментарии; хаб «Модерация» вместо отдельных пунктов меню для операций и сторов |
| 2026-03 | `shared/schema/business-status-requests.ts`, `migrations/0053_business_status_requests.sql`, `migrations/0054_business_profile_contacts.sql`, `server/users/business-status-service.ts`, `server/users/routes.ts`, `server/admin/users/routes.ts`, `client/src/lib/business-status.ts`, `client/src/pages/EditProfile.tsx`, `client/src/pages/admin/BusinessStatusRequestsSection.tsx`, `client/src/features/profile/pulse-profile/layout/PulseBusinessBadge.tsx`, `PulseProfileBusinessContactsCard.tsx`, `docs/BUSINESS_STATUS_REQUESTS.md` | MVP бизнес-статуса + UIX выделение: заявка из профиля (reason + до 3 ссылок + consent), одна активная `submitted` заявка, модерация approve/reject/revision, аудит; для `approved` — визуальный бейдж и публичные контакты бизнеса (телефон/адрес) |
| 2026-03 | `validate-report-target` (`comment`), `is-valid-report-target.ts`, `OpsReportTargetCell`, `EdgeMoneyTasksPanel` props, `block-07-google-play-admin/`, `test:report-targets` | Валидация жалобы на комментарий; ссылки из админки на цель; Play; починка tsc |
| 2026-03 | `migrations/0042_content_reports_context.sql`, `content_reports.context_*`, `POST /api/reports` (`contextPostId`/`contextChatId`), `CommentsModal`, `ChatDetail`, `pr-quality-gate.yml` | Диплинки: комментарий → пост+`commentId`, сообщение → `/chat/:id`; CI: `test:report-targets` |
| 2026-03 | `server/reports/validate-*-report/`, `upload/post-media/` | Лента/посты (App Review): валидация жалоб по типам — одна папка на функцию; загрузка медиа поста разбита на файлы ≤~90 строк |
| 2026-03 | `features/posts/posts-feed-skeleton/`, `ListEmptyState` (вторичная кнопка), `pages/Posts.tsx` | Лента: скелетон 4 карточек + сториз; пустое состояние — pull-to-refresh + «Обновить ленту» |
| 2026-03 | `ReelsFeedSkeleton`, `PostDetailSkeleton`, `ProfilePostsTabSkeleton`, полировка `Posts`/`ReelsFeed`/`PostDetail`/`UserProfilePostsContent` | Пустая лента при refetch — баннер «Обновляем…»; Reels/пост/профиль — скелетоны; ошибка сети поста ≠ 404; вторичные «Обновить» |
| 2026-03 | `UserProfilePostsContent`, `useUserProfilePage`, `UserProfile`, `ReportContentDialog`, `UserProfileOtherNotFoundShell`, `server/admin/dashboard/routes.ts` | **Критично:** вкладка «Сохранено» — реальные `savedPosts`, шапка карточки = автор поста, меню владельца/жалобы по `post.authorId`, lookup авторов для `CommentsModal`, pull-refresh инвалидирует saved; профиль «не найден» — «Повторить»; текст модерации в жалобе; `role="main"` ленты; починка tsc dashboard |
| 2026-03 | `ModerationHubPage`, `OpsReportsSection`/`adminOpsUi`, `ReportContentDialog`/`block01ugcRu`, `StorePlayCompliancePage`, `play-release-rows`, `StoreModerationAdminPage`, `build-review-notes-template` | Хаб модерации — оба стора; очередь жалоб — SLA + шпаргалки Apple/Play; жалоба — ссылки Условия/Конфиденциальность; Play — кнопка «листинг»; чеклист релиза Play — паритет с Apple UGC |
| 2026-04 | `client/src/features/push/`, `pages/Chats.tsx` | Push исходящие: «Создать Push» (drawer) — текст до ~5 строк, одно фото/видео, срок TTL; тот же пайплайн, что у поста с «Отправить в Push»; в карточке ленты Push — кликабельные ссылки и превью видео по URL |
| 2026-04 | `pages/chats/ChatRow.tsx`, `chats-list-format.ts`, `features/chat/chat-query-keys.ts`, `prefetch-chat-messages-tail.ts`, `hooks/chat-messages/*`, `video-note/VideoNoteBubble.tsx`, `MediaLoadError.tsx`, `lib/chat-bootstrap-flag.ts`, `docs/PERFORMANCE_QA_CHECKLIST.md`, `SLO_CHAT_DRAFT.md`, `WS_API_VERSIONING.md`, `CHAT_THREAD_VIRTUALIZATION.md`, `CHAT_QUERY_CONTRACT.md`, `@tanstack/react-virtual` | Perf / UX-confidence: вынесен `ChatRow`, prefetch хвоста + RQ keys + инвалидация после отправки текста; хелперы merge/API error из `useChatMessages`; медиа retry и кружок; чеклисты и SLO-черновик; виртуализация — задокументирована, пакет подключён |
| 2026-04 | `shared/group-call-limits.ts`, `server/lib/outgoing-request-id.ts`, `GET /api/health`, `docs/MULTISERVICE_RUNBOOK.md` | Лимит mesh групповых звонков в shared; `X-Request-Id` на исходящие вызовы к EDGE/PARSER с основных маршрутов; health JSON; runbook мультисервиса |

---

## Миграции и деплой (сводка)

Полный порядок миграций **основной БД**, **EDGE**, **PARSER**, что делает `deploy` / `server-setup.sh`, и чеклист после многих PR — в **`docs/MIGRATIONS_AND_DEPLOY_CHECKLIST.md`**.

---

## Связанная документация

| Документ | Зачем |
|----------|--------|
| `docs/AUDIT_127_INDEX.md` | Полный аудит продукта на **127 частей** (функции, безопасность, мобайл, UIX, метрики) — индекс и ссылки на `docs/audit-127/PARTS_*.md` |
| `docs/MIGRATIONS_AND_DEPLOY_CHECKLIST.md` | Три контура миграций + порядок `run-migrations.cjs` + чеклист |
| `docs/ARCHITECTURE.md` | Короткий индекс ссылок |
| `docs/API_AUTH_AND_PUBLIC.md` | Авторизация (cookie + Bearer), публичные API, PATCH/PUT |
| `docs/DEV_HANDOFF_CURSOR.md` | Handoff для разработчиков |
| `docs/AI_HANDOFF_ARCHITECTURE.md` | Handoff для ИИ-агента |
| `docs/QUALITY_CHECKLIST.md`, `docs/UIX_SPECIALIST_GUIDE.md` | Качество UI |
| `docs/PERFORMANCE_CONFIDENCE_AUDIT.md` | Аудит скорости и UX-уверенности по 5 этапам (клиент, API, realtime, медиа, архитектура) |
| `docs/PERFORMANCE_CONFIDENCE_FORWARD_ROADMAP.md` | Опережающая дорожная карта: инварианты, ставки «из будущего» по направлениям, волны внедрения A–D |
| `docs/PERFORMANCE_CONFIDENCE_AUDIT_PLAIN_RU.md` | Пересказ аудита простым языком (сейчас / предлагаем / критерий «лучше») по всем пунктам 5 этапов |
| `docs/PERFORMANCE_QA_CHECKLIST.md` | Ручная приёмка после perf-изменений (чат, список, медиа) |
| `docs/SLO_CHAT_DRAFT.md` | Черновик p95 целей для открытия чата и списка сообщений |
| `docs/WS_API_VERSIONING.md` | Процесс ломающих изменений WS/API |
| `docs/CHAT_THREAD_VIRTUALIZATION.md` | Ограничения виртуализации треда; связь с `@tanstack/react-virtual` |
| `docs/CHAT_QUERY_CONTRACT.md` | Ключи React Query для чата и prefetch |
| `docs/CHAT_DETAIL_RULES.md` | Контракт хуков чата |
| `docs/DEPLOY_RULES.md` | Деплой |
| `docs/MULTISERVICE_RUNBOOK.md` | Логи по `X-Request-Id`, health, EDGE/PARSER |
| `docs/CALLS_TURN_SETUP.md` | Coturn / TURN для звонков (`VITE_TURN_*`, проверка бандла) |
| `docs/CALLS_RELIABILITY.md` | Звонки 1:1: инварианты (один WS на пользователя, порядок accept/offer), чеклист регрессий |
| `docs/CALLS_EDGE_CASES.md` | Звонки 1:1: дубли сокетов/хуков, glare, обрыв связи, перезагрузка страницы |
| `docs/CALLS_1TO1_RELEASE_CHECKLIST.md` | Smoke/regression чеклист 1:1 перед релизом (happy path, redial, glare, ws drop, multi-tab) |
| `docs/ENV_REFERENCE.md` | Сводка `VITE_*` / серверных env, что копирует `deploy.sh` в `.env` на VPS |
| `docs/DB.md` | БД и storage |
| `docs/EDGE_PRODUCT_SPEC.md`, `docs/EDGE_MICROSERVICE_PLAN.md`, `docs/EDGE_DATABASE.md`, `docs/EDGE_FUNCTIONAL_ROADMAP.md` | Продукт, план, БД и пошаговый функционал EDGE |
| `docs/edge-money-chat-scoring/README.md` | EDGE MONEY: план модуля баллов за сообщения в диалогах (4 блока, ≤250 строк на файл) |
| `AGENTS.md` | Контекст репозитория для агентов |

---

## Чек перед merge крупных структурных изменений

1. `npm run check` / при необходимости `npm run build`.
2. Обновлён **`docs/PROJECT_MAP.md`** (таблицы + журнал модулей).
3. Нет «тихого» расхождения: новые папки перечислены, удалённые — убраны из карты.
