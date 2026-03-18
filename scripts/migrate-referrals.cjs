#!/usr/bin/env node
"use strict";
/**
 * Создаёт таблицу referral_codes, если её нет. Нужна для реферальных кодов (Настройки → Приглашения).
 * Запуск: node scripts/migrate-referrals.cjs (на сервере с DATABASE_URL в .env).
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

const SQL = `
CREATE TABLE IF NOT EXISTS referral_codes (
  id varchar PRIMARY KEY,
  code text NOT NULL UNIQUE,
  inviter_user_id text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz DEFAULT now()
);
`;

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
    await client.query(SQL);
    console.log("Таблица referral_codes готова.");
  } catch (e) {
    console.error("Ошибка миграции referral_codes:", e.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
