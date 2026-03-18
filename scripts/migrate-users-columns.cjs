#!/usr/bin/env node
/**
 * Добавляет недостающие колонки в users (для сервера).
 * Запуск на сервере: ( set -a; [ -f .env ] && . ./.env; set +a; node scripts/migrate-users-columns.cjs )
 */
const { Pool } = require("pg");
function normalizeDbUrl(u) {
  if (!u || typeof u !== "string") return u;
  return u.replace(/@base/g, "@localhost").trim();
}
let url = normalizeDbUrl(process.env.DATABASE_URL);
if (!url) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}
url = url.trim();
const p = new Pool({ connectionString: url });
const alters = [
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_blocked boolean NOT NULL DEFAULT false",
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_at timestamptz",
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_by varchar(255)",
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_reason text",
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at timestamptz",
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS invited_by_id text",
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS hide_from_search boolean NOT NULL DEFAULT false",
];
(async () => {
  for (const q of alters) {
    await p.query(q);
    console.log("ok:", q.slice(0, 60) + "...");
  }
  await p.end();
  console.log("All columns ok");
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
