-- Invite link code for group chats (admin-created or user-generated).
ALTER TABLE chats ADD COLUMN IF NOT EXISTS invite_code text;
CREATE UNIQUE INDEX IF NOT EXISTS chats_invite_code_uniq ON chats (invite_code) WHERE invite_code IS NOT NULL;
