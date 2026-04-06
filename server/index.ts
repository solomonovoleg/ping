import "dotenv/config";
import "./admin/telemetry/express-request";
import compression from "compression";
import express, { type Request } from "express";
import path from "path";
import { fileURLToPath } from "url";
import { registerRoutes } from "./routes";
import { hasExplicitParserUpstreamEnv } from "./parser/proxy";
import { serveStatic } from "./static";
import { createServer } from "http";
import { randomUUID } from "crypto";
import { requestTimeoutMiddleware } from "./middleware/network/request-timeout-middleware";
import { errorHandlerMiddleware } from "./middleware/network/error-handler-middleware";
import { apiNotFoundMiddleware } from "./middleware/network/api-not-found-middleware";
import { securityHeadersMiddleware } from "./middleware/security/security-headers-middleware";

// Normalize CWD so `process.cwd()`-based paths (e.g. `/uploads`) are stable even
// when the process is started from `dist/` or another directory.
try {
  // ESM dev (tsx): import.meta.url; production bundle (dist/index.cjs): __filename.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  const thisFile = typeof __filename !== "undefined" ? __filename : fileURLToPath(import.meta.url);
  const projectRoot = path.resolve(path.dirname(thisFile), "..");
  process.chdir(projectRoot);
} catch {
  /* ignore */
}

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
/** Сжатие JSON/HTML при прямом доступе к Node. За nginx с gzip — не включать (двойное сжатие): оставить выкл. */
if (process.env.EXPRESS_COMPRESSION === "1") {
  app.use(compression({ threshold: 1024 }));
}
app.use(securityHeadersMiddleware);

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

function resolveCorsAllowOrigin(req: Request): string | undefined {
  const parseOrigins = (raw: string | undefined): Set<string> =>
    new Set(
      String(raw || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    );
  const allowedOrigins = parseOrigins(process.env.CORS_ALLOWED_ORIGINS);
  allowedOrigins.add("capacitor://localhost");
  allowedOrigins.add("http://localhost");
  allowedOrigins.add("http://127.0.0.1");
  allowedOrigins.add("http://localhost:5173");
  allowedOrigins.add("http://127.0.0.1:5173");
  allowedOrigins.add("http://localhost:3000");
  allowedOrigins.add("http://127.0.0.1:3000");

  const isAllowedOrigin = (value: string): boolean => {
    if (allowedOrigins.has(value)) return true;
    // Optional compatibility mode for staged rollout.
    return process.env.CORS_REFLECT_ORIGIN_COMPAT === "1";
  };

  const raw = req.headers.origin;
  if (typeof raw === "string") {
    const t = raw.trim();
    // Некоторые WebView шлют буквально "null" при загрузке файлов.
    if (t.length > 0 && t.toLowerCase() !== "null" && isAllowedOrigin(t)) {
      return t;
    }
  }
  if (!req.headers.authorization?.startsWith?.("Bearer ")) {
    return undefined;
  }
  const referer = req.headers.referer;
  if (typeof referer === "string" && referer.length > 0) {
    try {
      const u = new URL(referer);
      // Только оболочка приложения (не прод-домен API), иначе Allow-Origin не совпадёт с реальным Origin WebView.
      if (u.protocol === "capacitor:" || u.protocol === "ionic:") {
        if (isAllowedOrigin(u.origin)) return u.origin;
      }
      if (
        (u.protocol === "http:" || u.protocol === "https:") &&
        (u.hostname === "localhost" || u.hostname === "127.0.0.1")
      ) {
        if (isAllowedOrigin(u.origin)) return u.origin;
      }
    } catch {
      /* ignore */
    }
  }
  return isAllowedOrigin("capacitor://localhost") ? "capacitor://localhost" : undefined;
}

// CORS с credentials: куки с другого origin; нативное приложение — Bearer + иногда пустой/«null» Origin при multipart.
app.use((req, res, next) => {
  const allowOrigin = resolveCorsAllowOrigin(req);
  if (allowOrigin) {
    res.setHeader("Access-Control-Allow-Origin", allowOrigin);
    res.setHeader("Vary", "Origin");
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

app.use(requestTimeoutMiddleware);

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
  const LOG_API_RESPONSE_BODY = process.env.LOG_API_RESPONSE_BODY === "1";
  let capturedJsonResponse: Record<string, any> | undefined = undefined;
  if (LOG_API_RESPONSE_BODY) {
    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };
  }

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

/**
 * Публикация кампаний медиа-студии в том же процессе, что и API (посты с `scheduled_at <= now`).
 * Без этого при `npm run dev` без `dev:feed-worker` очередь не двигается, пока не нажать «Обработать сейчас».
 * `MEDIA_STUDIO_CAMPAIGN_TICK_SEC=0` — отключить (останутся feed-worker и ручной tick).
 */
function mediaStudioCampaignTickIntervalMs(): number | null {
  const raw = process.env.MEDIA_STUDIO_CAMPAIGN_TICK_SEC?.trim();
  if (raw === "0") return null;
  const sec = raw ? Number(raw) : 60;
  if (!Number.isFinite(sec) || sec < 0) return 60_000;
  if (sec === 0) return null;
  return Math.max(15, sec) * 1000;
}

(async () => {
  await registerRoutes(httpServer, app);

  app.use(apiNotFoundMiddleware);
  app.use(errorHandlerMiddleware);

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
      if (process.env.NODE_ENV === "production" && !hasExplicitParserUpstreamEnv()) {
        console.warn(
          "[parser-proxy] PARSER_UPSTREAM_URL не задан — админка «Парсер ВК» отвечает 503. Укажите URL PARSER, PARSER_SERVICE_SECRET и запустите процесс парсера (PM2: PARSER_PM2_ENABLED=1, см. deploy.env.example).",
        );
      }
      if (process.env.DATABASE_URL) {
        void (async () => {
          const { processScheduledMessages } = await import("./messages/service");
          const { processServiceChatWorker } = await import("./service-chat/worker");
          setInterval(async () => {
            try {
              const n = await processScheduledMessages();
              if (n > 0) log(`[scheduled] sent ${n} message(s)`);
            } catch (e) {
              console.warn("[scheduled] worker error:", e);
            }
          }, 60_000);
          setInterval(async () => {
            try {
              const n = await processServiceChatWorker();
              if (n > 0) log(`[service-chat] sent ${n} step(s)`);
            } catch (e) {
              console.warn("[service-chat] worker error:", e);
            }
          }, 10_000);
          const mediaStudioMs = mediaStudioCampaignTickIntervalMs();
          if (mediaStudioMs != null) {
            setInterval(async () => {
              try {
                const { processRunningMediaStudioCampaigns } = await import("./admin/media-studio/campaign-service");
                const r = await processRunningMediaStudioCampaigns();
                if (r.published > 0 || r.failed > 0) {
                  log(`[media-studio campaigns] published ${r.published}, failed ${r.failed}`);
                }
              } catch (e) {
                console.warn("[media-studio campaigns] tick error:", e);
              }
            }, mediaStudioMs);
          }
        })();
      }
    },
  );
})();
