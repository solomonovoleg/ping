#!/usr/bin/env node
"use strict";
/**
 * Миграции БД EDGE (EDGE/migrations/*.sql по порядку).
 * Требуется EDGE_DATABASE_URL в окружении или в .env в корне репозитория.
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
    if (m[1] === "EDGE_DATABASE_URL" && process.env.EDGE_DATABASE_URL) continue;
    let val = m[2].replace(/^["']|["']$/g, "").trim();
    if (m[1] === "EDGE_DATABASE_URL" && val.includes("@base")) {
      val = val.replace(/@base/g, "@localhost").replace(/base:5432/g, "localhost:5432");
    }
    process.env[m[1]] = val;
  }
}

function normalizeUrl(u) {
  if (!u || typeof u !== "string") return u;
  return u.replace(/@base/g, "@localhost").replace(/base:5432/g, "localhost:5432").trim();
}

async function main() {
  loadRootEnv();
  const url = normalizeUrl(process.env.EDGE_DATABASE_URL);
  if (!url) {
    console.warn("EDGE_DATABASE_URL не задан — миграции EDGE пропущены.");
    process.exit(0);
  }
  const dir = path.join(process.cwd(), "EDGE", "migrations");
  if (!fs.existsSync(dir)) {
    console.error("Нет каталога", dir);
    process.exit(1);
  }
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    for (const f of files) {
      const sqlPath = path.join(dir, f);
      const sql = fs.readFileSync(sqlPath, "utf-8");
      console.log("EDGE migrate:", f);
      await client.query(sql);
    }
    console.log("OK edge migrations");
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
