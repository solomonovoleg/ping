-- Скрытые сообщения «удалено для себя»: пользователь скрыл сообщение у себя, но оно остаётся для других.
CREATE TABLE IF NOT EXISTS message_hidden (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chat_id varchar NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  message_id varchar NOT NULL,
  hidden_at timestamp NOT NULL DEFAULT now(),
  UNIQUE(user_id, chat_id, message_id)
);
CREATE INDEX IF NOT EXISTS idx_message_hidden_user_chat ON message_hidden(user_id, chat_id);
