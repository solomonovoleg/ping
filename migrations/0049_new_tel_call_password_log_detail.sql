ALTER TABLE new_tel_call_password_log
  ADD COLUMN IF NOT EXISTS detail jsonb;
