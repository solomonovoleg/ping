-- Элементы закреплённого: прямое фото/видео в папке (не только пост/сториз).
ALTER TABLE profile_pin_items ADD COLUMN IF NOT EXISTS media_url TEXT;
ALTER TABLE profile_pin_items ADD COLUMN IF NOT EXISTS media_is_video BOOLEAN NOT NULL DEFAULT false;
