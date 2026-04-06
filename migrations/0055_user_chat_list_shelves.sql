-- Пользовательские «полки» списка чатов + подписи/push-mute для встроенных полок
ALTER TABLE chat_member_prefs
  ALTER COLUMN list_section TYPE VARCHAR(64);

CREATE TABLE IF NOT EXISTS user_chat_list_custom_folder (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  push_muted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_chat_list_custom_folder_user ON user_chat_list_custom_folder(user_id);

CREATE TABLE IF NOT EXISTS user_chat_list_builtin_tab_prefs (
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tab_id VARCHAR(32) NOT NULL,
  label_override TEXT,
  push_muted BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, tab_id),
  CONSTRAINT user_chat_list_builtin_tab_prefs_tab_check CHECK (
    tab_id IN ('general', 'friends', 'work', 'promo', 'invitations')
  )
);
