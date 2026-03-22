-- Напоминания пользователя (будильник / in-app)
CREATE TABLE IF NOT EXISTS user_reminders (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  fire_at TIMESTAMPTZ NOT NULL,
  dismissed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_reminders_user_fire ON user_reminders(user_id, fire_at);
CREATE INDEX IF NOT EXISTS idx_user_reminders_due ON user_reminders(user_id) WHERE dismissed_at IS NULL;

-- Голосовые задачи (без привязки к сообщению в треке)
CREATE TABLE IF NOT EXISTS voice_tasks (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  done_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voice_tasks_user_open ON voice_tasks(user_id) WHERE done_at IS NULL;
