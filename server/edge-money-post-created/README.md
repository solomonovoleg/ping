# EDGE MONEY — посты (`post_created`)

- Счётчик в основной БД: `edge_money_post_counters` (автор × `edge_id`).
- После **публикации** поста (`createPost` без черновика или снятие черновика в `updateOwnPost`) — инкремент и при `count % threshold === 0` вызов EDGE `post_created_milestone`.
- Участник должен быть в `edge_participants`; кампания `money`, опубликована, не `interactLocked`.
