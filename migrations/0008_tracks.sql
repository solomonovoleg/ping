-- Треки: пользовательские списки для сбора сообщений из чатов
CREATE TABLE IF NOT EXISTS tracks (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS track_items (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id varchar NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  message_id varchar NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  chat_id varchar NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now(),
  done_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_tracks_user_id ON tracks(user_id);
CREATE INDEX IF NOT EXISTS idx_track_items_track_id ON track_items(track_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_track_items_track_message ON track_items(track_id, message_id);
