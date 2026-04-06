import pg from "pg";
import { config } from "../../config.js";

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool | null {
  if (!config.dbUrl) return null;
  if (!pool) {
    pool = new pg.Pool({ connectionString: config.dbUrl, max: 10 });
  }
  return pool;
}

export async function pingDb(): Promise<boolean> {
  const p = getPool();
  if (!p) return false;
  try {
    await p.query("select 1 as ok");
    return true;
  } catch {
    return false;
  }
}
