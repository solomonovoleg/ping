/**
 * PM2 для деплоя на VPS: отдельная папка, свой порт, своя БД.
 * Запуск из папки проекта: PORT=3081 PM2_APP_NAME=ping-moot-staging pm2 start ecosystem.config.cjs
 * На одном VPS второй инстанс: другой PM2_APP_NAME и PORT (см. deploy.env.example).
 */
const port = Number(process.env.PORT) || 3080;
const name = process.env.PM2_APP_NAME || "ping-moot";

module.exports = {
  apps: [
    {
      name,
      script: "dist/index.cjs",
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
        PORT: port,
        // DATABASE_URL и SESSION_SECRET берутся из .env в папке проекта (dotenv/config)
      },
    },
  ],
};
