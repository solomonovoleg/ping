-- Интересы поста: классификация текста через OpenRouter (jsonb + время обработки)
ALTER TABLE posts ADD COLUMN IF NOT EXISTS content_interests jsonb;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS content_interests_at timestamptz;
