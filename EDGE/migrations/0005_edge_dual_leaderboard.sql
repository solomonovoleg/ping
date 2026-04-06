-- Два рейтинга (основной/дополнительный) + заморозка по каждому рейтингу.
-- Это фундамент под новую продуктовую модель; текущая логика может продолжать использовать legacy xp.

ALTER TABLE edge_character_states
  ADD COLUMN IF NOT EXISTS primary_xp int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS secondary_xp int NOT NULL DEFAULT 0;

-- Бесшовная миграция: переносим накопленный legacy xp в основной рейтинг.
UPDATE edge_character_states
SET primary_xp = xp
WHERE coalesce(primary_xp, 0) = 0
  AND coalesce(xp, 0) <> 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'edge_character_primary_xp_non_negative'
  ) THEN
    ALTER TABLE edge_character_states
      ADD CONSTRAINT edge_character_primary_xp_non_negative CHECK (primary_xp >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'edge_character_secondary_xp_non_negative'
  ) THEN
    ALTER TABLE edge_character_states
      ADD CONSTRAINT edge_character_secondary_xp_non_negative CHECK (secondary_xp >= 0);
  END IF;
END $$;

ALTER TABLE edge_campaigns
  ADD COLUMN IF NOT EXISTS leaderboard_primary_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS leaderboard_secondary_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS primary_leaderboard_frozen_at timestamptz,
  ADD COLUMN IF NOT EXISTS secondary_leaderboard_frozen_at timestamptz;
