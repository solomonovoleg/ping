CREATE TABLE IF NOT EXISTS business_widgets (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  owner_user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chat_id text NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  name text NOT NULL,
  provider_type text NOT NULL DEFAULT 'custom',
  endpoint_url text NOT NULL,
  contract_url text,
  api_key_enc text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  last_autoconfig_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS business_widgets_chat_uq
  ON business_widgets(chat_id);
CREATE UNIQUE INDEX IF NOT EXISTS business_widgets_owner_name_uq
  ON business_widgets(owner_user_id, name);

CREATE TABLE IF NOT EXISTS business_contracts (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  widget_id text NOT NULL REFERENCES business_widgets(id) ON DELETE CASCADE,
  raw_json text NOT NULL,
  normalized_dsl_json text NOT NULL,
  ui_blueprint_json text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS business_contracts_widget_version_uq
  ON business_contracts(widget_id, version);

CREATE TABLE IF NOT EXISTS business_actions (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  widget_id text NOT NULL REFERENCES business_widgets(id) ON DELETE CASCADE,
  action_id text NOT NULL,
  label text NOT NULL,
  kind text NOT NULL DEFAULT 'button',
  request_method text NOT NULL DEFAULT 'POST',
  request_path text,
  input_schema_json text,
  payload_json text,
  order_index integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS business_actions_widget_action_uq
  ON business_actions(widget_id, action_id);

CREATE TABLE IF NOT EXISTS business_events (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  widget_id text NOT NULL REFERENCES business_widgets(id) ON DELETE CASCADE,
  direction text NOT NULL,
  event_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  idempotency_key text,
  external_event_id text,
  payload_json text NOT NULL,
  response_json text,
  attempt_count integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS business_events_widget_external_uq
  ON business_events(widget_id, direction, external_event_id)
  WHERE external_event_id IS NOT NULL;
