#!/usr/bin/env node
"use strict";
const path = require("path");
const fs = require("fs");

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (m) {
      if (m[1] === "DATABASE_URL" && process.env.DATABASE_URL) continue;
      let val = m[2].replace(/^["']|["']$/g, "").trim();
      if (m[1] === "DATABASE_URL" && val.includes("@base")) val = val.replace(/@base/g, "@localhost");
      process.env[m[1]] = val;
    }
  }
}

loadEnv();
const { Client } = require("pg");

const SQL = `
CREATE TABLE IF NOT EXISTS ai_search_chat_cursors (
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chat_id varchar NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  last_created_at timestamptz,
  PRIMARY KEY (user_id, chat_id)
);

CREATE TABLE IF NOT EXISTS ai_search_dialogue_tags (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chat_id varchar NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  tag_key varchar(64) NOT NULL,
  tag_label varchar(200) NOT NULL,
  peer_user_id varchar REFERENCES users(id) ON DELETE SET NULL,
  hit_count int NOT NULL DEFAULT 1,
  first_at timestamptz NOT NULL DEFAULT now(),
  last_at timestamptz NOT NULL DEFAULT now(),
  snippet text,
  UNIQUE (user_id, chat_id, tag_key)
);

CREATE TABLE IF NOT EXISTS ai_search_interests (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind varchar(20) NOT NULL CHECK (kind IN ('commercial', 'behavioral')),
  label_key varchar(64) NOT NULL,
  label_display varchar(240) NOT NULL,
  score int NOT NULL DEFAULT 50 CHECK (score >= 0 AND score <= 100),
  evidence_count int NOT NULL DEFAULT 1,
  last_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind, label_key)
);

CREATE INDEX IF NOT EXISTS ai_search_tags_user_label ON ai_search_dialogue_tags (user_id, tag_label);
CREATE INDEX IF NOT EXISTS ai_search_interests_user_kind ON ai_search_interests (user_id, kind);

CREATE TABLE IF NOT EXISTS ai_search_hot_signals (
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  signal_key varchar(64) NOT NULL,
  label_display varchar(240) NOT NULL,
  snippet text,
  source_chat_id varchar REFERENCES chats(id) ON DELETE SET NULL,
  score int NOT NULL DEFAULT 60 CHECK (score >= 0 AND score <= 100),
  last_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (user_id, signal_key)
);

CREATE INDEX IF NOT EXISTS ai_search_hot_user_expires ON ai_search_hot_signals (user_id, expires_at DESC);
`;

async function main() {
  let url = (process.env.DATABASE_URL || "").replace(/@base/g, "@localhost").trim();
  if (!url) {
    console.warn("DATABASE_URL не задан, миграция пропущена.");
    process.exit(0);
  }
  const client = new Client({ connectionString: url });
  try {
    await client.connect();
    await client.query(SQL);
    console.log("ai-search: таблицы готовы.");
  } catch (e) {
    console.error("Ошибка migrate-ai-search:", e.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
