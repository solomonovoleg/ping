-- Service chat: host config, templates, threads and step states.
-- Safe re-run via IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS service_chat_hosts (
  host_user_id varchar PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  global_replies_allowed boolean NOT NULL DEFAULT false,
  activated_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS service_chat_templates (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  host_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS service_chat_template_steps (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  template_id varchar NOT NULL REFERENCES service_chat_templates(id) ON DELETE CASCADE,
  order_index integer NOT NULL DEFAULT 0,
  content text NOT NULL,
  media_json text,
  delay_after_read_sec integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS service_chat_threads (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  host_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chat_id varchar NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  template_id varchar REFERENCES service_chat_templates(id) ON DELETE SET NULL,
  local_replies_enabled boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS service_chat_threads_host_target_uq
  ON service_chat_threads(host_user_id, target_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS service_chat_threads_chat_uq
  ON service_chat_threads(chat_id);

CREATE TABLE IF NOT EXISTS service_chat_step_states (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  thread_id varchar NOT NULL REFERENCES service_chat_threads(id) ON DELETE CASCADE,
  step_id varchar NOT NULL REFERENCES service_chat_template_steps(id) ON DELETE CASCADE,
  sent_message_id varchar REFERENCES messages(id) ON DELETE SET NULL,
  sent_at timestamptz,
  read_at timestamptz,
  next_send_at timestamptz,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS service_chat_step_states_thread_step_uq
  ON service_chat_step_states(thread_id, step_id);
CREATE INDEX IF NOT EXISTS service_chat_step_states_due_idx
  ON service_chat_step_states(status, next_send_at)
  WHERE sent_at IS NULL;
CREATE INDEX IF NOT EXISTS service_chat_step_states_sent_message_idx
  ON service_chat_step_states(sent_message_id)
  WHERE sent_message_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS service_chat_campaigns (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  host_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  template_id varchar REFERENCES service_chat_templates(id) ON DELETE SET NULL,
  mode text NOT NULL,
  filters_json text,
  status text NOT NULL DEFAULT 'created',
  created_at timestamptz NOT NULL DEFAULT now()
);
