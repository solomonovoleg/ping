# База данных микросервиса EDGE

## Зачем отдельная строка подключения

- Основное приложение использует `DATABASE_URL` (пользователи, посты, чаты).
- EDGE хранит кампании, позже — состояния персонажей, задания, лидерборды.
- Рекомендуется **отдельная база** на том же PostgreSQL, например `ping_moot_edge`.

Без `EDGE_DATABASE_URL` микросервис **запускается**, но ручки, завязанные на БД (companion config, participant state, лидерборд, interact), отвечают **503** — на платформе при этом тоже **503** прокси (без фейковых тел).

## Миграции

Файлы: `EDGE/migrations/*.sql` (выполняются по имени в алфавитном порядке).

Локально:

```bash
export EDGE_DATABASE_URL=postgresql://user:pass@localhost:5432/ping_moot_edge
node EDGE/db/run-migrations.cjs
```

На VPS: при наличии `EDGE_DATABASE_URL` в `.env` скрипт вызывается из `scripts/server-setup.sh` после миграций платформы.

## Таблицы `edge_participants` и `edge_character_states`

Участник = пара (`campaign_public_id`, `platform_user_id`). Состояние персонажа — одна строка на участника (`participant_id`).

С `0005_edge_dual_leaderboard.sql` в `edge_character_states` добавлены:

- `primary_xp` — очки **основного** рейтинга;
- `secondary_xp` — очки **дополнительного** рейтинга.

Текущий legacy `xp` пока сохранён для обратной совместимости экранов/логики, но целевая модель — два независимых счётчика.

API EDGE: `GET/POST /v1/participant/…` (с сервера платформы: секрет + заголовок `X-Platform-User-Id`). Дополнительно: `GET /v1/participant/leaderboard`, `POST /v1/participant/interact` (тело `{ "kind": "play" | "pet" }`), **`POST /v1/participant/task?edgeId=`** (тело `{ "taskKey": "view_post" | "react_post" | "share_post" | "follow_creator", "ref": "<postId|creatorId>" }`) — идемпотентное начисление XP по `edge_task_grants`, суммы из `edge_campaigns.config_json.tasks` (или дефолты), **`POST /v1/participant/follow-reward`** (тело `{ "followedPlatformUserId": "<id>" }`) — начисление `follow_creator` по всем кампаниям автора с `follow_reward_enabled`, `POST /v1/campaign/draw` (только секрет) — розыгрыш призов.

## Таблица `edge_task_grants`

Фиксирует уже выданный XP за пару **кампания + пользователь + тип задания + ref** (обычно `postId`). Уникальность `(campaign_public_id, platform_user_id, task_key, ref_key)` — повторный просмотр/реакция/шаринг того же поста не удваивает XP.

На платформе: после успешных действий с постом, у которого заполнен `posts.edge_id`, фоном вызывается EDGE (ошибки не ломают основной ответ). Прокси для клиента/отладки: **`POST /api/edge/participant/task?edgeId=`** (cookie-сессия, тело как у EDGE). После **новой** подписки на пользователя — фоном **`POST /api/edge/participant/follow-reward`** с `{ "followedPlatformUserId" }`.

## Таблица `edge_prize_winners`

Фиксирует победителей по паре кампания + `gift_key`. Уникальность `(campaign_public_id, platform_user_id, gift_key)` — один приз одного типа на пользователя. Поле `draw_batch_id` объединяет победителей одной итерации розыгрыша.

На платформе: **`POST /api/admin/edge/draw-prize`** (админ-сессия) — прокси на EDGE и опционально ЛС победителям (от `creator_platform_user_id` кампании или `EDGE_PRIZE_NOTIFY_USER_ID`).

Выдача в **`GET /v1/companion/campaign-config`**: поле **`resultsLive`** — последний по времени `draw_batch_id` и список победителей (подписи призов из `gifts_json`, id пользователя маскируются на клиенте).

## Таблица `edge_campaigns`

| Поле | Назначение |
|------|------------|
| `public_id` | Совпадает с `posts.edge_id` на платформе |
| `edge_type` | `character`, позже другие типы контента |
| `creator_platform_user_id` | ID создателя на платформе (строка) |
| `title`, `status` | Заголовок и статус кампании |
| `gifts_json` | JSON массива шаблонов призов или объект с `templates`; расширение под новую модель: `leaderboardScopes: ("primary" \| "secondary")[]`, `drawAt` (ISO), `selectionRule` |
| `leaderboard_global_enabled`, `follow_reward_enabled` | Флаги для клиента |
| `config_json` | Расширение: призы, **`tasks`** (`view_post` / `react_post` / `share_post` → `xp`), decay и т.д.; объект **`companion`** — `surfaceOrder`, `infoArticle` (блоки paragraph/image/video), `results` (итоги розыгрышей) для UI полноэкранного Companion |

С `0005_edge_dual_leaderboard.sql` в таблицу также добавлены:

- `leaderboard_primary_enabled boolean` — включён ли основной рейтинг;
- `leaderboard_secondary_enabled boolean` — включён ли дополнительный рейтинг;
- `primary_leaderboard_frozen_at timestamptz` — момент заморозки основного рейтинга;
- `secondary_leaderboard_frozen_at timestamptz` — момент заморозки дополнительного рейтинга.

Пример вставки (ручной сид):

```sql
INSERT INTO edge_campaigns (public_id, edge_type, title, status, gifts_json, leaderboard_global_enabled)
VALUES ('my-campaign-uuid', 'character', 'Птенец-помощник', 'published', '[]'::jsonb, true);
```
