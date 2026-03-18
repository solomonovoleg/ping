/**
 * Добавляет в таблицу users колонки last_seen_at и fcm_token, если их ещё нет.
 * Запуск: npx dotenv -e .env -- tsx scripts/add-missing-user-columns.ts
 * или: tsx scripts/add-missing-user-columns.ts (если .env уже загружен)
 */
import "dotenv/config";
import { getPool } from "../server/db";

async function main() {
  const pool = getPool();
  try {
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
    `);
    console.log("OK: last_seen_at");
  } catch (e) {
    console.error("last_seen_at:", e);
    throw e;
  }
  try {
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS fcm_token TEXT;
    `);
    console.log("OK: fcm_token");
  } catch (e) {
    console.error("fcm_token:", e);
    throw e;
  }
  await pool.end();
  console.log("Готово. Можно снова пробовать авторизацию.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
