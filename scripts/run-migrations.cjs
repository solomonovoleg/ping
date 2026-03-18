#!/usr/bin/env node
"use strict";
/**
 * Запуск всех миграций с гарантированным DATABASE_URL (на VPS всегда localhost).
 * Вызывается из server-setup.sh. Читает .env, подменяет хост base -> localhost, запускает каждый migrate-*.cjs.
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

function forceLocalhostUrl(urlStr) {
  if (!urlStr || typeof urlStr !== "string") return urlStr;
  let u = String(urlStr).trim().replace(/^["']|["']$/g, "");
  u = u.replace(/@base/g, "@localhost");
  u = u.replace(/base:5432/g, "localhost:5432");
  u = u.replace(/(@)([^:@\/]+)(:\d+)/g, (_, at, host, port) =>
    String(host).trim().toLowerCase() === "base" ? at + "localhost" + port : at + host + port
  );
  return u;
}

// Используем DATABASE_URL из shell только если в нём нет "base" (на сервере мог остаться старый .env)
let dbUrl = process.env.DATABASE_URL && !String(process.env.DATABASE_URL).includes("base")
  ? String(process.env.DATABASE_URL).trim()
  : null;

if (!dbUrl) {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) {
    console.warn(".env не найден, миграции пропущены.");
    process.exit(0);
  }
  let content = fs.readFileSync(envPath, "utf-8").replace(/\r/g, "");
  const match = content.match(/^\s*DATABASE_URL\s*=\s*(.*)$/m);
  if (!match) {
    console.warn("DATABASE_URL не найден в .env, миграции пропущены.");
    process.exit(0);
  }
  dbUrl = forceLocalhostUrl((match[1] || "").trim());
}
if (!dbUrl) {
  console.warn("DATABASE_URL пустой, миграции пропущены.");
  process.exit(0);
}

dbUrl = forceLocalhostUrl(dbUrl);
process.env.DATABASE_URL = dbUrl;

const scripts = [
  "scripts/migrate-user-columns.cjs",
  "scripts/migrate-posts.cjs",
  "scripts/migrate-post-comments.cjs",
  "scripts/migrate-missed-calls.cjs",
  "scripts/migrate-referrals.cjs",
  "scripts/migrate-follows.cjs",
  "scripts/migrate-stories.cjs",      // сначала stories, потом story_views (REFERENCES stories)
  "scripts/migrate-story-views.cjs",
  "scripts/migrate-notifications-and-more.cjs",
];

const envWithDb = { ...process.env, DATABASE_URL: dbUrl };
for (const script of scripts) {
  const fullPath = path.join(process.cwd(), script);
  if (!fs.existsSync(fullPath)) continue;
  const r = spawnSync("node", [fullPath], {
    stdio: "inherit",
    cwd: process.cwd(),
    env: envWithDb,
  });
  if (r.status !== 0 && r.status !== null) {
    console.error("Миграция завершилась с ошибкой:", script);
  }
}

console.log("Миграции выполнены.");
