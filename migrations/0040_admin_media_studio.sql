-- Media Studio: маркеры studio-пользователей, кампании контента, приглашения в группы по ссылке (идемпотентно).

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_studio_synthetic BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS studio_created_by_admin_id VARCHAR REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS users_is_studio_synthetic_idx ON users(is_studio_synthetic) WHERE is_studio_synthetic = true;

CREATE TABLE IF NOT EXISTS admin_media_studio_campaigns (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by_admin_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  schedule_mode VARCHAR(32),
  schedule_interval_seconds_min INTEGER,
  schedule_interval_seconds_max INTEGER,
  shuffle_seed BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT admin_media_studio_campaigns_status_chk CHECK (
    status IN ('draft', 'running', 'paused', 'completed', 'cancelled')
  ),
  CONSTRAINT admin_media_studio_campaigns_schedule_mode_chk CHECK (
    schedule_mode IS NULL OR schedule_mode IN ('fixed_interval', 'random_interval')
  )
);

CREATE INDEX IF NOT EXISTS admin_media_studio_campaigns_status_idx ON admin_media_studio_campaigns(status);
CREATE INDEX IF NOT EXISTS admin_media_studio_campaigns_created_by_idx ON admin_media_studio_campaigns(created_by_admin_id);

CREATE TABLE IF NOT EXISTS admin_media_studio_campaign_posts (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id VARCHAR NOT NULL REFERENCES admin_media_studio_campaigns(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  author_user_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
  body_text TEXT,
  media_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  scheduled_at TIMESTAMPTZ,
  published_post_id VARCHAR REFERENCES posts(id) ON DELETE SET NULL,
  state VARCHAR(32) NOT NULL DEFAULT 'queued',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT admin_media_studio_campaign_posts_state_chk CHECK (
    state IN ('queued', 'published', 'failed', 'skipped')
  )
);

CREATE INDEX IF NOT EXISTS admin_media_studio_campaign_posts_campaign_idx ON admin_media_studio_campaign_posts(campaign_id);
CREATE INDEX IF NOT EXISTS admin_media_studio_campaign_posts_scheduled_idx ON admin_media_studio_campaign_posts(scheduled_at)
  WHERE state = 'queued' AND scheduled_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS admin_media_studio_group_invites (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id VARCHAR NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  created_by_admin_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  max_members INTEGER,
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS admin_media_studio_group_invites_chat_idx ON admin_media_studio_group_invites(chat_id);
