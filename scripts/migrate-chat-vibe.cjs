#!/usr/bin/env node
"use strict";
const path = require("path");
const fs = require("fs");

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    if (m[1] === "DATABASE_URL" && process.env.DATABASE_URL) continue;
    let val = m[2].replace(/^["']|["']$/g, "").trim();
    if (m[1] === "DATABASE_URL" && val.includes("@base")) val = val.replace(/@base/g, "@localhost");
    process.env[m[1]] = val;
  }
}

loadEnv();

function normalizeDbUrl(u) {
  if (!u || typeof u !== "string") return u;
  return u.replace(/@base/g, "@localhost").trim();
}

const { Client } = require("pg");

const SQL = `
-- Current vibe state per chat (one row per DM)
CREATE TABLE IF NOT EXISTS chat_vibe_state (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id varchar NOT NULL UNIQUE REFERENCES chats(id) ON DELETE CASCADE,
  theme text NOT NULL DEFAULT 'casual',
  confidence numeric(5,2) NOT NULL DEFAULT 0,
  warmth int NOT NULL DEFAULT 50,
  tension int NOT NULL DEFAULT 10,
  playfulness int NOT NULL DEFAULT 30,
  intimacy int NOT NULL DEFAULT 20,
  formality int NOT NULL DEFAULT 30,
  energy int NOT NULL DEFAULT 40,
  message_counter int NOT NULL DEFAULT 0,
  theme_version int NOT NULL DEFAULT 1,
  last_batch_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Batch analysis history
CREATE TABLE IF NOT EXISTS chat_vibe_batches (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id varchar NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  window_size int NOT NULL,
  dominant_pattern text NOT NULL,
  secondary_pattern text,
  confidence numeric(5,2) NOT NULL,
  warmth int NOT NULL,
  tension int NOT NULL,
  playfulness int NOT NULL,
  intimacy int NOT NULL,
  formality int NOT NULL,
  energy int NOT NULL,
  toxicity_flag boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_vibe_batches_chat_id ON chat_vibe_batches(chat_id);

-- Theme change log
CREATE TABLE IF NOT EXISTS chat_vibe_history (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id varchar NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  old_theme text NOT NULL,
  new_theme text NOT NULL,
  old_confidence numeric(5,2) NOT NULL,
  new_confidence numeric(5,2) NOT NULL,
  trigger_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_vibe_history_chat_id ON chat_vibe_history(chat_id);

-- User vibe preferences
ALTER TABLE users ADD COLUMN IF NOT EXISTS vibe_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS vibe_share_with_partner boolean NOT NULL DEFAULT false;
`;

async function main() {
  const url = normalizeDbUrl(process.env.DATABASE_URL);
  if (!url) {
    console.error("DATABASE_URL not set");
    process.exit(1);
  }
  const client = new Client({ connectionString: url.trim() });
  await client.connect();
  try {
    await client.query(SQL);
    console.log("chat_vibe tables + user columns ready");
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
