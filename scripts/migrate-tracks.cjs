#!/usr/bin/env node
"use strict";
/**
 * Создаёт таблицы tracks и track_items.
 * Запуск: node scripts/migrate-tracks.cjs (на сервере с DATABASE_URL в .env).
 */
const path = require("path");
const fs = require("fs");

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
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

function normalizeDbUrl(u) {
  if (!u || typeof u !== "string") return u;
  return u.replace(/@base/g, "@localhost").trim();
}

const { Client } = require("pg");

const SQL = `
-- Треки: пользовательские списки для сбора сообщений из чатов
CREATE TABLE IF NOT EXISTS tracks (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS track_items (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id varchar NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  message_id varchar NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  chat_id varchar NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  added_at timestamptz NOT NULL DEFAULT now(),
  done_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_tracks_user_id ON tracks(user_id);
CREATE INDEX IF NOT EXISTS idx_track_items_track_id ON track_items(track_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_track_items_track_message ON track_items(track_id, message_id);
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
    console.log("tracks, track_items ready");
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
