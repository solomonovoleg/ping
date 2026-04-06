-- Контекст для диплинков в админке: пост у комментария, чат у сообщения.
ALTER TABLE content_reports ADD COLUMN IF NOT EXISTS context_post_id text;
ALTER TABLE content_reports ADD COLUMN IF NOT EXISTS context_chat_id varchar(128);
