-- Телефон: опционально зашифрованное хранение (phone_cipher + phone_lookup_hash).
-- Уникальность номера обеспечивается частичными индексами; phone может быть NULL после миграции данных.

ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_lookup_hash VARCHAR(64);
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_cipher TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS users_phone_lookup_hash_uidx ON users(phone_lookup_hash) WHERE phone_lookup_hash IS NOT NULL;

ALTER TABLE users ALTER COLUMN phone DROP NOT NULL;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_phone_key;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_phone_unique;

CREATE UNIQUE INDEX IF NOT EXISTS users_phone_plain_uidx ON users(phone) WHERE phone IS NOT NULL AND btrim(phone) <> '';
