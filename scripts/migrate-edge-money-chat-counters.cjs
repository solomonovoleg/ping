#!/usr/bin/env node
"use strict";
/**
 * Счётчики сообщений в ЛС для начисления EDGE MONEY (порог по каждому диалогу отдельно).
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
    await client.query(`
CREATE TABLE IF NOT EXISTS edge_money_chat_message_counters (
  user_id varchar(128) NOT NULL,
  chat_id varchar(128) NOT NULL,
  edge_id varchar(128) NOT NULL,
  sent_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS edge_money_chat_counters_user_chat_edge_uq
  ON edge_money_chat_message_counters (user_id, chat_id, edge_id);
    `);
    console.log("edge_money_chat_message_counters готова.");
  } catch (e) {
    console.error("Ошибка миграции edge_money_chat_message_counters:", e.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
