#!/usr/bin/env node
"use strict";
/**
 * Запуск всех миграций с гарантированным DATABASE_URL (на VPS всегда localhost).
 * Вызывается из server-setup.sh. Читает .env, подменяет хост base -> localhost, запускает каждый migrate-*.cjs.
 * При ошибке процесс завершается с кодом 1. Временные ошибки PostgreSQL (53300, «too many clients») — повтор с паузой.
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

function sleepMs(ms) {
  const sec = Math.max(0.1, ms / 1000);
  if (process.platform === "win32") {
    const end = Date.now() + ms;
    while (Date.now() < end) {}
    return;
  }
  spawnSync("sleep", [String(sec)], { stdio: "ignore" });
}

const RETRY_DB_FULL =
  /53300|remaining connection slots|too many clients|sorry, too many clients already/i;

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
  "scripts/migrate-referral-multi-use.cjs",
  "scripts/migrate-follows.cjs",
  "scripts/migrate-designated-follows.cjs", // Леха (/profile/5) + первый сид → все seed_social_* (идемпотентно)
  "scripts/migrate-stories.cjs", // сначала stories, потом story_views (REFERENCES stories)
  "scripts/migrate-story-views.cjs",
  "scripts/migrate-story-likes.cjs",
  "scripts/migrate-notifications-and-more.cjs",
  "scripts/migrate-tracks.cjs",
  "scripts/migrate-chat-folders.cjs",
  "scripts/migrate-scheduled-messages.cjs",
  "scripts/migrate-message-hidden.cjs",
  "scripts/migrate-messages-timestamptz.cjs",
  "scripts/migrate-message-translations.cjs",
  "scripts/migrate-chat-vibe.cjs",
];

const envWithDb = { ...process.env, DATABASE_URL: dbUrl };

function runOne(fullPath) {
  const r = spawnSync("node", [fullPath], {
    stdio: ["inherit", "inherit", "pipe"],
    cwd: process.cwd(),
    env: envWithDb,
    encoding: "utf8",
  });
  const stderr = (r.stderr && String(r.stderr)) || "";
  if (stderr) process.stderr.write(stderr);
  const status = r.status;
  const spawnErr = r.error;
  return { status, stderr, spawnErr };
}

function runWithRetries(script, fullPath) {
  const maxAttempts = 4;
  let backoffMs = 2500;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const { status, stderr, spawnErr } = runOne(fullPath);
    if (spawnErr) {
      console.error("Не удалось запустить миграцию:", script, spawnErr.message);
      return false;
    }
    if (status === 0) return true;
    const retryable = RETRY_DB_FULL.test(stderr);
    if (retryable && attempt < maxAttempts) {
      console.error(
        `Миграция ${script}: временная нехватка соединений БД, повтор ${attempt + 1}/${maxAttempts} через ${backoffMs} мс…`
      );
      sleepMs(backoffMs);
      backoffMs = Math.min(backoffMs * 2, 30000);
      continue;
    }
    console.error("Миграция завершилась с ошибкой:", script);
    return false;
  }
  return false;
}

let anyFailed = false;
for (const script of scripts) {
  const fullPath = path.join(process.cwd(), script);
  if (!fs.existsSync(fullPath)) continue;
  if (!runWithRetries(script, fullPath)) anyFailed = true;
  sleepMs(350);
}

if (anyFailed) {
  console.error("Миграции завершились с ошибками (см. лог выше).");
  process.exit(1);
}
console.log("Миграции выполнены.");
