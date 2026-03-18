#!/usr/bin/env node
"use strict";
/**
 * Создаёт таблицу post_comments, если её нет. Запуск на сервере: node scripts/migrate-post-comments.cjs
 * Использует .env в текущей директории (DATABASE_URL).
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
const { Client } = require("pg");

function normalizeDbUrl(u) {
  if (!u || typeof u !== "string") return u;
  return u.replace(/@base/g, "@localhost").trim();
}

const SQL = `
CREATE TABLE IF NOT EXISTS post_comments (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id varchar(64) NOT NULL,
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
`;

async function main() {
  const url = normalizeDbUrl(process.env.DATABASE_URL);
  if (!url) {
    console.warn("DATABASE_URL не задан, миграция пропущена.");
    process.exit(0);
  }
  const client = new Client({ connectionString: url.trim() });
  try {
    await client.connect();
    await client.query(SQL);
    console.log("Таблица post_comments готова.");
  } catch (e) {
    console.error("Ошибка миграции:", e.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
