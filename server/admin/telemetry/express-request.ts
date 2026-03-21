/** Расширение Express Request для передачи текста ошибки в телеметрию (после error handler). */
declare module "express-serve-static-core" {
  interface Request {
    telemetryErrorDetail?: string;
  }
}

export {};
