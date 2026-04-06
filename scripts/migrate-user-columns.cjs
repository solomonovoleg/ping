#!/usr/bin/env node
"use strict";
/**
 * Добавляет в таблицу users колонки last_seen_at и fcm_token, если их ещё нет.
 * Запуск на сервере: node scripts/migrate-user-columns.cjs
 * При деплое вызывается из server-setup.sh.
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

async function main() {
  const url = normalizeDbUrl(process.env.DATABASE_URL);
  if (!url) {
    console.warn("DATABASE_URL не задан, миграция пропущена.");
    process.exit(0);
  }
  const client = new Client({ connectionString: url.trim() });
  try {
    await client.connect();
    await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ");
    await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS fcm_token TEXT");
    await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS ios_voip_token TEXT");
    await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT");
    await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS invited_by_id TEXT");
    await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS cover_url TEXT");
    await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_link TEXT");
    await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS push_enabled BOOLEAN NOT NULL DEFAULT true");
    console.log(
      "Колонки users (last_seen_at, fcm_token, ios_voip_token, bio, invited_by_id, cover_url, profile_link, push_enabled) готовы.",
    );
  } catch (e) {
    console.error("Ошибка миграции user columns:", e.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
