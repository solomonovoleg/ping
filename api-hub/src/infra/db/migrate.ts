import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { config } from "../../config.js";

const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "migrations");

async function run() {
  if (!config.dbUrl) {
    throw new Error("API_HUB_DB_URL is required for db:migrate");
  }
  const client = new Client({ connectionString: config.dbUrl });
  await client.connect();
  await client.query(`
    create table if not exists api_hub_migrations (
      id text primary key,
      applied_at timestamptz not null default now()
    )
  `);
  const files = (await fs.readdir(migrationsDir))
    .filter((name) => name.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));
  for (const file of files) {
    const existing = await client.query("select id from api_hub_migrations where id = $1", [file]);
    if (existing.rowCount) continue;
    const sql = await fs.readFile(path.join(migrationsDir, file), "utf8");
    await client.query("begin");
    try {
      await client.query(sql);
      await client.query("insert into api_hub_migrations (id) values ($1)", [file]);
      await client.query("commit");
      // eslint-disable-next-line no-console
      console.log(`applied migration ${file}`);
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  }
  await client.end();
}

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
