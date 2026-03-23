-- Запланированные звонки Пингок: баннер в DM для обоих участников
CREATE TABLE IF NOT EXISTS dm_scheduled_calls (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id varchar NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  created_by_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  peer_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  planner_reminder_id varchar REFERENCES user_reminders(id) ON DELETE SET NULL,
  fire_at timestamptz NOT NULL,
  title text NOT NULL,
  initiator_dismissed_at timestamptz,
  peer_dismissed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dm_scheduled_calls_chat_fire
  ON dm_scheduled_calls (chat_id, fire_at);
