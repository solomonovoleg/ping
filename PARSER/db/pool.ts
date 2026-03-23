import { Pool } from "pg";
import { getParserDatabaseUrl, getParserPoolMax } from "../config/env.js";

let pool: Pool | null = null;

export function getParserPool(): Pool {
  const url = getParserDatabaseUrl();
  if (!url) {
    throw new Error("Задайте PARSER_DATABASE_URL или DATABASE_URL для процесса PARSER");
  }
  if (!pool) {
    pool = new Pool({
      connectionString: url,
      max: getParserPoolMax(),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 15_000,
    });
  }
  return pool;
}

export async function parserPoolHealth(): Promise<boolean> {
  const url = getParserDatabaseUrl();
  if (!url) return false;
  try {
    await getParserPool().query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

export async function closeParserPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
