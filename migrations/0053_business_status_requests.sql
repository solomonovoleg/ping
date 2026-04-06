ALTER TABLE users
  ADD COLUMN IF NOT EXISTS business_status VARCHAR(32) NOT NULL DEFAULT 'none';

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS business_status_updated_at TIMESTAMPTZ;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS business_status_updated_by VARCHAR REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS users_business_status_idx ON users(business_status);

CREATE TABLE IF NOT EXISTS business_status_requests (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  links_json TEXT NOT NULL DEFAULT '[]',
  consent_moderation BOOLEAN NOT NULL DEFAULT true,
  status VARCHAR(32) NOT NULL DEFAULT 'submitted',
  admin_comment TEXT,
  moderated_by VARCHAR REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  moderated_at TIMESTAMPTZ
);

ALTER TABLE business_status_requests
  DROP CONSTRAINT IF EXISTS business_status_requests_status_chk;

ALTER TABLE business_status_requests
  ADD CONSTRAINT business_status_requests_status_chk CHECK (
    status IN ('submitted', 'approved', 'rejected', 'revision_required')
  );

CREATE INDEX IF NOT EXISTS business_status_requests_user_created_idx
  ON business_status_requests(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS business_status_requests_status_created_idx
  ON business_status_requests(status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS business_status_requests_user_active_submitted_uidx
  ON business_status_requests(user_id)
  WHERE status = 'submitted';
