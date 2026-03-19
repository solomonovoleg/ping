CREATE TABLE IF NOT EXISTS message_translations (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  message_id varchar NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  target_lang varchar(10) NOT NULL,
  translated_text text NOT NULL,
  detected_lang varchar(10),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(message_id, target_lang)
);
CREATE INDEX IF NOT EXISTS idx_msg_translations_msg ON message_translations(message_id);

CREATE TABLE IF NOT EXISTS chat_translate_prefs (
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chat_id varchar NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  target_lang varchar(10) NOT NULL DEFAULT 'ru',
  PRIMARY KEY (user_id, chat_id)
);
