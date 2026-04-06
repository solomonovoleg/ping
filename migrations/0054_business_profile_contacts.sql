ALTER TABLE users
  ADD COLUMN IF NOT EXISTS business_contact_phone VARCHAR(64);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS business_address TEXT;
