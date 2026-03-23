# EDGE — дорожная карта функционала (по порядку)

## ✅ 1. Призы и розыгрыш

- Миграция `edge_prize_winners`, `POST /v1/campaign/draw` (секрет EDGE).
- Платформа: `POST /api/admin/edge/draw-prize` (админ), опционально ЛС победителям.
- Подпись подарка: `giftKey` (по умолчанию `default`), подпись из `gifts_json` / `templates`.

**Как вызвать:** тело `{ "edgeId": "<posts.edge_id>", "giftKey": "default", "count": 1, "notify": true }`.  
Уведомления: `creator_platform_user_id` в `edge_campaigns` или `EDGE_PRIZE_NOTIFY_USER_ID` в `.env` платформы.

---

## ✅ 2. Задания и XP за действия в приложении

- Миграция `edge_task_grants`, EDGE `POST /v1/participant/task`, модуль `EDGE/tasks/`.
- Платформа: `server/posts/edge-task-hook.ts` + `server/edge/call-participant-task.ts`; после просмотра (`recordPostView`), реакции, шаринга поста — фоновый вызов EDGE, если у поста есть `edge_id`.
- Прокси: `POST /api/edge/participant/task?edgeId=`.
- Правила сумм: `config_json.tasks` на кампании (дефолты в коде EDGE).

---

## ✅ 3. Награда за подписку (`follow_reward_enabled`)

- `task_key` `follow_creator` в `edge_task_grants`; XP из `config_json.tasks.follow_creator` (дефолт 12).
- EDGE: `POST /v1/participant/follow-reward` (тело `{ "followedPlatformUserId": "<id автора>" }`) — все опубликованные кампании, где `creator_platform_user_id` = этот id и `follow_reward_enabled`.
- В `applyTaskReward` для `follow_creator` доп. проверки: флаг, `published`, совпадение ref с создателем.
- Платформа: только при **новой** подписке (`addFollow` → `true`); `server/users/edge-follow-hook.ts`, `server/edge/call-follow-reward.ts`, прокси `POST /api/edge/participant/follow-reward`.

---

## 4. Напоминания «пора уделить персонажу»

- По `careDeadlineAt` / `last_fed_at`: отложенный пуш или опрос, в духе существующих напоминаний в приложении.

---

## 5. Админка / борд создателя

- Редактирование кампании, таймингов и текстов без деплоя (через `config_json` и UI).

---

## 6. Тесты

- Юнит-тесты на `EDGE/participant/character-rules.ts` и при необходимости на розыгрыш (детерминированный seed в тестах).
