import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // index.html — без кэша, чтобы после деплоя браузер подтянул новый JS
  app.get(["/", "/index.html"], (_req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.sendFile(path.resolve(distPath, "index.html"));
  });

  app.use(express.static(distPath));

  // SPA fallback: любой GET, не отданный static, отдаём index.html.
  // Не отдаём HTML для /uploads и /api — иначе браузер получит HTML вместо аудио/картинки → красные запросы и 00:00 у голосовых.
  app.get("/{*path}", (req, res) => {
    if (req.path.startsWith("/uploads") || req.path.startsWith("/api")) {
      res.status(404).send("Not found");
      return;
    }
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
