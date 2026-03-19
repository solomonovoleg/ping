-- Папки в групповых чатах: основной поток (Общий) + второстепенные топики
CREATE TABLE IF NOT EXISTS chat_folders (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id varchar NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_main boolean NOT NULL DEFAULT false,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE messages ADD COLUMN IF NOT EXISTS folder_id varchar REFERENCES chat_folders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_chat_folders_chat_id ON chat_folders(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_folder_id ON messages(folder_id);

-- Для существующих групповых чатов: создать папку «Общий» и привязать старые сообщения
INSERT INTO chat_folders (id, chat_id, name, is_main, order_index)
SELECT gen_random_uuid(), c.id, 'Общий', true, 0
FROM chats c
WHERE c.type = 'group'
  AND NOT EXISTS (SELECT 1 FROM chat_folders cf WHERE cf.chat_id = c.id AND cf.is_main = true);

UPDATE messages m
SET folder_id = (SELECT cf.id FROM chat_folders cf WHERE cf.chat_id = m.chat_id AND cf.is_main = true LIMIT 1)
WHERE m.folder_id IS NULL
  AND EXISTS (SELECT 1 FROM chats c WHERE c.id = m.chat_id AND c.type = 'group');
