-- Отложенная отправка сообщений
CREATE TABLE IF NOT EXISTS scheduled_messages (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id varchar NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  folder_id varchar,
  sender_id varchar REFERENCES users(id) ON DELETE SET NULL,
  type text NOT NULL DEFAULT 'text',
  content text NOT NULL,
  reply_to_id varchar REFERENCES messages(id) ON DELETE SET NULL,
  scheduled_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_messages_scheduled_at ON scheduled_messages(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_chat_id ON scheduled_messages(chat_id);
