-- Добавляем колонки last_seen_at и fcm_token в users (идемпотентно)
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS fcm_token TEXT;
