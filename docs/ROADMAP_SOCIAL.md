# План доработок (соцсеть, формат Instagram)

## Исключено по запросу
- Репост в ленту
- Заявки в друзья
- Галерея фото в профиле
- Верификация
- Группы и сообщества
- 2FA, жалобы, модерация
- Донаты, реклама
- Мультиязычность

---

## Выполнено

### Phase 1: Подписки + лента подписок
- Таблица `follows` (follower_id, following_id)
- API: POST/DELETE `/api/users/:userId/follow`, GET `/api/users/:userId/followers`, GET `/api/users/:userId/following`
- Лента постов: только от тех, на кого подписан (+ свои)
- Профиль: кнопка Подписаться/Отписаться, счётчики подписчиков и подписок
- Миграция: `node scripts/migrate-follows.cjs`

### Phase 2: Свои сторис (24ч, просмотры)
- Фильтр 24ч при выдаче сторис
- Таблица `story_views`, POST `/api/stories/:id/view`
- GET `/api/stories/feed` — лента сторис (я + подписки)
- На главной лента сторис из API, запись просмотра при открытии
- Миграция: `node scripts/migrate-story-views.cjs`

### Phase 3: Хештеги + поиск по хештегам
- Поле `posts.hashtags` (jsonb), извлечение из текста при создании/редактировании
- GET `/api/posts?hashtag=...` — фильтр по хештегу
- В ленте: хештеги в тексте кликабельны, фильтр и сброс

---

## Реализовано (продолжение)

### Phase 4: Упоминания @ в постах и комментариях
- Парсинг @username / @id в тексте (extractMentions), уведомления упомянутым (таблица notifications, тип mention)
- При создании поста/комментария — создание записей уведомлений для упомянутых

### Phase 5: Черновики, закреп, доступ к посту
- Посты: isDraft, visibility (public | followers)
- При создании/редактировании поста — поддержка isDraft и visibility
- Лента: только не-черновики; при просмотре чужой стены — учёт visibility (только public или подписчики)
- Пользователь: pinnedPostId, обновление профиля (PATCH /api/users/me)

### Phase 6: Профиль: расширенный, статус, приватность
- Поля users: city, status, pinnedPostId, profileVisibility (all | followers), showOnlineTo (all | followers)
- PATCH /api/users/me и ответ профиля с новыми полями
- ensureUserColumns добавляет колонки при старте

### Phase 7: Сохранённое
- Таблица saved_posts, API: POST/DELETE /api/posts/:postId/save, GET /api/me/saved-posts
- Клиент: savePost, unsavePost, fetchSavedPosts

### Phase 8: Центр уведомлений
- GET /api/notifications, PATCH /api/notifications/:id/read, POST /api/notifications/read-all
- Клиент: fetchNotifications, markNotificationRead, markAllNotificationsRead (lib/notifications.ts)

### Phase 9: Типинг «печатает» в чате
- WebSocket: клиент шлёт { type: "typing", chatId, displayName }, сервер рассылает подписчикам чата
- useCall: sendTyping(chatId), subscribeTyping(chatId, callback)
- ChatDetail: отображение «{name} печатает...», отправка typing при вводе (scheduleSendTyping)

### Phase 10: Блокировка, скрытие от поиска
- Таблица user_blocks, storage: addBlock, removeBlock, isBlocked, getBlockedRelationIds
- API: POST/DELETE /api/users/:userId/block
- Профиль: isBlockedByMe в ответе; лента исключает посты от заблокированных/кто заблокировал
- hideFromSearch уже был в users

### Phase 11: Поиск по контенту
- GET /api/posts?q=... — поиск по тексту поста (ilike)
- Клиент: fetchFeed(limit, offset, { q }) для поиска по ленте
