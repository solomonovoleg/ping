#!/usr/bin/env node
"use strict";
/**
 * SENDER: настройки приветствия подписчикам и лог доставок.
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
  let url = normalizeDbUrl(process.env.DATABASE_URL);
  if (!url) {
    console.warn("DATABASE_URL не задан, миграция пропущена.");
    process.exit(0);
  }
  const client = new Client({ connectionString: url.trim() });
  try {
    await client.connect();
    await client.query(`
      CREATE TABLE IF NOT EXISTS sender_welcome_settings (
        user_id varchar PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        module_enabled boolean NOT NULL DEFAULT false,
        auto_send_on_follow boolean NOT NULL DEFAULT false,
        welcome_text text NOT NULL DEFAULT '',
        welcome_media_url text,
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS sender_welcome_deliveries (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        follower_user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await client.query(
      `CREATE INDEX IF NOT EXISTS sender_welcome_deliveries_owner_idx ON sender_welcome_deliveries(owner_user_id)`,
    );
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS sender_welcome_deliveries_owner_follower_uidx
      ON sender_welcome_deliveries(owner_user_id, follower_user_id)
    `);
    console.log("SENDER (sender_welcome_*) готово.");
  } catch (e) {
    console.error("Ошибка миграции sender-welcome:", e.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
