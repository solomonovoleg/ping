import type { NextFunction, Request, Response } from "express";

/** Персональные API-ответы не должны попадать в shared cache / историю как «общая страница». */
export function noStorePrivateJson(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader("Cache-Control", "no-store, private");
  res.setHeader("Pragma", "no-cache");
  next();
}
