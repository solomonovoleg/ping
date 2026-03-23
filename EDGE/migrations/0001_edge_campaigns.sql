-- Ядро кампаний EDGE (отдельная БД или схема — на усмотрение деплоя).
-- public_id совпадает с posts.edge_id на платформе.

CREATE TABLE IF NOT EXISTS edge_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id varchar(128) NOT NULL,
  edge_type varchar(32) NOT NULL DEFAULT 'character',
  creator_platform_user_id varchar(64),
  title text NOT NULL DEFAULT '',
  status varchar(24) NOT NULL DEFAULT 'draft',
  gifts_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  leaderboard_global_enabled boolean NOT NULL DEFAULT true,
  follow_reward_enabled boolean NOT NULL DEFAULT false,
  config_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT edge_campaigns_public_id_unique UNIQUE (public_id)
);

CREATE INDEX IF NOT EXISTS idx_edge_campaigns_public_id ON edge_campaigns (public_id);
CREATE INDEX IF NOT EXISTS idx_edge_campaigns_creator ON edge_campaigns (creator_platform_user_id);
