import { Pool } from "pg";
import { getEdgeDatabaseUrl } from "../config/env.js";

let pool: Pool | null = null;

export function getEdgePool(): Pool | null {
  const url = getEdgeDatabaseUrl();
  if (!url) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: url,
      max: Number(process.env.EDGE_PG_POOL_MAX) > 0 ? Number(process.env.EDGE_PG_POOL_MAX) : 8,
    });
  }
  return pool;
}

export async function edgePoolHealth(): Promise<boolean> {
  const p = getEdgePool();
  if (!p) return false;
  try {
    await p.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

export async function closeEdgePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
