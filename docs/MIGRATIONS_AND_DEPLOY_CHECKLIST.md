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

1. `migrate-user-columns.cjs` — в т.ч. `users.ios_voip_token` (PushKit VoIP / CallKit); эталонный SQL: `migrations/0051_users_ios_voip_token.sql` для `npm run db:migrate`
2. `migrate-users-columns.cjs` — колонки модерации/профиля в `users`
3. `migrate-posts.cjs`
4. `migrate-post-comments.cjs` → `migrate-post-comments-parent.cjs` (ответы: `post_comments.parent_comment_id`) → `migrate-post-comment-likes.cjs` (`post_comment_likes`)
5. `migrate-missed-calls.cjs`
6. `migrate-referrals.cjs` → `migrate-referral-multi-use.cjs`
7. `migrate-follows.cjs` → `migrate-designated-follows.cjs`
8. `migrate-stories.cjs` → `migrate-story-views.cjs` → `migrate-story-likes.cjs`
9. `migrate-notifications-and-more.cjs`
10. `migrate-tracks.cjs`
11. `migrate-chat-folders.cjs`
12. `migrate-scheduled-messages.cjs`
13. `migrate-message-hidden.cjs`
13a. `migrate-message-send-idempotency.cjs` — `message_send_idempotency` (идемпотентный POST сообщения)
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
25a. `migrate-posts-content-interests.cjs` — `posts.content_interests`, `posts.content_interests_at` (таксономия интересов по тексту поста)
26. `migrate-profile-page-views.cjs`
27. `migrate-user-dm-group-policies.cjs`
28. `migrate-dm-scheduled-calls.cjs`
29. `migrate-feed-global-snapshot.cjs`
30. `migrate-referral-codes-bypass-inviter-limit.cjs` — `referral_codes.bypass_inviter_limit` (коды EDGE «пригласить»)
31. `migrate-referral-admin-note.cjs` — `referral_codes.admin_note` (подпись к коду в админке)
32. `migrate-invite-more-requests.cjs` — таблица `invite_more_requests` (заявки на доп. лимит приглашений)
33. `migrate-help-pages.cjs`
34. `migrate-sender-welcome.cjs` — SENDER: `sender_welcome_settings`, `sender_welcome_deliveries`
35. `migrate-board-api-hub-prime.cjs` — `users.board_api_hub_prime_code` (PRIME CODE → доступ к API HUB на Борде)
36. `migrate-referral-program-settings.cjs` — реферальные настройки в `platform_settings` + `referral_auto_grants`
37. `migrate-admin-media-studio.cjs` — `migrations/0040_admin_media_studio.sql`: studio users (`users.is_studio_synthetic`), кампании контента, инвайты в группы
38. `migrate-edge-money-invite-batches.cjs` — `edge_money_invite_batches` + `referral_codes.edge_money_invite_batch_id` (партии кодов EDGE MONEY, см. `docs/EDGE_MONEY_INVITE_FOUR_BLOCKS.md`)
39. `migrate-edge-money-chat-counters.cjs` — `edge_money_chat_message_counters` (счётчики сообщений в ЛС для начисления EDGE MONEY по диалогу, см. `docs/edge-money-chat-scoring/README.md`)
40. `migrate-edge-money-call-counters.cjs` — `edge_money_call_minute_counters` (минуты звонка 1:1 для правила `video_call_minutes`)
41. `migrate-edge-money-post-profile-counters.cjs` — `edge_money_post_counters`, `edge_money_profile_like_counters` (правила `post_created`, `profile_likes_received`)

Дальше по цепочке (полный порядок — **`scripts/run-migrations.cjs`**): в т.ч. `migrate-chat-codes`, `migrate-new-tel-call-password-log`, `migrate-composer-pulse-pending`, **`migrate-sticker-packs.cjs`** (`sticker_packs`, `stickers` — стикер-паки в чате).

Эталонный SQL для той же колонки: **`migrations/0033_referral_codes_admin_note.sql`** (подхватывается **`npm run db:migrate`**; скрипт §31 идемпотентен и дублирует операцию).

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
- [ ] В логах платформы после выката **нет лавины** строк **`[auth] session save failed`** (если есть — проверить БД и store сессий).

---

## 6. iSee: JPEG-постеры к постовым видео (бэкфилл, не миграция SQL)

После выката сервера, который пишет `posterUrl` и кладёт `.jpg` рядом с `.mp4`, **старые посты** остаются без постера, пока не прогнать скрипт.

- Те же переменные, что у приложения: **`DATABASE_URL`**, **`ffmpeg`**, для S3 — **`S3_*`** (как в `server/upload/s3.ts`).
- Локально для дисковых URL нужен каталог **`uploads/posts/`** относительно корня репозитория.

```bash
# Сначала оценка (без записи в S3/диск)
npm run backfill:post-video-posters -- --dry-run

# Партиями, например по 100 операций создания постера
npm run backfill:post-video-posters -- --limit=100
```

Публичное чтение `.jpg` в бакете и ручной смоук — **`docs/DEPLOY_RULES.md`** (раздел про постеры) и **`docs/ISEE_SMOKE_CHECKLIST.md`**. Дорожная карта HLS — **`docs/ISEE_HLS_ROADMAP.md`**.

---

## 7. Связанные документы

| Документ | Содержание |
|----------|------------|
| `docs/DEPLOY.md` | Сценарий деплоя, сборка, миграции в одном месте |
| `docs/DEPLOY_RULES.md` | `.env`, `DATABASE_URL`, сессия, EDGE/PARSER env, постеры iSee в S3 |
| `docs/PROJECT_MAP.md` | Карта модулей и журнал изменений |
| `docs/EDGE_DATABASE.md` | Схема БД EDGE |
| `docs/ISEE_SMOKE_CHECKLIST.md` | Ручной смоук iSee после изменений плеера/постеров |
| `docs/ISEE_HLS_ROADMAP.md` | Опциональный этап: адаптивное видео (HLS) |
| `scripts/server-setup.sh` | Фактический вызов миграций на сервере |
