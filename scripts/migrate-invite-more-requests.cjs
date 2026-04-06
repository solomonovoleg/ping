#!/usr/bin/env node
"use strict";
/**
 * Таблица заявок на дополнительные приглашения (invite_more_requests).
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
      CREATE TABLE IF NOT EXISTS invite_more_requests (
        id varchar PRIMARY KEY,
        user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        message text,
        status varchar(16) NOT NULL DEFAULT 'pending',
        created_at timestamptz NOT NULL DEFAULT now(),
        reviewed_at timestamptz,
        reviewed_by_user_id text REFERENCES users(id),
        bonus_invites integer NOT NULL DEFAULT 3
      )
    `);
    await client.query(
      `CREATE INDEX IF NOT EXISTS invite_more_requests_status_idx ON invite_more_requests(status)`
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS invite_more_requests_user_pending_idx ON invite_more_requests(user_id) WHERE status = 'pending'`
    );
    console.log("Таблица invite_more_requests готова.");
  } catch (e) {
    console.error("Ошибка миграции invite_more_requests:", e.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
