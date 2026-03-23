/**
 * PM2 для деплоя на VPS: отдельная папка, свой порт, своя БД.
 * Запуск из папки проекта: PORT=3081 PM2_APP_NAME=ping-moot-staging pm2 start ecosystem.config.cjs
 *
 * ПИНГОК МИКРО: отключить PINGOK_MICRO_PM2_ENABLED=0. Подключается только если собран dist/pingok-micro.cjs.
 * EDGE: включить явно EDGE_PM2_ENABLED=1. Подключается только если собран dist/edge.cjs.
 * PARSER (ВК): PARSER_PM2_ENABLED=1 и dist/parser.cjs.
 * FEED-WORKER: FEED_WORKER_PM2_ENABLED=1 и dist/feed-worker.cjs — пересчёт глобальной ленты в БД.
 */
require("dotenv").config({ path: require("path").join(__dirname, ".env") });

const fs = require("fs");
const path = require("path");

const port = Number(process.env.PORT) || 3080;
const name = process.env.PM2_APP_NAME || "ping-moot";

const pingokPort = Number(process.env.PINGOK_MICRO_PORT) || 3091;
const pingokName = process.env.PINGOK_PM2_NAME || "pingok-micro";
const pingokDisabled = String(process.env.PINGOK_MICRO_PM2_ENABLED || "").trim() === "0";
const pingokScript = path.join(__dirname, "dist/pingok-micro.cjs");
const pingokBuilt = fs.existsSync(pingokScript);

const edgePort = Number(process.env.EDGE_PORT) || 3092;
const edgeName = process.env.EDGE_PM2_NAME || "ping-moot-edge";
const edgeEnabled = String(process.env.EDGE_PM2_ENABLED || "").trim() === "1";
const edgeScript = path.join(__dirname, "dist/edge.cjs");
const edgeBuilt = fs.existsSync(edgeScript);

const parserPort = Number(process.env.PARSER_PORT) || 3093;
const parserName = process.env.PARSER_PM2_NAME || "ping-moot-parser";
const parserEnabled = String(process.env.PARSER_PM2_ENABLED || "").trim() === "1";
const parserScript = path.join(__dirname, "dist/parser.cjs");
const parserBuilt = fs.existsSync(parserScript);

const feedWorkerName = process.env.FEED_WORKER_PM2_NAME || "ping-moot-feed-worker";
const feedWorkerEnabled = String(process.env.FEED_WORKER_PM2_ENABLED || "").trim() === "1";
const feedWorkerScript = path.join(__dirname, "dist/feed-worker.cjs");
const feedWorkerBuilt = fs.existsSync(feedWorkerScript);

const mainApp = {
  name,
  script: "dist/index.cjs",
  cwd: __dirname,
  instances: 1,
  autorestart: true,
  watch: false,
  max_memory_restart: "1200M",
  env: {
    NODE_ENV: "production",
    PORT: port,
  },
};

const pingokApp = {
  name: pingokName,
  script: "dist/pingok-micro.cjs",
  cwd: __dirname,
  instances: 1,
  autorestart: true,
  watch: false,
  max_memory_restart: "256M",
  env: {
    NODE_ENV: "production",
    PINGOK_MICRO_PORT: pingokPort,
    ...(process.env.PINGOK_MICRO_CORS_ORIGIN
      ? { PINGOK_MICRO_CORS_ORIGIN: process.env.PINGOK_MICRO_CORS_ORIGIN }
      : {}),
    ...(process.env.PINGOK_MICRO_PARSE_PER_MIN
      ? { PINGOK_MICRO_PARSE_PER_MIN: process.env.PINGOK_MICRO_PARSE_PER_MIN }
      : {}),
  },
};

const edgeApp = {
  name: edgeName,
  script: "dist/edge.cjs",
  cwd: __dirname,
  instances: 1,
  autorestart: true,
  watch: false,
  max_memory_restart: "384M",
  env: {
    NODE_ENV: "production",
    PORT: edgePort,
    EDGE_BIND: process.env.EDGE_BIND || "127.0.0.1",
    ...(process.env.EDGE_SERVICE_SECRET
      ? { EDGE_SERVICE_SECRET: process.env.EDGE_SERVICE_SECRET }
      : {}),
  },
};

const parserApp = {
  name: parserName,
  script: "dist/parser.cjs",
  cwd: __dirname,
  instances: 1,
  autorestart: true,
  watch: false,
  max_memory_restart: "384M",
  env: {
    NODE_ENV: "production",
    PORT: parserPort,
    PARSER_BIND: process.env.PARSER_BIND || "127.0.0.1",
    ...(process.env.DATABASE_URL ? { DATABASE_URL: process.env.DATABASE_URL } : {}),
    ...(process.env.PARSER_DATABASE_URL ? { PARSER_DATABASE_URL: process.env.PARSER_DATABASE_URL } : {}),
    ...(process.env.PARSER_SERVICE_SECRET
      ? { PARSER_SERVICE_SECRET: process.env.PARSER_SERVICE_SECRET }
      : {}),
    ...(process.env.PARSER_PLATFORM_URL ? { PARSER_PLATFORM_URL: process.env.PARSER_PLATFORM_URL } : {}),
    ...(process.env.VK_PARSER_TOKEN_KEY ? { VK_PARSER_TOKEN_KEY: process.env.VK_PARSER_TOKEN_KEY } : {}),
    ...(process.env.S3_ENDPOINT ? { S3_ENDPOINT: process.env.S3_ENDPOINT } : {}),
    ...(process.env.S3_BUCKET ? { S3_BUCKET: process.env.S3_BUCKET } : {}),
    ...(process.env.S3_ACCESS_KEY ? { S3_ACCESS_KEY: process.env.S3_ACCESS_KEY } : {}),
    ...(process.env.S3_SECRET_KEY ? { S3_SECRET_KEY: process.env.S3_SECRET_KEY } : {}),
    ...(process.env.S3_REGION ? { S3_REGION: process.env.S3_REGION } : {}),
    ...(process.env.S3_PUBLIC_ACL ? { S3_PUBLIC_ACL: process.env.S3_PUBLIC_ACL } : {}),
  },
};

const feedWorkerApp = {
  name: feedWorkerName,
  script: "dist/feed-worker.cjs",
  cwd: __dirname,
  instances: 1,
  autorestart: true,
  watch: false,
  max_memory_restart: "512M",
  env: {
    NODE_ENV: "production",
    ...(process.env.DATABASE_URL ? { DATABASE_URL: process.env.DATABASE_URL } : {}),
    ...(process.env.FEED_WORKER_INTERVAL_SEC
      ? { FEED_WORKER_INTERVAL_SEC: process.env.FEED_WORKER_INTERVAL_SEC }
      : {}),
    ...(process.env.FEED_ALGO_MODE ? { FEED_ALGO_MODE: process.env.FEED_ALGO_MODE } : {}),
    ...(process.env.FEED_BOOST_WINDOW_HOURS ? { FEED_BOOST_WINDOW_HOURS: process.env.FEED_BOOST_WINDOW_HOURS } : {}),
    ...(process.env.FEED_RANKING_CANDIDATE_MAX
      ? { FEED_RANKING_CANDIDATE_MAX: process.env.FEED_RANKING_CANDIDATE_MAX }
      : {}),
  },
};

const apps = [mainApp];
if (!pingokDisabled && pingokBuilt) {
  apps.push(pingokApp);
}
if (edgeEnabled && edgeBuilt) {
  apps.push(edgeApp);
}
if (parserEnabled && parserBuilt) {
  apps.push(parserApp);
}
if (feedWorkerEnabled && feedWorkerBuilt) {
  apps.push(feedWorkerApp);
}

module.exports = { apps };
