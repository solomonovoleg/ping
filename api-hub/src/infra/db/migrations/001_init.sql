create table if not exists api_hub_partners (
  id text primary key,
  name text not null,
  api_key text not null unique,
  webhook_url text,
  webhook_secret text,
  rate_limit_per_minute int not null default 600,
  created_at timestamptz not null default now()
);

create table if not exists api_hub_user_links (
  partner_id text not null references api_hub_partners(id) on delete cascade,
  external_user_id text not null,
  ping_user_id text not null,
  created_at timestamptz not null default now(),
  primary key (partner_id, external_user_id)
);

create table if not exists api_hub_sessions (
  id text primary key,
  partner_id text not null references api_hub_partners(id) on delete cascade,
  ping_user_id text not null,
  scopes text[] not null,
  encrypted_refresh_token text not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists api_hub_audit_log (
  id bigserial primary key,
  event text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
