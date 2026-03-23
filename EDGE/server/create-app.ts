import express from "express";
import { createHealthRouter } from "../health/routes.js";
import { createCompanionRouter } from "../companion/routes.js";
import { createParticipantRouter } from "../participant/routes.js";
import { createCampaignRouter } from "../campaign/routes.js";
import { createCreatorRouter } from "../creator/routes.js";

export function createEdgeApp(): express.Express {
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "512kb" }));

  app.use("/v1", createHealthRouter());
  app.use("/v1/companion", createCompanionRouter());
  app.use("/v1/participant", createParticipantRouter());
  app.use("/v1/campaign", createCampaignRouter());
  app.use("/v1/creator", createCreatorRouter());

  app.use((_req, res) => {
    res.status(404).json({ error: "not_found" });
  });

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("[edge]", err);
    res.status(500).json({ error: "internal_error" });
  });

  return app;
}
