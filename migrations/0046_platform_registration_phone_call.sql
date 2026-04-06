-- Регистрация: опционально подтверждение номера звонком (переключатель в админке).
ALTER TABLE platform_settings
  ADD COLUMN IF NOT EXISTS registration_phone_call_verification_enabled boolean NOT NULL DEFAULT true;
