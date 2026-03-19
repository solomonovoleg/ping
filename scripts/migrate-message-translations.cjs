#!/usr/bin/env node
"use strict";
/**
 * Message translations cache + per-chat translate prefs.
 * Запуск: node scripts/migrate-message-translations.cjs
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
CREATE TABLE IF NOT EXISTS message_translations (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
  message_id varchar NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  target_lang varchar(10) NOT NULL,
  translated_text text NOT NULL,
  detected_lang varchar(10),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(message_id, target_lang)
);
CREATE INDEX IF NOT EXISTS idx_msg_translations_msg ON message_translations(message_id);

CREATE TABLE IF NOT EXISTS chat_translate_prefs (
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chat_id varchar NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  target_lang varchar(10) NOT NULL DEFAULT 'ru',
  PRIMARY KEY (user_id, chat_id)
);
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
    console.log("message_translations + chat_translate_prefs ready");
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
