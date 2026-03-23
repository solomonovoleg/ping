import type { Request, Response, NextFunction } from "express";
import { parserPoolHealth } from "../db/pool.js";

export async function getHealth(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const database = await parserPoolHealth();
    res.json({
      ok: true,
      service: "ping-moot-parser",
      database,
    });
  } catch (e) {
    next(e);
  }
}
