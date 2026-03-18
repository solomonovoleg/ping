/**
 * PM2 для деплоя на VPS: отдельная папка, порт 3080, своя БД.
 * Запуск из папки проекта: pm2 start ecosystem.config.cjs
 * Заполни SESSION_SECRET и DATABASE_URL (отдельная БД ping_moot).
 */
module.exports = {
  apps: [
    {
      name: "ping-moot",
      script: "dist/index.cjs",
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
        PORT: 3080,
        // DATABASE_URL и SESSION_SECRET берутся из .env в папке проекта (dotenv/config)
      },
    },
  ],
};
