alter table api_hub_sessions
  add column if not exists encrypted_access_token text,
  add column if not exists access_expires_at timestamptz;

create table if not exists api_hub_webhook_outbox (
  id bigserial primary key,
  partner_id text not null references api_hub_partners(id) on delete cascade,
  payload jsonb not null,
  tries int not null default 0,
  next_try_at timestamptz not null default now(),
  delivered_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);

create index if not exists api_hub_webhook_outbox_pending_idx
  on api_hub_webhook_outbox (next_try_at)
  where delivered_at is null;

create table if not exists api_hub_partner_api_keys (
  id bigserial primary key,
  partner_id text not null references api_hub_partners(id) on delete cascade,
  api_key text not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create unique index if not exists api_hub_partner_api_keys_active_uniq
  on api_hub_partner_api_keys (api_key)
  where revoked_at is null;
