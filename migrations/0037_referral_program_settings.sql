ALTER TABLE platform_settings
  ADD COLUMN IF NOT EXISTS referral_default_invites integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS referral_repeat_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS referral_repeat_invites integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS referral_repeat_after_hours integer NOT NULL DEFAULT 72,
  ADD COLUMN IF NOT EXISTS referral_multi_use_default_expires_hours integer NOT NULL DEFAULT 168;

CREATE TABLE IF NOT EXISTS referral_auto_grants (
  user_id text PRIMARY KEY,
  first_limit_reached_at timestamptz,
  bonus_granted_at timestamptz,
  updated_at timestamptz DEFAULT now()
);
