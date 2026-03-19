-- Добавляем срок жизни сториз (expires_at). Старым записям ставим 24 часа от created_at.
ALTER TABLE stories
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

UPDATE stories
SET expires_at = COALESCE(expires_at, created_at + INTERVAL '24 hours');

ALTER TABLE stories
ALTER COLUMN expires_at SET DEFAULT (NOW() + INTERVAL '24 hours');

ALTER TABLE stories
ALTER COLUMN expires_at SET NOT NULL;

