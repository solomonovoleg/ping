import express from "express";
import { config } from "./config.js";
import { toErrorPayload } from "./lib/http-error.js";
import { Logger } from "./lib/logger.js";
import { requestContext } from "./middleware/request-context.js";
import { requestMetrics } from "./middleware/metrics.js";
import { authRoutes } from "./routes/auth-routes.js";
import { chatRoutes } from "./routes/chat-routes.js";
import { mediaRoutes } from "./routes/media-routes.js";
import { registerInternalPlatformBridge } from "./routes/internal-platform-bridge.js";
import { platformUploadRoutes } from "./routes/platform-upload-routes.js";
import { profileRoutes } from "./routes/profile-routes.js";
import { realtimeRoutes } from "./routes/realtime-routes.js";
import { systemRoutes } from "./routes/system-routes.js";

const logger = new Logger(config.logLevel as "debug" | "info" | "warn" | "error");

export function createApp() {
  const app = express();
  if (config.bridgeTrustForwarded) {
    app.set("trust proxy", 1);
  }
  app.use(express.json({ limit: "70mb" }));
  app.use(requestContext);
  app.use(requestMetrics);

  app.use((req, _res, next) => {
    logger.info("request", {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
    });
    next();
  });

  registerInternalPlatformBridge(app);
  app.use("/", systemRoutes);
  app.use("/v1/auth", authRoutes);
  app.use("/v1", profileRoutes);
  app.use("/v1", platformUploadRoutes);
  app.use("/v1", chatRoutes);
  app.use("/v1", realtimeRoutes);
  app.use("/v1", mediaRoutes);

  app.use((error: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const payload = toErrorPayload(error);
    logger.error("request_failed", {
      requestId: req.requestId,
      path: req.path,
      status: payload.status,
      error: payload.body.error,
    });
    res.status(payload.status).json(payload.body);
  });

  return app;
}
