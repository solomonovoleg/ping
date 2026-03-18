#!/usr/bin/env node
"use strict";
/**
 * Проверка постов в БД. Запуск: node scripts/check-posts.cjs
 * Использует .env (DATABASE_URL). На сервере: cd /path/to/app && node scripts/check-posts.cjs
 */
const path = require("path");
const fs = require("fs");

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
  }
}

loadEnv();
const { Client } = require("pg");

function normalizeDbUrl(u) {
  if (!u) return u;
  if (u.includes("@base")) return u.replace(/@base(?=[:\/]|$)/g, "@localhost");
  return u;
}

async function main() {
  const url = normalizeDbUrl(process.env.DATABASE_URL);
  if (!url) {
    console.warn("DATABASE_URL не задан.");
    process.exit(1);
  }
  const client = new Client({ connectionString: url.trim() });
  try {
    await client.connect();
    const r = await client.query(
      "SELECT id, author_id, left(text, 60) AS text_preview, created_at FROM posts ORDER BY created_at DESC LIMIT 10"
    );
    console.log("Последние посты в БД:", r.rows.length);
    r.rows.forEach((row, i) => {
      console.log(`  ${i + 1}. id=${row.id} author=${row.author_id} ${row.created_at} "${(row.text_preview || "").replace(/\n/g, " ")}"`);
    });
  } catch (e) {
    console.error("Ошибка:", e.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
