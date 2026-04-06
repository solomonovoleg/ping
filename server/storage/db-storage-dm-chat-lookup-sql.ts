/**
 * Поиск существующего DM между двумя пользователями внутри транзакции (`getOrCreateDmChat`).
 * Вынесено в константы: проще ревью, индексы и регрессии при смене схемы.
 */
export const FIND_DM_CHAT_BETWEEN_USERS_STRICT_SQL = `
      SELECT c.id
      FROM chats c
      INNER JOIN chat_members m1 ON m1.chat_id = c.id AND m1.user_id = $1
      INNER JOIN chat_members m2 ON m2.chat_id = c.id AND m2.user_id = $2
      WHERE c.type = 'dm'
        AND (SELECT COUNT(*)::int FROM chat_members cm WHERE cm.chat_id = c.id) = 2
      LIMIT 1
    `;

export const FIND_DM_CHAT_BETWEEN_USERS_LOOSE_SQL = `
      SELECT c.id, (SELECT COUNT(*)::int FROM chat_members cm WHERE cm.chat_id = c.id) AS mc
      FROM chats c
      INNER JOIN chat_members m1 ON m1.chat_id = c.id AND m1.user_id = $1
      INNER JOIN chat_members m2 ON m2.chat_id = c.id AND m2.user_id = $2
      WHERE c.type = 'dm'
      ORDER BY mc ASC, c.created_at DESC
      LIMIT 1
    `;
