-- EDGE MONEY: явное согласие игрока на отслеживание заданий (до этого счётчики и начисления не ведутся).

ALTER TABLE edge_participants
  ADD COLUMN IF NOT EXISTS money_tracking_started_at timestamptz;

COMMENT ON COLUMN edge_participants.money_tracking_started_at IS
  'Когда игрок нажал «выполнить задания» в MONEY; NULL = чат/звонки/инвайты/follow по MONEY не считаются.';
