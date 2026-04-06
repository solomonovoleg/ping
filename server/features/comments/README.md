# Комментарии к постам (HTTP)

Пятая подпапка — **`shared`**: константы (`MAX_COMMENT_TEXT_LENGTH`), разбор ошибок Postgres.

| Папка | Назначение |
|--------|------------|
| `post-comments/` | `GET/POST /api/posts/:postId/comments`, выборка списка |
| `comment-replies/` | Разбор `parentCommentId`, блоки, имя автора родителя |
| `comment-reactions/` | `POST /api/posts/:postId/comments/:commentId/like` — переключение лайка |
| `comment-moderation/` | `DELETE /api/posts/:postId/comments/:commentId` |
| `shared/` | Общие константы и утилиты |

Точка входа: `register-comments-routes.ts` (подключается из `server/routes.ts`).
