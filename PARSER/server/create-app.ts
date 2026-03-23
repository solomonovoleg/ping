import express from "express";
import { createHealthRouter } from "../health/routes.js";
import { createV1AdminRouter } from "../http/v1-router.js";
import { startParserWorker } from "../parser/worker.js";

export function createParserApp(): express.Express {
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "512kb" }));

  app.use("/v1", createHealthRouter());
  app.use("/v1", createV1AdminRouter());

  startParserWorker();

  app.use((_req, res) => {
    res.status(404).json({ error: "not_found" });
  });

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("[parser]", err);
    const msg = err instanceof Error ? err.message : "internal_error";
    if (!res.headersSent) {
      res.status(500).json({ message: msg });
    }
  });

  return app;
}
