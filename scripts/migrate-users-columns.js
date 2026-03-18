#!/usr/bin/env node
/**
 * Добавляет недостающие колонки в users (для сервера, где drizzle-kit не ставится).
 * Запуск на сервере: ( set -a; [ -f .env ] && . ./.env; set +a; node scripts/migrate-users-columns.js )
 */
const { Pool } = require("pg");
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}
const p = new Pool({ connectionString: url });
const alters = [
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_blocked boolean NOT NULL DEFAULT false",
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_at timestamptz",
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_by varchar(255)",
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_reason text",
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at timestamptz",
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS invited_by_id text",
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
