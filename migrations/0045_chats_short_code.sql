-- Human-readable short code for group/business chat URLs.
ALTER TABLE chats ADD COLUMN IF NOT EXISTS short_code varchar(12);
CREATE UNIQUE INDEX IF NOT EXISTS chats_short_code_uniq ON chats (short_code) WHERE short_code IS NOT NULL;

UPDATE chats
SET short_code = substr(md5(id::text), 1, 8)
WHERE short_code IS NULL
  AND type IN ('group', 'business');
