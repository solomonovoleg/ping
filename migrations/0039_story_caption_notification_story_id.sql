-- Подпись к сторис (в т.ч. @упоминания) и ссылка на сториз в уведомлении
ALTER TABLE stories ADD COLUMN IF NOT EXISTS caption text;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS story_id varchar;
