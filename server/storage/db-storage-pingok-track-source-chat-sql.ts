/** Поиск одиночного группового служебного чата треков Pingok для пользователя. */
export const PINGOK_TRACK_SOURCE_CHAT_FIND_SQL = `
      SELECT c.id
      FROM chats c
      INNER JOIN chat_members m ON m.chat_id = c.id AND m.user_id = $1
      WHERE c.type = 'group' AND c.name = '__pingok_track_src'
        AND (SELECT COUNT(*)::int FROM chat_members cm WHERE cm.chat_id = c.id) = 1
      LIMIT 1
    `;

export const PINGOK_TRACK_SOURCE_CHAT_INSERT_SQL = `INSERT INTO chats (type, name) VALUES ('group', '__pingok_track_src') RETURNING id`;

export const PINGOK_TRACK_SOURCE_CHAT_ADD_MEMBER_SQL = `INSERT INTO chat_members (chat_id, user_id, role) VALUES ($1, $2, 'admin')`;
