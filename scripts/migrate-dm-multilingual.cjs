#!/usr/bin/env node
"use strict";
/**
 * DM multilingual + users.message_translate_locale.
 * Запуск: node scripts/migrate-dm-multilingual.cjs
 */
const path = require("path");
const fs = require("fs");

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split(/\n")) {
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

const SQL_PATH = path.join(__dirname, "..", "migrations", "0056_dm_multilingual.sql");

async function main() {
  const dbUrl = normalizeDbUrl(process.env.DATABASE_URL);
  if (!dbUrl) {
    console.error("DATABASE_URL не задан");
    process.exit(1);
  }
  const sql = fs.readFileSync(SQL_PATH, "utf-8");
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  try {
    await client.query(sql);
    console.log("migrate-dm-multilingual: ok");
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
