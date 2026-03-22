#!/usr/bin/env node
"use strict";
/**
 * Гранулярная блокировка: restrict_profile / restrict_chat / restrict_social в user_blocks.
 * migrations/0020_user_block_restrictions.sql
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
const sqlPath = path.join(process.cwd(), "migrations/0020_user_block_restrictions.sql");

async function main() {
  const url = normalizeDbUrl(process.env.DATABASE_URL);
  if (!url) {
    console.error("DATABASE_URL not set");
    process.exit(1);
  }
  if (!fs.existsSync(sqlPath)) {
    console.error("Missing", sqlPath);
    process.exit(1);
  }
  const client = new Client({ connectionString: url.trim() });
  await client.connect();
  try {
    const SQL = fs.readFileSync(sqlPath, "utf-8");
    await client.query(SQL);
    console.log("user_blocks restrict_* columns ready");
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
