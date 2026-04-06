-- Категория жалобы для модерации (Apple: выбор причины).
ALTER TABLE content_reports ADD COLUMN IF NOT EXISTS reason_code varchar(32);
