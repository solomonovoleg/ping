-- Персональные настройки участника: закрепить, скрыть из списка, «полка» сортировки
CREATE TABLE IF NOT EXISTS chat_member_prefs (
  chat_id VARCHAR NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pinned_at TIMESTAMPTZ,
  hidden_at TIMESTAMPTZ,
  list_section VARCHAR(32) NOT NULL DEFAULT 'general',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (chat_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_member_prefs_user ON chat_member_prefs(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_member_prefs_user_hidden ON chat_member_prefs(user_id, hidden_at);
