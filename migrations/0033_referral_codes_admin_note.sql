-- Подпись админа к пригласительному коду (учёт в админке).
ALTER TABLE referral_codes ADD COLUMN IF NOT EXISTS admin_note text;
