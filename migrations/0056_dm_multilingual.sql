-- DM: общий режим «каждый видит входящие на своём языке»
ALTER TABLE chats ADD COLUMN IF NOT EXISTS dm_multilingual_enabled boolean NOT NULL DEFAULT false;

-- Язык входящих переводов для пользователя (синхронизируется с клиентом)
ALTER TABLE users ADD COLUMN IF NOT EXISTS message_translate_locale varchar(10);
