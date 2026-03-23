-- Участники кампании + состояние персонажа (тамагочи), одна строка на пару кампания + пользователь платформы.

CREATE TABLE IF NOT EXISTS edge_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_public_id varchar(128) NOT NULL,
  platform_user_id varchar(64) NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT edge_participants_campaign_user_unique UNIQUE (campaign_public_id, platform_user_id)
);

CREATE INDEX IF NOT EXISTS idx_edge_participants_campaign ON edge_participants (campaign_public_id);
CREATE INDEX IF NOT EXISTS idx_edge_participants_user ON edge_participants (platform_user_id);

CREATE TABLE IF NOT EXISTS edge_character_states (
  participant_id uuid PRIMARY KEY REFERENCES edge_participants(id) ON DELETE CASCADE,
  level int NOT NULL DEFAULT 0,
  xp int NOT NULL DEFAULT 0,
  mood varchar(32) NOT NULL DEFAULT 'neutral',
  happy_score int NOT NULL DEFAULT 50,
  care_streak_days int NOT NULL DEFAULT 0,
  last_fed_at timestamptz,
  last_interaction_at timestamptz,
  extra jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT edge_character_happy CHECK (happy_score >= 0 AND happy_score <= 100)
);
