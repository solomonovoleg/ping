# EDGE с Борда создателя — как включаем и что строим

Документ фиксирует **продуктовый сценарий** (как ты описал) и **связь с текущим кодом**. Реализация идёт **по фазам**; файлы кода — по правилу ≤200 строк.

---

## Как это включается сейчас (фаза 0–1, в коде)

1. **Борд → EDGE → Новый EDGE** (`/board/edge/new`): мастер создаёт **черновик** в EDGE (`POST /api/edge/creator/campaigns` → `POST /v1/creator/campaigns`), UUID = будущий `edgeId`. Дальше шаги: персонаж (имя + PNG → `config_json.companion.character`), призы → `gifts_json`, правила пула/метода, подписка + заготовка авто-ЛС в JSON, задания в `taskPresets`, сроки в `schedule`, **Опубликовать** (`status: published`).
2. **Пост:** **`/create-post?edgeId=…`** или кнопка «Пост с EDGE» в списке кампаний — `POST /api/posts` с `edgeId`.
3. Админка **`/admin/edge-companion`** по-прежнему может править **`config_json.companion`** (JSON), в т.ч. `character` рядом с мастером.
4. Розыгрыш: **`/api/admin/edge/draw-prize`**; итоги в Companion — **`resultsLive`** из `edge_prize_winners`.

**Список «мои кампании»:** **`GET /api/edge/my-campaigns`**. **Редактирование:** **`GET/PATCH /api/edge/creator/campaigns/:edgeId`** (только владелец по `creator_platform_user_id`).

---

## Целевой сценарий (полный конструктор)

### 1. Борд → «Добавить элемент» → каталог EDGE

- Пока **один тип**: **«Персонаж»** (тамагочи / companion).
- Дальше: рулетка, каталог, квиз — как в `EDGE_PRODUCT_SPEC.md`.

### 2. Мастер создания «Персонаж»

| Шаг | Данные | Где хранить (цель) |
|-----|--------|---------------------|
| Ассет | PNG на прозрачном фоне | URL в `config_json` (например `companion.character.assetUrl`) + загрузка через существующий **upload/постовый** пайплайн |
| Имя для людей | Строка | `edge_campaigns.title` + опционально `config_json.companion.displayName` |
| Призы | Текст; текст + картинка/видео; **кол-во экземпляров** на приз | `gifts_json.templates[]`: `key`, `title`, `description`, `media`, `quantity` (расширение схемы) |
| Правило выбора победителей | Топ N / все участники / случайно / «кто первый» | `config_json.prizeRules` (DSL или enum + параметры) — **пока фактически**: ручной draw из пула участников в админке |
| Награда за подписку | Да/нет; авто-ЛС после follow (текст ± медиа) | `follow_reward_enabled` + новый блок `config_json.followRewardDm` + хук на платформе (расширение) |
| Очки | Задания игры / глобальные / коммерческие; +N / штраф; срок | `config_json.tasks` (уже частично: `tasks` для XP ленты); расширить под типы scope |
| Итоги и сброс рейтинга | «Каждую субботу» / конкретная дата | `config_json.schedule`: `drawCron`, `leaderboardResetCron`, `nextDrawAt` |
| Завершение кампании | Дата окончания; после — только просмотр итогов | `status = ended` + `config_json.endsAt`; клиент Companion **не даёт** interact (только итоги/призы) |

### 3. Управление EDGE (плитки)

- **Созданные / Активные / Черновики / Завершённые** — фильтр по `status` + локально по датам.
- **Статистика**: участники (уже можно считать в EDGE), просмотры поста — с платформы по `post.id` (связка `posts.edge_id`).
- **Подвести итоги вручную** — уже есть **draw-prize**; кнопка в UI управления → тот же API.

---

## Фазы разработки (рекомендуемый порядок)

| Фаза | Содержание |
|------|------------|
| **0.5** | Борд → EDGE хаб; список «мои кампании»; документ этот файл |
| **1** | ✅ `POST` черновик + `PATCH` сохранение полей + `GET` детали; клиент: `BoardEdgeNew`, `edge-creator.ts` |
| **2** | ✅ PNG в мастере → `companion.character.assetUrl`; отображение в Companion (`EdgePetVisualCluster`) |
| **3** | ✅ Призы в мастере → `gifts_json.templates` (кол-во, медиа URL) |
| **4** | Правила draw в `config_json.prizeRules` + лимит `quantity` в шаблоне приза; draw учитывает пул **все / топ N по XP**, способ **random / first** |
| **5** | ✅ Авто-ЛС: `followRewardDm` → ответ `POST /v1/participant/follow-reward` → платформа `sendEdgeFollowRewardDm` (`server/users/edge-follow-dm-sender.ts`) |
| **6** | Конструктор заданий: JSON `taskPresets` + поле **`verify`** (`honor` \| подписка \| реакция/коммент к посту с `edge_id` \| min level/xp/streak в EDGE); платформа проверяет соц.условия до прокси на EDGE |
| **7** | ✅ `interactLocked` в `campaign-config` + **403** на `feed`/`interact` при draft/paused/ended или `schedule.endsAt` в прошлом; UI блокирует кнопки |

---

## Связь с файлами репозитория

- Клиент Companion: `client/src/features/edge-companion/`, `EdgeCompanion.tsx`
- Пост + `edge_id`: `server/posts/`, `client/src/lib/posts.ts`
- EDGE API: `EDGE/companion/`, `EDGE/campaign/`, `EDGE/participant/`
- Админ companion JSON: `client/src/pages/admin/EdgeCompanion.tsx`
- **Борд:** `client/src/pages/BoardEdgeHub.tsx`, `BoardEdgeManage.tsx`, мастер `BoardEdgeNew.tsx`, `client/src/lib/edge-creator.ts`
- **EDGE creator:** `EDGE/creator/` (`POST/GET/PATCH /v1/creator/campaigns`), прокси `/api/edge/creator/campaigns` и `my-campaigns`

---

## Что сказать создателю одной фразой

**Сейчас:** с Борда — **EDGE → Новый EDGE**: мастер создаёт кампанию, PNG и призы сохраняются в EDGE; пост с `edgeId` выводит блок в ленту. Розыгрыш по-прежнему через админ draw-prize; авто-ЛС за подписку и «только итоги» после даты — в следующих фазах.
