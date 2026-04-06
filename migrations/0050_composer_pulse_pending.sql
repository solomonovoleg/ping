CREATE TABLE IF NOT EXISTS composer_pulse_pending (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id VARCHAR NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  from_user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  consumed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_composer_pulse_pending_to_unconsumed
  ON composer_pulse_pending (to_user_id)
  WHERE consumed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_composer_pulse_pending_created
  ON composer_pulse_pending (created_at);
