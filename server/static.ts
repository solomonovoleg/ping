import express, { type Express, type Request, type Response } from "express";
import fs from "fs";
import path from "path";
import { applyReferralSeoToIndexHtml } from "@shared/referral-seo-html";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  const noStoreIndexHeaders = (res: Response) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  };

  const sendIndexHtml = (req: Request, res: Response, withNoStoreExtras = true) => {
    const filePath = path.resolve(distPath, "index.html");
    const ref = typeof req.query.ref === "string" ? req.query.ref.trim() : "";
    if (withNoStoreExtras) noStoreIndexHeaders(res);
    else res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    if (ref.length > 0) {
      const html = applyReferralSeoToIndexHtml(fs.readFileSync(filePath, "utf8"));
      res.type("html").send(html);
    } else {
      res.sendFile(filePath);
    }
  };

  // index.html — без кэша, чтобы после деплоя браузер подтянул новый JS
  app.get(["/", "/index.html"], (req, res) => {
    sendIndexHtml(req, res, true);
  });

  app.use(express.static(distPath));

  // SPA fallback: любой GET, не отданный static, отдаём index.html.
  // Публичные юридические маршруты клиента: /privacy, /terms (App Store / ссылки из приложения).
  // Не отдаём HTML для /uploads, /api и /assets — иначе браузер получит text/html
  // вместо бинарников/JS-модулей (MIME ошибки, падение lazy-чанков).
  app.get("/{*path}", (req, res) => {
    if (req.path.startsWith("/uploads") || req.path.startsWith("/api") || req.path.startsWith("/assets")) {
      res.status(404).send("Not found");
      return;
    }
    sendIndexHtml(req, res, false);
  });
}
