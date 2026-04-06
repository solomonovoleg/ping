import type { NextFunction, Request, Response } from "express";
import type { Multer } from "multer";

/** Обертка над multer.single: ошибки размера/типа → JSON, не next(err) на весь app. */
export function runMulterSingle(upload: Multer, field: string, tooLargeMessage: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    upload.single(field)(req, res, (err: unknown) => {
      if (err) {
        const code =
          err && typeof err === "object" && "code" in err ? (err as { code?: string }).code : undefined;
        if (code === "LIMIT_FILE_SIZE") {
          res.status(400).json({ message: tooLargeMessage });
          return;
        }
        res.status(400).json({ message: err instanceof Error ? err.message : "Ошибка загрузки файла" });
        return;
      }
      next();
    });
  };
}
