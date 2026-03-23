-- Идемпотентные начисления XP за действия на платформе (просмотр поста, реакция, шаринг).

CREATE TABLE IF NOT EXISTS edge_task_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_public_id varchar(128) NOT NULL,
  platform_user_id varchar(64) NOT NULL,
  task_key varchar(64) NOT NULL,
  ref_key varchar(256) NOT NULL,
  xp_awarded int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT edge_task_grants_dedupe UNIQUE (campaign_public_id, platform_user_id, task_key, ref_key)
);

CREATE INDEX IF NOT EXISTS idx_edge_task_grants_campaign ON edge_task_grants (campaign_public_id);
