/**
 * ПИНГОК МИКРО — отдельный процесс. Не импортируется из `server/index.ts`.
 * Для продакшена предпочтительно `POST /api/pingok-micro/v1/parse` на основном приложении (сессия).
 */
import express from "express";
import rateLimit from "express-rate-limit";
import type { PingokMicroParseRequest } from "../shared/command-types";
import { parsePingokCommandHeuristic } from "../shared/parse-heuristic";

const PORT = Number(process.env.PINGOK_MICRO_PORT || process.env.PORT || 3091);
const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "32kb" }));

const parseLimiter = rateLimit({
  windowMs: 60_000,
  limit: Number(process.env.PINGOK_MICRO_PARSE_PER_MIN ?? 60),
  standardHeaders: true,
  legacyHeaders: false,
});

const defaultOrigins = [
  "http://localhost:5000",
  "http://127.0.0.1:5000",
  "http://localhost:3080",
  "http://127.0.0.1:3080",
];
const allowedOrigins = process.env.PINGOK_MICRO_CORS_ORIGIN
  ? process.env.PINGOK_MICRO_CORS_ORIGIN.split(",").map((s) => s.trim())
  : defaultOrigins;

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "pingok-micro", ts: Date.now() });
});

/** Тот же разбор, что на основном API; для изолированных тестов без cookie. */
app.post("/v1/parse", parseLimiter, (req, res) => {
  const body = req.body as PingokMicroParseRequest | undefined;
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) {
    res.status(400).json({ error: "text required" });
    return;
  }
  res.json(parsePingokCommandHeuristic({ text }));
});

app.listen(PORT, "0.0.0.0", () => {
  // eslint-disable-next-line no-console
  console.log(`[pingok-micro] http://0.0.0.0:${PORT} (health, POST /v1/parse)`);
});
