-- Глобальный снапшот порядка ленты (пересчёт воркером feed-worker).
CREATE TABLE IF NOT EXISTS feed_global_snapshot (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  computed_at timestamptz NOT NULL,
  algo_mode text NOT NULL,
  candidate_count integer NOT NULL,
  post_ids jsonb NOT NULL
);
