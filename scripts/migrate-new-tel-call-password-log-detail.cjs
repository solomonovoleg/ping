#!/usr/bin/env node
"use strict";
/** migrations/0049_new_tel_call_password_log_detail.sql */
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
const sqlPath = path.join(process.cwd(), "migrations/0049_new_tel_call_password_log_detail.sql");

async function main() {
  const url = normalizeDbUrl(process.env.DATABASE_URL);
  if (!url) {
    console.warn("DATABASE_URL не задан, миграция new_tel detail пропущена.");
    process.exit(0);
  }
  if (!fs.existsSync(sqlPath)) {
    console.error("Missing", sqlPath);
    process.exit(1);
  }
  const sql = fs.readFileSync(sqlPath, "utf-8");
  const client = new Client({ connectionString: url });
  try {
    await client.connect();
    await client.query(sql);
    console.log("new_tel_call_password_log.detail готово.");
  } catch (e) {
    console.error("Ошибка migrate-new-tel-call-password-log-detail:", e.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
