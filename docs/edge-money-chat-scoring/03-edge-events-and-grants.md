# Блок 3 — EDGE: события, гранты, дневной потолок

Ответственность: принять событие от платформы, проверить правила кампании, применить XP идемпотентно и с учётом лимита за сутки.

---

## 3.1. Рекомендуемая папка кода в EDGE

Расширение существующего money-модуля, без монолита:

```text
EDGE/money/platform-events/
  parse-platform-event-body.ts      # расширить union типов
  apply-chat-messages-milestone.ts  # новый файл, ≤250 строк
  ... (invite уже в apply-invite-registered-event.ts)
EDGE/money/http/handlers/
  post-money-platform-event.ts      # маршрутизация по type
```

При росте логики — подпапка `platform-events/chat-messages/` с `*.ts` по 200–250 строк.

---

## 3.2. Контракт события (платформа → EDGE)

Расширить `POST /v1/money/platform-events` (тот же путь, что для приглашений):

- `type`: например `chat_messages_milestone`.
- `edgeId`: string.
- `platformUserId`: string (кто писал сообщения).
- `chatId`: string (идентификатор чата на платформе).
- `blockIndex`: number (целое ≥ 1) — какой по счёту «блок из threshold сообщений» в этом чате.

Аутентификация: тот же сервисный секрет / заголовки, что для `invite_registered`.

---

## 3.3. Проверки в обработчике

1. Кампания существует, `edge_type === "money"`, статус **published**.
2. В `config_json.money.scoringRules` есть включённое правило `kind === "chat_messages"`, `points > 0`, `threshold` совпадает с тем, по которому платформа считала milestone (опционально: передавать `threshold` в теле и сверять).
3. Участник существует в EDGE для этой кампании (или политика auto-ensure — как у других money-событий).
4. **Заморозка рейтинга:** `effectiveLeaderboardXpFrozen` для целевого столбца (primary/secondary по `leaderboard_secondary_enabled`) — если заморозка, не начислять, вернуть понятную причину.
5. **Дневной потолок:** сумма `xp_awarded` по `task_key` за текущие сутки (см. ниже) + предлагаемый `xpDelta` не превышает `maxPointsPerDay`. Если лимит частичный — продуктово решить: не начислять шаг целиком или начислить **остаток** до потолка (зафиксировать в блоке 1).

---

## 3.4. task_key и ref_key

- **`task_key`:** константа, например `money_chat` (латиница, паттерн как у `money_invite` в `EDGE/tasks/grants-repo.ts`).
- **`ref_key`:** уникальный ключ идемпотентности, например  
  `chat:{chatId}:b:{blockIndex}`  
  длина в пределах лимита БД для `ref_key` (проверить схему `edge_task_grants`).

Повторный запрос с тем же `ref_key` → `tryInsertTaskGrant` вернёт «не вставлено», XP не дублируется.

---

## 3.5. Дневной потолок в SQL

Расширить `EDGE/tasks/grants-repo.ts` **отдельным маленьким файлом** (например `sum-xp-for-task-key-today.ts`), чтобы не раздувать репозиторий:

- Запрос: `SUM(xp_awarded)` где `campaign_public_id`, `platform_user_id`, `task_key = 'money_chat'` и `created_at` в интервале **текущих суток** (граница суток: UTC или параметр — согласовать с блоком 1).

Если нужен timezone кампании — позже отдельное поле в кампании; v1 = UTC.

---

## 3.6. Начисление XP

После успешной вставки гранта — вызвать существующий путь **`applyTaskXpToParticipant`** с тем же `scoreTarget`, что и для invite (secondary если `leaderboard_secondary_enabled`, иначе primary).

Логирование ошибок: префикс `[edge/money/chat_messages]` для поиска в логах.

---

## 3.7. Публичный прогресс (опционально, v1.1)

При необходимости UI «сколько набрано за сегодня» — отдельный GET на платформе, прокси к EDGE или чтение суммы из `edge_task_grants` через существующие паттерны (`sumXpForTaskKey` + фильтр по дате). Не смешивать с hot path отправки сообщения.
