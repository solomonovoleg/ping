-- Фиксированный layout медиа поста (single/collage)
ALTER TABLE posts ADD COLUMN IF NOT EXISTS media_layout JSONB;
