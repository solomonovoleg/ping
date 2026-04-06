# EDGE MONEY — пригласить друзей: 4 блока внедрения

Правила кода: **≤200 строк на файл**; **каждая функция/ concern — своя папка** с набором маленьких файлов под `server/edge-money-invite/`.

---

## Блок 1 — Данные и инварианты (фундамент в репозитории)

- Таблица **`edge_money_invite_batches`**: партия кодов на пару `(inviter_user_id, edge_id)` + `batch_index`, `slot_count`, `completed_at`.
- Частичный уникальный индекс: **не больше одной открытой** партии на `(inviter_user_id, edge_id)`.
- Колонка **`referral_codes.edge_money_invite_batch_id`** — связь кода с партией (реальные коды, учёт `use_count`).
- Модуль **`server/edge-money-invite/`** (≤200 строк на файл, папка на операцию): `insert-batch`, `select-open-batch`, `batch-stats`, `complete-batch`, `gate-next-batch`, `four-blocks`.
- Миграция: **`scripts/migrate-edge-money-invite-batches.cjs`** (в конце `run-migrations.cjs`).

## Блок 2 — HTTP и выдача пакета (реализовано на платформе)

- **`POST /api/edge/money/ping-invite-pack?edgeId=`** — без verify «уже N приглашённых»; gate партии; транзакция: партия + 3 кода; ЛС от создателя; rate limit 45 с. Файлы: `server/edge-money-invite/http-issue-pack/*`, видимость кампании: `server/edge/money-campaign-viewer-access.ts`.
- **`GET /api/edge/money/invite-progress?edgeId=`** — открытая партия, `codesIssued` / `registrationsFromOpenBatchCodes`, `canRequestNewBatch`, правило `invite_friend` (порог/баллы); `pointsAwardedForInviteTask` пока **0** (блок 3).
- Клиент: `client/src/lib/edge-money-invite-api.ts`.
- В **`config_json.money`**: опциональный **`inviteDm`** (`template`, `codeExpiresInHours`) — парсинг в EDGE `parse-money-config`, PATCH через `moneyConfig.inviteDm`; на борде — шаг «Баллы», блок **«ЛС с кодами»**, если включено «Пригласил друга» (`MoneyInviteDmFields`).
- После регистрации по коду: `auth/routes` → `notifyEdgeMoneyInviteBatchAfterReferralConsumed` — автозакрытие партии при 3/3 использованиях.

## Блок 3 — События и баллы EDGE MONEY (реализовано)

- **`POST /v1/money/platform-events`** (секрет): `type: "invite_registered"` + `edgeId`, `inviterPlatformUserId`, `referralCodeId` → `edge_task_grants` (`money_invite`) + XP в **secondary**, если включён доп. рейтинг, иначе в **primary**; уважает заморозку соответствующего рейтинга.
- **`GET /v1/money/invite-grants-sum`** — сумма баллов по `money_invite` для прогресса.
- Платформа: после регистрации **`forwardMoneyInviteRegisteredToEdge`** (`server/edge/forward-money-invite-registered.ts`), сверка партии `selectEdgeMoneyInviteBatchMeta`.

## Блок 4 — Клиент (реализовано)

- **`features/edge-money-template/invite-friend-row/EdgeMoneyInviteFriendRow.tsx`**: прогресс, начислено баллов, CTA «Получить коды», тост «Открыть чат»; инвалидация лидерборда после выдачи.

---

См. также: `docs/EDGE_MONEY_ARCHITECTURE.md`, журнал миграций в `docs/MIGRATIONS_AND_DEPLOY_CHECKLIST.md`.
