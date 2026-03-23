-- Коды для заданий EDGE «пригласить N»: регистрация не блокируется лимитом пригласившего.
ALTER TABLE referral_codes
  ADD COLUMN IF NOT EXISTS bypass_inviter_limit boolean NOT NULL DEFAULT false;
