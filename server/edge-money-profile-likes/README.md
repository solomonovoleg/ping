# EDGE MONEY — реакции на посты (`profile_likes_received`)

- Счётчик: `edge_money_profile_like_counters` (автор поста × `edge_id`).
- Срабатывает на **первую** реакцию пользователя на пост (`POST /api/posts/:id/reactions`); смена эмодзи не увеличивает счётчик.
- Реакция на **свой** пост не учитывается.
