/**
 * Запуск миграций из папки migrations/ (по порядку имени файла).
 * Записывает применённые миграции в таблицу __migrations.
 * Запуск: npm run db:migrate
 */
import "dotenv/config";
import { readdir, readFile } from "fs/promises";
import { join } from "path";
import { getPool } from "../server/db";

const MIGRATIONS_DIR = join(process.cwd(), "migrations");

async function main() {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS __migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const files = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const name = file;
    const { rows } = await pool.query("SELECT 1 FROM __migrations WHERE name = $1", [name]);
    if (rows.length > 0) {
      console.log("Skip (already applied):", name);
      continue;
    }
    const sql = await readFile(join(MIGRATIONS_DIR, file), "utf-8");
    await pool.query(sql);
    await pool.query("INSERT INTO __migrations (name) VALUES ($1)", [name]);
    console.log("Applied:", name);
  }

  await pool.end();
  console.log("Миграции выполнены.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
