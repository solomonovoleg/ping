-- Журнал обменов с New-Tel CallPassword (учёт запросов / расходов).
CREATE TABLE IF NOT EXISTS new_tel_call_password_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  scenario varchar(32) NOT NULL,
  api_method text NOT NULL,
  duration_ms integer NOT NULL,
  http_status integer,
  api_ok boolean,
  error_message text,
  request_redacted jsonb,
  response_sanitized jsonb
);

CREATE INDEX IF NOT EXISTS new_tel_call_password_log_created_at_idx
  ON new_tel_call_password_log (created_at DESC);
