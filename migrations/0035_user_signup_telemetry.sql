-- Сигналы регистрации: IP, заголовки, device_id (cookie), хеш clientSignals — для выявления серийных регистраций.
ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_ip VARCHAR(64);
ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_forwarded_for TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_user_agent TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_ua_hash VARCHAR(64);
ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_accept_language VARCHAR(256);
ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_sec_ch_ua TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_sec_ch_ua_mobile VARCHAR(32);
ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_sec_ch_ua_platform VARCHAR(256);
ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_referer TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_origin VARCHAR(256);
ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_device_id VARCHAR(128);
ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_client_signals_hash VARCHAR(64);
ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_client_signals_json TEXT;

CREATE INDEX IF NOT EXISTS users_signup_device_id_idx ON users (signup_device_id) WHERE signup_device_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS users_signup_ip_idx ON users (signup_ip) WHERE signup_ip IS NOT NULL;
CREATE INDEX IF NOT EXISTS users_signup_ua_hash_idx ON users (signup_ua_hash) WHERE signup_ua_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS users_signup_client_signals_hash_idx ON users (signup_client_signals_hash) WHERE signup_client_signals_hash IS NOT NULL;
