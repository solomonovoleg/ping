# Комментарии к постам

Пятая подпапка — **`shared`**: типы, DTO, формат времени, константы, инвалидация React Query.

| Папка | Назначение |
|--------|------------|
| `post-comments/` | Список и создание комментария к посту, модалка (`CommentsModal*`, `CommentRow`) |
| `comment-replies/` | Ответ на комментарий (`parentCommentId`), баннер цели ответа |
| `comment-mentions/` | `@` с подсказками (контакты + подписки + поиск), вставка `@[Имя](publicId)`, рендер ссылок в тексте |
| `comment-reactions/` | Локальный оптимистичный лайк (сервер — см. `server/.../comment-reactions/`) |
| `comment-moderation/` | Удаление, право на удаление, блокировка автора из контекст-меню |
| `shared/` | `CommentItem`, маппинг API, `formatCommentTime`, лимиты, `invalidatePostCommentQueries` |

Сервер: `server/features/comments/` — та же сетка папок, регистрация маршрутов в `register-comments-routes.ts`.
