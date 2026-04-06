# Админка — раздел «Медиа-студия» (Media Studio)

Краткое ТЗ и опора для реализации: синтетические пользователи, групповые чаты по ссылке, кампании публикаций. Детальный UI — в следующих итерациях.

## 1. Сущности и роли

| Сущность | Назначение |
|----------|------------|
| **Studio user** | Запись в `users` с `is_studio_synthetic = true`; ведёт себя в ленте/профиле как обычный пользователь; телефон-заглушка `studio_media_<uuid>` (вход по телефону невозможен). |
| **Кампания** | Черновики постов, расписание, пул авторов; публикация от имени studio users. |
| **Приглашение в группу** | Токен → join в `group`-чат без полной регистрации (отдельный эндпоинт, см. следующие этапы). |

**Доступ:** создание studio user и дальнейшие опасные операции — `admin` и `super_admin` (не `moderator`), через `requireAdminOrSuper`. При необходимости можно сузить до `requireSuperAdmin`.

## 2. Анализ текущей схемы (переиспользование)

- **Пользователь:** таблица `users` — все поля профиля уже есть (`display_name`, `surname`, `gender`, `birth_date`, `avatar_url`, `cover_url`, …). Добавлены маркеры `is_studio_synthetic`, `studio_created_by_admin_id`.
- **Посты:** `posts.author_id` → публикации от имени studio user без изменений схемы постов.
- **Чаты:** `chats` + `chat_members` с `type = 'group'`; публичный join по токену — новая таблица `admin_media_studio_group_invites` (связь `chat_id`, хеш токена, срок, лимиты).

## 3. Миграции (платформа)

Файл `migrations/0040_admin_media_studio.sql` + `scripts/migrate-admin-media-studio.cjs` в цепочке `run-migrations.cjs`:

- колонки в `users`;
- `admin_media_studio_campaigns`;
- `admin_media_studio_campaign_posts`;
- `admin_media_studio_group_invites`.

## 4. State machine кампании

Статусы кампании: `draft` → `running` ⟷ `paused` → `completed` | `cancelled`.

- **draft:** редактирование черновиков и расписания; публикаций нет.
- **running:** публикация элементов с `scheduled_at <= now()` (или без даты): периодический тик **основного процесса** платформы (`server/index.ts`, по умолчанию каждые 60 с) **и** при включённом PM2 — процесс `feed-worker`; плюс ручной вызов из админки («Обработать сейчас»).
- **paused:** новые слоты не исполняются; при возобновлении либо сдвиг оставшихся `scheduled_at`, либо «заморозка времени» (решение при реализации воркера).
- **completed:** все посты обработаны (успех/пропуск/ошибка по политике).
- **cancelled:** ручная остановка; неопубликованные элементы в `skipped` или остаются в очереди без исполнения (зафиксировать в коде воркера).

Состояния элемента очереди поста: `queued` → `published` | `failed` | `skipped`.

## 5.1. UI админки

- Маршрут: **`/admin/media-studio`** (пункт навигации только у **admin** / **super_admin**).
- Клиент: `client/src/features/admin/media-studio/` (`MediaStudioView`, `SyntheticUsersSection`, `api.ts`), страница-оболочка `client/src/pages/admin/MediaStudio.tsx`.
- Загрузка аватара/обложки: **`postFormDataWithUploadProgress`** (как в приложении) — корректные `credentials` + Bearer на нативе.
- PATCH профиля: без полей **`boardApiHubPrimeCode`** и **`referralLimit`** (схема `.omit` на сервере).

## 5. Создание studio user (как «после регистрации»)

1. `getNextPublicId()`, `createUser` с уникальным `studio_media_<uuid>`, пароль — хеш от криптостойкой случайной строки (вход не предполагается).
2. `applyStudioSyntheticFlags(userId, adminId)`.
3. `updateUserProfile` с полями из формы админки (имя, фамилия, пол, дата рождения; далее аватар/обложка теми же путями, что и у обычного пользователя — отдельные задачи).

Аудит: `media_studio.synthetic_user.create` с `targetId = user.id`.
