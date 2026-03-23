-- Победители розыгрышей по кампании (один и тот же gift_key на пользователя — один раз).

CREATE TABLE IF NOT EXISTS edge_prize_winners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_public_id varchar(128) NOT NULL,
  platform_user_id varchar(64) NOT NULL,
  gift_key text NOT NULL DEFAULT 'default',
  draw_batch_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_edge_prize_winners_campaign ON edge_prize_winners (campaign_public_id);
CREATE INDEX IF NOT EXISTS idx_edge_prize_winners_batch ON edge_prize_winners (draw_batch_id);

CREATE UNIQUE INDEX IF NOT EXISTS edge_prize_winners_campaign_user_gift
  ON edge_prize_winners (campaign_public_id, platform_user_id, gift_key);
