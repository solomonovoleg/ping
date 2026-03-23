import type { Request, Response, NextFunction } from "express";
import { edgePoolHealth } from "../db/pool.js";

export async function getHealth(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const database = await edgePoolHealth();
    res.json({
      ok: true,
      service: "ping-moot-edge",
      database,
    });
  } catch (e) {
    next(e);
  }
}
