#!/usr/bin/env node
"use strict";
/**
 * Создаёт таблицу posts, если её нет. Запуск: node scripts/migrate-posts.cjs
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
CREATE TABLE IF NOT EXISTS posts (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text text NOT NULL,
  image_url text,
  media_urls jsonb,
  reactions jsonb DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE posts ADD COLUMN IF NOT EXISTS media_urls jsonb;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS hashtags jsonb;

CREATE TABLE IF NOT EXISTS post_reactions (
  post_id varchar NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji varchar(20) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS post_views (
  post_id varchar NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS post_shares (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id varchar NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  from_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
    console.log("Таблицы posts, post_reactions, post_views, post_shares готовы.");
  } catch (e) {
    console.error("Ошибка миграции:", e.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
