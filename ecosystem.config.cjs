/**
 * PM2 для деплоя на VPS: отдельная папка, свой порт, своя БД.
 * Запуск из папки проекта: PORT=3081 PM2_APP_NAME=ping-moot-staging pm2 start ecosystem.config.cjs
 * На одном VPS второй инстанс: другой PM2_APP_NAME и PORT (см. deploy.env.example).
 *
 * Второй процесс — ПИНГОК МИКРО (`dist/pingok-micro.cjs`). Отключить: PINGOK_MICRO_PM2_ENABLED=0 в .env на сервере.
 */
require("dotenv").config({ path: require("path").join(__dirname, ".env") });

const port = Number(process.env.PORT) || 3080;
const name = process.env.PM2_APP_NAME || "ping-moot";

const pingokPort = Number(process.env.PINGOK_MICRO_PORT) || 3091;
const pingokName = process.env.PINGOK_PM2_NAME || "pingok-micro";
const pingokDisabled = String(process.env.PINGOK_MICRO_PM2_ENABLED || "").trim() === "0";

const mainApp = {
  name,
  script: "dist/index.cjs",
  cwd: __dirname,
  instances: 1,
  autorestart: true,
  watch: false,
  // Перекодирование видео (пост/аватар): в RAM весь файл + временные буферы — 500M давало рестарты PM2.
  max_memory_restart: "1200M",
  env: {
    NODE_ENV: "production",
    PORT: port,
    // DATABASE_URL и SESSION_SECRET берутся из .env в папке проекта (dotenv/config)
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

module.exports = {
  apps: pingokDisabled ? [mainApp] : [mainApp, pingokApp],
};
