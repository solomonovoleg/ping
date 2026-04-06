# Аудит: части 001–014 (функциональность)

Краткий обзор возможностей, корректности, известных проблем и слабых мест по доменам. Источники: `docs/PROJECT_MAP.md`, `docs/UNSTABLE_OR_POORLY_WORKING.md`, структура `server/` и `client/src/features/`.

---

<a id="part-001"></a>
## Часть 001 — Auth, онбординг, deep return

**Возможности:** cookie-сессия + Bearer (`docs/API_AUTH_AND_PUBLIC.md`), вход/регистрация, восстановление пароля (`features/auth/`), возврат на глубокий URL через `client/src/lib/auth-return-path.ts` с whitelist.

**Корректность:** Секрет сессии валидируется по длине; fallback только при `ALLOW_INSECURE_SECRETS=1` (`server/auth/session.ts`). Таблица `session` создаётся при старте.

**Проблемы / слабые места:** Админ-сессия отдельным флагом в той же store — важно не пересекать с user-сессией в UI. New-Tel и внешние webhooks — отдельная поверхность атаки (проверять подписи/секреты в env).

### Metrics — Часть 001

| Метрика | Значение |
|---------|----------|
| **Coverage** | 70% |
| **HealthScore** | 4 |
| **Risk** | P0: 0, P1: 1, P2: 2 |
| **Reliability** | Green — сессии в PG переживают рестарт |
| **UXFriction** | 2 |
| **ParityVsGiants** | 3 (Telegram) |
| **Evidence** | `server/auth/session.ts`, `client/src/lib/auth-return-path.ts`, `docs/API_AUTH_AND_PUBLIC.md` |

---

<a id="part-002"></a>
## Часть 002 — Чаты, сообщения, медиа

**Возможности:** список чатов, папки, DM/группы, лента сообщений, медиа-галерея, шаринг в ЛС, идемпотентная отправка (`Idempotency-Key`), парсинг вложений/таблиц.

**Корректность:** Разнесённые модули `server/messages/`, `server/chats/`; исправления «старые сообщения при 404» и дубликаты WS задокументированы в UNSTABLE.

**Проблемы:** Первые секунды после входа WS может ещё не подписать чаты; visibility/read иногда с тихим `.catch` (см. UNSTABLE §2).

### Metrics — Часть 002

| Метрика | Значение |
|---------|----------|
| **Coverage** | 65% |
| **HealthScore** | 4 |
| **Risk** | P0: 0, P1: 2, P2: 3 |
| **Reliability** | Amber — зависимость от WS + корректности read-курсора |
| **UXFriction** | 3 |
| **ParityVsGiants** | 4 (Telegram) |
| **Evidence** | `server/realtime/chat.ts`, `docs/CHAT_DETAIL_RULES.md`, `docs/UNSTABLE_OR_POORLY_WORKING.md` |

---

<a id="part-003"></a>
## Часть 003 — Звонки 1:1

**Возможности:** токен `/api/calls/token`, WS `/calls`, WebRTC (`simple-peer`), UI в `features/call/`.

**Корректность:** Документированные инварианты в `docs/CALLS_RELIABILITY.md` (один WS на пользователя, порядок signaling).

**Проблемы:** Много тихих `catch` в `useCall`; обрывы сети — пользователь видит общую ошибку; TURN обязателен для прод (`docs/CALLS_TURN_SETUP.md`).

### Metrics — Часть 003

| Метрика | Значение |
|---------|----------|
| **Coverage** | 60% |
| **HealthScore** | 3 |
| **Risk** | P0: 0, P1: 2, P2: 4 |
| **Reliability** | Amber — P2P + WS чувствительны к сети и табам |
| **UXFriction** | 3 |
| **ParityVsGiants** | 3 (WhatsApp) |
| **Evidence** | `docs/CALLS_RELIABILITY.md`, `docs/CALLS_EDGE_CASES.md`, `server/calls/` |

---

<a id="part-004"></a>
## Часть 004 — Групповые звонки

**Возможности:** `features/group-call/`, отдельный WS transport, mesh, флаги в `docs/CALLS_GROUP.md`.

**Корректность:** Архитектурно отделены от 1:1.

**Проблемы:** Mesh не масштабируется как SFU; nginx `/group-calls` и лимиты должны быть явно проверены на проде.

### Metrics — Часть 004

| Метрика | Значение |
|---------|----------|
| **Coverage** | 45% |
| **HealthScore** | 3 |
| **Risk** | P0: 0, P1: 1, P2: 3 |
| **Reliability** | Amber |
| **UXFriction** | 4 |
| **ParityVsGiants** | 2 (Zoom/Meet — SFU) |
| **Evidence** | `docs/CALLS_GROUP.md`, `server/group-calls/` |

---

<a id="part-005"></a>
## Часть 005 — Лента и посты

**Возможности:** глобальная лента, ранжирование + снапшот (`server/feed/`), посты с EDGE `edge_id`, сохранённые, шаринг.

**Корректность:** Модульный разнос `list-posts-for-viewer-*`, `post-public-dto`.

**Проблемы:** Воркер снапшота — отдельная точка отказа; лимиты ленты и сиды описаны в `docs/SEED_SOCIAL_AND_FEED.md`.

### Metrics — Часть 005

| Метрика | Значение |
|---------|----------|
| **Coverage** | 55% |
| **HealthScore** | 4 |
| **Risk** | P0: 0, P1: 1, P2: 2 |
| **Reliability** | Amber — зависимость от feed worker |
| **UXFriction** | 2 |
| **ParityVsGiants** | 4 (Instagram лента) |
| **Evidence** | `server/posts/`, `server/feed/`, `docs/EDGE_PRODUCT_SPEC.md` |

---

<a id="part-006"></a>
## Часть 006 — Комментарии

**Возможности:** модалка, ответы, реакции, @упоминания (`features/comments/`), жалобы на комментарий.

**Корректность:** Серверные маршруты в `server/features/comments/`.

**Проблемы:** Сложность модалки + вложенные списки — следить за виртуализацией и фокусом a11y.

### Metrics — Часть 006

| Метрика | Значение |
|---------|----------|
| **Coverage** | 50% |
| **HealthScore** | 4 |
| **Risk** | P0: 0, P1: 1, P2: 2 |
| **Reliability** | Green для HTTP |
| **UXFriction** | 3 |
| **ParityVsGiants** | 4 (Instagram) |
| **Evidence** | `features/comments/README.md`, `server/features/comments/` |

---

<a id="part-007"></a>
## Часть 007 — Сториз

**Возможности:** публикация, просмотр, `StoryViewer`, интеграция в профиль.

**Корректность:** TTL и лимиты в доках по сидам.

**Проблемы:** Медиа и фоновые обновления на мобайле — батарея и кэш.

### Metrics — Часть 007

| Метрика | Значение |
|---------|----------|
| **Coverage** | 50% |
| **HealthScore** | 4 |
| **Risk** | P0: 0, P1: 1, P2: 2 |
| **Reliability** | Amber — медиа |
| **UXFriction** | 2 |
| **ParityVsGiants** | 4 (Instagram) |
| **Evidence** | `server/stories/`, `client/src/components/story-viewer/` |

---

<a id="part-008"></a>
## Часть 008 — Профиль, подписки, блок

**Возможности:** PULSE-оболочка, лента постов пользователя, mutual, блок с флагами ограничений (`features/user-blocking/`).

**Корректность:** Storage-слой блокировок вынесен в модули `db-storage-user-block-*`.

**Проблемы:** EDGE-подписки и фильтра ленты при блоках — проверять согласованность с `post-access`.

### Metrics — Часть 008

| Метрика | Значение |
|---------|----------|
| **Coverage** | 55% |
| **HealthScore** | 4 |
| **Risk** | P0: 0, P1: 1, P2: 2 |
| **Reliability** | Green |
| **UXFriction** | 2 |
| **ParityVsGiants** | 4 (Instagram профиль) |
| **Evidence** | `features/profile/`, `server/users/`, `features/user-blocking/` |

---

<a id="part-009"></a>
## Часть 009 — Уведомления и пуш

**Возможности:** колокол, FCM токен, серверные отправки; часть ошибок пуша тихо глотается на сервере (см. UNSTABLE).

**Корректность:** Тост при ошибке регистрации пуша на клиенте (исправлено по UNSTABLE §3).

**Проблемы:** `sendPushToUser(...).catch(() => {})` на сервере — нет алерта при сбое провайдера.

### Metrics — Часть 009

| Метрика | Значение |
|---------|----------|
| **Coverage** | 55% |
| **HealthScore** | 3 |
| **Risk** | P0: 0, P1: 2, P2: 2 |
| **Reliability** | Amber — внешний FCM |
| **UXFriction** | 3 |
| **ParityVsGiants** | 3 (Telegram) |
| **Evidence** | `server/notifications/`, `features/push/`, `docs/UNSTABLE_OR_POORLY_WORKING.md` |

---

<a id="part-010"></a>
## Часть 010 — Настройки и данные

**Возможности:** тема (`html.dark`), приватность, уведомления, чат, медиа, память/кэш (`SettingsDataMemoryCard`).

**Корректность:** Маршруты `pages/Settings*.tsx`.

**Проблемы:** Много подстраниц — проверять единообразие empty/error состояний.

### Metrics — Часть 010

| Метрика | Значение |
|---------|----------|
| **Coverage** | 45% |
| **HealthScore** | 4 |
| **Risk** | P0: 0, P1: 0, P2: 2 |
| **Reliability** | Green |
| **UXFriction** | 2 |
| **ParityVsGiants** | 3 (Telegram settings) |
| **Evidence** | `features/settings/`, `pages/Settings*.tsx` |

---

<a id="part-011"></a>
## Часть 011 — EDGE companion + EDGE Money

**Возможности:** карточка в ленте, полноэкранный поток (`features/edge-companion/`), начисления за чат/звонки/посты (`server/edge-money-*`, доки EDGE MONEY).

**Корректность:** Прокси платформы `/api/edge/*`, отдельный сервис EDGE.

**Проблемы:** Много подсистем и env-флагов; при отключенном EDGE UX должен деградировать предсказуемо.

### Metrics — Часть 011

| Метрика | Значение |
|---------|----------|
| **Coverage** | 40% |
| **HealthScore** | 3 |
| **Risk** | P0: 0, P1: 2, P2: 4 |
| **Reliability** | Amber — два бэкенда |
| **UXFriction** | 4 |
| **ParityVsGiants** | 2 (нет прямого аналога) |
| **Evidence** | `EDGE/`, `features/edge-companion/`, `docs/EDGE_MONEY_ARCHITECTURE.md` |

---

<a id="part-012"></a>
## Часть 012 — ПИНГОК МИКРО и напоминания

**Возможности:** long-press логотипа, STT, parse, execute, напоминания API (`server/reminders/`), интеграция с чатами/звонками.

**Корректность:** Реэкспорт кнопки из `@pingok-micro` зафиксирован в UNSTABLE.

**Проблемы:** Отдельный процесс и секреты; сценарии ошибок распознавания речи.

### Metrics — Часть 012

| Метрика | Значение |
|---------|----------|
| **Coverage** | 45% |
| **HealthScore** | 3 |
| **Risk** | P0: 0, P1: 1, P2: 3 |
| **Reliability** | Amber |
| **UXFriction** | 4 |
| **ParityVsGiants** | 2 (голосовые ассистенты) |
| **Evidence** | `server/pingok-micro/`, `ПИНГОК МИКРО/`, `AGENTS.md` |

---

<a id="part-013"></a>
## Часть 013 — Борд: SENDER, BUSINESS, API HUB, треки

**Возможности:** welcome в ЛС, business-коннектор, доступ по prime code, треки и история звонков на борде.

**Корректность:** Изолированные API и схемы (`sender-welcome`, `business-chat`).

**Проблемы:** Сильные права у борда — критично не экранировать лишнего через `boardApiHubAccess`.

### Metrics — Часть 013

| Метрика | Значение |
|---------|----------|
| **Coverage** | 40% |
| **HealthScore** | 3 |
| **Risk** | P0: 0, P1: 2, P2: 2 |
| **Reliability** | Green при корректных ролях |
| **UXFriction** | 3 |
| **ParityVsGiants** | N/A (B2B) |
| **Evidence** | `server/sender/`, `server/business-chat/`, `pages/Board*.tsx` |

---

<a id="part-014"></a>
## Часть 014 — Админка, VK parser, медиа-студия

**Возможности:** ops, пользователи, диск, VK parser + PARSER MS, медиа-студия synthetic users.

**Корректность:** Отдельные маршруты `/api/admin`, `requireAdmin`.

**Проблемы:** Админка — высокий риск при ошибках RBAC; парсер и внешние сети — изоляция секретов.

### Metrics — Часть 014

| Метрика | Значение |
|---------|----------|
| **Coverage** | 45% |
| **HealthScore** | 3 |
| **Risk** | P0: 0, P1: 3, P2: 2 |
| **Reliability** | Amber |
| **UXFriction** | 3 |
| **ParityVsGiants** | N/A |
| **Evidence** | `server/admin/`, `PARSER/`, `features/admin/media-studio/` |
