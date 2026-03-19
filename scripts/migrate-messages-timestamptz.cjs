#!/usr/bin/env node
"use strict";
/**
 * Сообщения: created_at в UTC (timestamptz).
 * Если сервер хранил naive timestamp в Europe/Moscow, конвертируем в UTC.
 * Для сервера в UTC замените 'Europe/Moscow' на 'UTC' в SQL.
 * Запуск: node scripts/migrate-messages-timestamptz.cjs (с DATABASE_URL в .env).
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
ALTER TABLE messages
  ALTER COLUMN created_at TYPE timestamptz
  USING created_at AT TIME ZONE 'Europe/Moscow';
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
    const r = await client.query(`
      SELECT data_type FROM information_schema.columns
      WHERE table_name = 'messages' AND column_name = 'created_at';
    `);
    if (r.rows[0]?.data_type === "timestamp with time zone") {
      console.log("messages.created_at already timestamptz, skip");
      return;
    }
    await client.query(SQL);
    console.log("messages.created_at -> timestamptz");
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
