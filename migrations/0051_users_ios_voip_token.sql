-- VoIP PushKit device token (iOS) для входящих звонков через CallKit / APNs voip.
ALTER TABLE users ADD COLUMN IF NOT EXISTS ios_voip_token TEXT;
