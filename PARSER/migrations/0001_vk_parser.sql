-- Таблицы парсера ВК (та же БД, что у платформы: FK на users, posts).
CREATE TABLE IF NOT EXISTS vk_parser_bindings (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  platform_user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT,
  vk_access_token_enc TEXT NOT NULL,
  vk_owner_id TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  parse_interval_minutes INT NOT NULL DEFAULT 30,
  posts_per_run INT NOT NULL DEFAULT 5,
  require_moderation BOOLEAN NOT NULL DEFAULT true,
  visibility VARCHAR(20) NOT NULL DEFAULT 'public',
  city_line TEXT,
  last_run_at TIMESTAMPTZ,
  last_error TEXT,
  last_created_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT vk_parser_bindings_visibility_chk CHECK (visibility IN ('public', 'followers')),
  CONSTRAINT vk_parser_bindings_interval_chk CHECK (parse_interval_minutes >= 5 AND parse_interval_minutes <= 1440),
  CONSTRAINT vk_parser_bindings_per_run_chk CHECK (posts_per_run >= 1 AND posts_per_run <= 50)
);

CREATE UNIQUE INDEX IF NOT EXISTS vk_parser_bindings_user_owner_idx
  ON vk_parser_bindings(platform_user_id, vk_owner_id);

CREATE INDEX IF NOT EXISTS vk_parser_bindings_enabled_idx ON vk_parser_bindings(enabled) WHERE enabled = true;

CREATE TABLE IF NOT EXISTS vk_parser_items (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  binding_id VARCHAR NOT NULL REFERENCES vk_parser_bindings(id) ON DELETE CASCADE,
  vk_post_key VARCHAR(80) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending_review',
  post_text TEXT NOT NULL DEFAULT '',
  media_urls JSONB,
  media_layout JSONB,
  platform_post_id VARCHAR REFERENCES posts(id) ON DELETE SET NULL,
  vk_post_date INT,
  raw_excerpt JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  CONSTRAINT vk_parser_items_status_chk CHECK (
    status IN ('pending_review', 'published', 'rejected', 'failed', 'skipped')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS vk_parser_items_binding_post_idx ON vk_parser_items(binding_id, vk_post_key);
CREATE INDEX IF NOT EXISTS vk_parser_items_status_idx ON vk_parser_items(status);
CREATE INDEX IF NOT EXISTS vk_parser_items_binding_status_idx ON vk_parser_items(binding_id, status);
