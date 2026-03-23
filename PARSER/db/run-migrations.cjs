#!/usr/bin/env node
"use strict";
/**
 * Миграции PARSER (PARSER/migrations/*.sql). Нужен PARSER_DATABASE_URL или DATABASE_URL.
 */
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

function loadRootEnv() {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    if ((key === "PARSER_DATABASE_URL" || key === "DATABASE_URL") && process.env[key]) continue;
    let val = m[2].replace(/^["']|["']$/g, "").trim();
    if ((key === "PARSER_DATABASE_URL" || key === "DATABASE_URL") && val.includes("@base")) {
      val = val.replace(/@base/g, "@localhost").replace(/base:5432/g, "localhost:5432");
    }
    process.env[key] = val;
  }
}

function normalizeUrl(u) {
  if (!u || typeof u !== "string") return u;
  return u.replace(/@base/g, "@localhost").replace(/base:5432/g, "localhost:5432").trim();
}

function pickDbUrl() {
  const a = normalizeUrl(process.env.PARSER_DATABASE_URL);
  if (a) return a;
  return normalizeUrl(process.env.DATABASE_URL);
}

async function main() {
  loadRootEnv();
  const url = pickDbUrl();
  if (!url) {
    console.warn("PARSER: нет PARSER_DATABASE_URL / DATABASE_URL — миграции пропущены.");
    process.exit(0);
  }
  const dir = path.join(process.cwd(), "PARSER", "migrations");
  if (!fs.existsSync(dir)) {
    console.error("Нет каталога", dir);
    process.exit(1);
  }
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    for (const f of files) {
      const sqlPath = path.join(dir, f);
      const sql = fs.readFileSync(sqlPath, "utf-8");
      console.log("PARSER migrate:", f);
      await client.query(sql);
    }
    console.log("OK parser migrations");
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
