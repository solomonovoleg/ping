#!/usr/bin/env node
"use strict";
/**
 * Идемпотентно прописывает в БД подписки «кто на кого» для демо/прода:
 * - подписчики: пользователь с public_id = 5 (Леха, /profile/5) и первый сид +79956012736;
 * - на кого: все synthetic-аккаунты seed:social-content (phone LIKE 'seed_social_%').
 *
 * Запускается из scripts/run-migrations.cjs при каждом деплое — не нужен .env SEED_* и отдельный npm run seed:auto-follow.
 * Если сидов ещё нет, INSERT просто не создаёт строк; после появления сидов следующий деплой добавит follows.
 *
 * Запуск вручную: node scripts/migrate-designated-follows.cjs
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

/** Синхронно с seed-auto-follow.ts: первый юзер из seed-first-user */
const FIRST_SEED_USER_PHONE = "+79956012736";
/** Публичный профиль Лехи на проде: /profile/5 */
const LEKHA_PUBLIC_ID = 5;

const SQL = `
INSERT INTO follows (follower_id, following_id)
SELECT f.id, s.id
FROM users f
CROSS JOIN users s
WHERE (
  f.public_id = $1
  OR f.phone = $2
)
AND s.phone LIKE 'seed_social_%'
AND f.deleted_at IS NULL
AND s.deleted_at IS NULL
AND f.id <> s.id
ON CONFLICT (follower_id, following_id) DO NOTHING;
`;

async function main() {
  const url = normalizeDbUrl(process.env.DATABASE_URL);
  if (!url) {
    console.error("DATABASE_URL not set");
    process.exit(1);
  }
  const client = new Client({ connectionString: url.trim() });
  await client.connect();
  try {
    const r = await client.query(SQL, [LEKHA_PUBLIC_ID, FIRST_SEED_USER_PHONE]);
    console.log(
      `designated follows → seed_social_*: rows inserted/updated (0 if none or all exist): ${r.rowCount ?? 0}`
    );
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
