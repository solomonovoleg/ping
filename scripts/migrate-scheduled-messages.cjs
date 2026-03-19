#!/usr/bin/env node
"use strict";
/**
 * Отложенная отправка: scheduled_messages.
 * Запуск: node scripts/migrate-scheduled-messages.cjs (с DATABASE_URL в .env).
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
CREATE TABLE IF NOT EXISTS scheduled_messages (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id varchar NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  folder_id varchar,
  sender_id varchar REFERENCES users(id) ON DELETE SET NULL,
  type text NOT NULL DEFAULT 'text',
  content text NOT NULL,
  reply_to_id varchar REFERENCES messages(id) ON DELETE SET NULL,
  scheduled_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_messages_scheduled_at ON scheduled_messages(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_chat_id ON scheduled_messages(chat_id);
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
    console.log("scheduled_messages ready");
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
