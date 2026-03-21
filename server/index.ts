import "dotenv/config";
import "./admin/telemetry/express-request";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { randomUUID } from "crypto";

const app = express();
app.set("trust proxy", 1);
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

declare module "express-serve-static-core" {
  interface Request {
    requestId?: string;
  }
}

app.use(
  express.json({
    limit: "6mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const incomingRequestId =
    typeof req.headers["x-request-id"] === "string" && req.headers["x-request-id"].trim()
      ? req.headers["x-request-id"].trim().slice(0, 120)
      : "";
  const requestId = incomingRequestId || randomUUID();
  req.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);
  next();
});

// CORS с credentials: чтобы куки сессии отправлялись при запросах с другого origin (поддомен или мобильное приложение).
// iOS/Android Capacitor иногда не шлют Origin; при запросе с Bearer считаем нативным приложением и разрешаем capacitor://localhost.
app.use((req, res, next) => {
  const origin = req.headers.origin;
  let allowOrigin: string | undefined;
  if (origin && typeof origin === "string") {
    allowOrigin = origin;
  } else if (req.headers.authorization?.startsWith?.("Bearer ")) {
    allowOrigin = "capacitor://localhost";
  }
  if (allowOrigin) {
    res.setHeader("Access-Control-Allow-Origin", allowOrigin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Request-Id");
    res.setHeader("Access-Control-Expose-Headers", "X-Request-Id");
  }
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

const MAX_LOG_PREVIEW_CHARS = 1200;
const MAX_STRING_FIELD_CHARS = 180;

function sanitizeLogPayload(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === "string") {
    if (value.startsWith("data:")) {
      return `[data-url omitted, length=${value.length}]`;
    }
    if (value.length > MAX_STRING_FIELD_CHARS) {
      return `${value.slice(0, MAX_STRING_FIELD_CHARS)}…[${value.length} chars]`;
    }
    return value;
  }
  if (Array.isArray(value)) {
    if (value.length > 8) {
      return {
        summary: `array(${value.length})`,
        firstItems: value.slice(0, 3).map((item) => sanitizeLogPayload(item)),
      };
    }
    return value.map((item) => sanitizeLogPayload(item));
  }
  if (typeof value === "object") {
    const src = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(src)) {
      out[key] = sanitizeLogPayload(item);
    }
    return out;
  }
  return value;
}

function payloadToLogString(payload: unknown): string {
  try {
    const sanitized = sanitizeLogPayload(payload);
    const raw = JSON.stringify(sanitized);
    if (raw.length <= MAX_LOG_PREVIEW_CHARS) return raw;
    return `${raw.slice(0, MAX_LOG_PREVIEW_CHARS)}…[truncated ${raw.length - MAX_LOG_PREVIEW_CHARS} chars]`;
  } catch {
    return "[unserializable payload]";
  }
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `[rid:${req.requestId ?? "-"}] ${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${payloadToLogString(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    if (typeof message === "string" && message.length > 0) {
      req.telemetryErrorDetail = message.slice(0, 500);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "3080", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
      if (process.env.DATABASE_URL) {
        const { processScheduledMessages } = require("./messages/service");
        setInterval(async () => {
          try {
            const n = await processScheduledMessages();
            if (n > 0) log(`[scheduled] sent ${n} message(s)`);
          } catch (e) {
            console.warn("[scheduled] worker error:", e);
          }
        }, 60_000);
      }
    },
  );
})();
