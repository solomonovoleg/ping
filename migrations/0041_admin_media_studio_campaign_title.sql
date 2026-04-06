-- Медиа-студия: человекочитаемое название кампании (список в админке).

ALTER TABLE admin_media_studio_campaigns ADD COLUMN IF NOT EXISTS title TEXT;
