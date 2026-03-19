#!/usr/bin/env node
"use strict";
/**
 * Папки в групповых чатах: chat_folders + folder_id в messages.
 * Запуск: node scripts/migrate-chat-folders.cjs (на сервере с DATABASE_URL в .env).
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
-- Папки в групповых чатах: основной поток (Общий) + второстепенные топики
CREATE TABLE IF NOT EXISTS chat_folders (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id varchar NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_main boolean NOT NULL DEFAULT false,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE messages ADD COLUMN IF NOT EXISTS folder_id varchar REFERENCES chat_folders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_chat_folders_chat_id ON chat_folders(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_folder_id ON messages(folder_id);

-- Для существующих групповых чатов: создать папку «Общий» и привязать старые сообщения
INSERT INTO chat_folders (id, chat_id, name, is_main, order_index)
SELECT gen_random_uuid(), c.id, 'Общий', true, 0
FROM chats c
WHERE c.type = 'group'
  AND NOT EXISTS (SELECT 1 FROM chat_folders cf WHERE cf.chat_id = c.id AND cf.is_main = true);

UPDATE messages m
SET folder_id = (SELECT cf.id FROM chat_folders cf WHERE cf.chat_id = m.chat_id AND cf.is_main = true LIMIT 1)
WHERE m.folder_id IS NULL
  AND EXISTS (SELECT 1 FROM chats c WHERE c.id = m.chat_id AND c.type = 'group');
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
    console.log("chat_folders, messages.folder_id ready");
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
