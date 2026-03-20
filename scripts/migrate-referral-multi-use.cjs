#!/usr/bin/env node
"use strict";
/**
 * Многоразовые пригласительные коды: max_uses, use_count.
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
    await client.query(
      `ALTER TABLE referral_codes ADD COLUMN IF NOT EXISTS max_uses integer NOT NULL DEFAULT 1`
    );
    await client.query(
      `ALTER TABLE referral_codes ADD COLUMN IF NOT EXISTS use_count integer NOT NULL DEFAULT 0`
    );
    console.log("Колонки referral_codes.max_uses / use_count готовы.");
  } catch (e) {
    console.error("Ошибка миграции referral multi-use:", e.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
