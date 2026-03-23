# Миграции и деплой — единая памятка

Сводка для случаев, когда фичи делались в разных сессиях: **что крутится при деплое**, **где добавлять новое**, **три разные БД/процесса**.

---

## 1. Что запускается автоматически (`npm run deploy`)

1. Локально: **`npm run build`** → `dist/` (платформа, EDGE, parser, feed-worker, …).
2. На сервере: **`scripts/server-setup.sh`**:
   - **`node scripts/run-migrations.cjs`** — цепочка миграций **основной БД** платформы (см. §2).
   - Если в `.env` есть **`EDGE_DATABASE_URL`**: **`node EDGE/db/run-migrations.cjs`** — все **`EDGE/migrations/*.sql`** по имени по возрастанию.
   - **`node PARSER/db/run-migrations.cjs`** — все **`PARSER/migrations/*.sql`** (URL: `PARSER_DATABASE_URL` или `DATABASE_URL`).

Подробности деплоя: **`docs/DEPLOY.md`**, правила `.env`: **`docs/DEPLOY_RULES.md`**.

---

## 2. Основная БД платформы — `scripts/run-migrations.cjs`

Порядок **фиксирован** (зависимости между таблицами). Новый скрипт добавлять **в конец списка** (или в логически верное место), **не забыть строку в массиве `scripts`**.

Текущая цепочка:

1. `migrate-user-columns.cjs`
2. `migrate-users-columns.cjs` — колонки модерации/профиля в `users`
3. `migrate-posts.cjs`
4. `migrate-post-comments.cjs`
5. `migrate-missed-calls.cjs`
6. `migrate-referrals.cjs` → `migrate-referral-multi-use.cjs`
7. `migrate-follows.cjs` → `migrate-designated-follows.cjs`
8. `migrate-stories.cjs` → `migrate-story-views.cjs` → `migrate-story-likes.cjs`
9. `migrate-notifications-and-more.cjs`
10. `migrate-tracks.cjs`
11. `migrate-chat-folders.cjs`
12. `migrate-scheduled-messages.cjs`
13. `migrate-message-hidden.cjs`
14. `migrate-messages-timestamptz.cjs`
15. `migrate-message-translations.cjs`
16. `migrate-messages-chat-created-index.cjs`
17. `migrate-chat-vibe.cjs`
18. `migrate-admin-ops.cjs`
19. `migrate-ai-search.cjs`
20. `migrate-profile-pins.cjs`
21. `migrate-chat-member-prefs.cjs`
22. `migrate-user-block-restrictions.cjs` → `migrate-user-block-note.cjs`
23. `migrate-user-reminders-voice-tasks.cjs`
24. `migrate-service-chat.cjs`
25. `migrate-posts-edge-id.cjs`
26. `migrate-profile-page-views.cjs`
27. `migrate-user-dm-group-policies.cjs`
28. `migrate-dm-scheduled-calls.cjs`
29. `migrate-feed-global-snapshot.cjs`
30. `migrate-referral-codes-bypass-inviter-limit.cjs` — `referral_codes.bypass_inviter_limit` (коды EDGE «пригласить»)

Файлы в **`migrations/*.sql`** — эталонные SQL; отдельные **`scripts/migrate-*.cjs`** обычно исполняют идемпотентные `ALTER`/`CREATE IF NOT EXISTS`. **Новая таблица:** по принятому в проекте процессу — схема в **`shared/schema/`**, миграция через новый **`scripts/migrate-*.cjs`** + строка в **`run-migrations.cjs`**.

Локально (с `DATABASE_URL` в `.env`):

```bash
node scripts/run-migrations.cjs
```

---

## 3. БД EDGE — `EDGE/db/run-migrations.cjs`

- Каталог: **`EDGE/migrations/*.sql`**, порядок = **лексикографическая сортировка имён** (`0001_…`, `0002_…`, …).
- Переменная: **`EDGE_DATABASE_URL`** (в `deploy.env` / серверном `.env`).
- Новая миграция EDGE: добавить файл **`EDGE/migrations/NNNN_name.sql`** с идемпотентными операторами (`IF NOT EXISTS` и т.д.), пересобрать и задеплоить; раннер подхватит автоматически.

---

## 4. PARSER — `PARSER/db/run-migrations.cjs`

- Каталог: **`PARSER/migrations/*.sql`**, тот же принцип сортировки.
- URL: **`PARSER_DATABASE_URL`** или **`DATABASE_URL`**.

---

## 5. Чеклист после «много фич из разных чатов»

- [ ] Есть ли **новый `scripts/migrate-*.cjs`**, который **не добавлен** в **`scripts/run-migrations.cjs`**? (grep по `scripts/migrate-`.)
- [ ] Есть ли **новый `EDGE/migrations/*.sql`** — на проде задан **`EDGE_DATABASE_URL`** и после деплоя отработал **`EDGE/db/run-migrations.cjs`**?
- [ ] **`deploy.env`**: `DATABASE_URL`, при EDGE — **`EDGE_*`**, при парсере — **`PARSER_*`** / секреты (см. `DEPLOY_RULES.md`).
- [ ] **`npm run build`** без ошибок; **`docs/PROJECT_MAP.md`** — строка в журнале для нового модуля.

---

## 6. Связанные документы

| Документ | Содержание |
|----------|------------|
| `docs/DEPLOY.md` | Сценарий деплоя, сборка, миграции в одном месте |
| `docs/DEPLOY_RULES.md` | `.env`, `DATABASE_URL`, сессия, EDGE/PARSER env |
| `docs/PROJECT_MAP.md` | Карта модулей и журнал изменений |
| `docs/EDGE_DATABASE.md` | Схема БД EDGE |
| `scripts/server-setup.sh` | Фактический вызов миграций на сервере |
