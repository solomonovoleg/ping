/**
 * Превью ссылок: извлечение og:image, og:title, og:description.
 * GET /api/link-preview?url=...
 */
import type { Request, Response } from "express";
import { linkPreviewLimiter } from "../auth/rate-limit";
import { requireAuth } from "../auth/session";
import { isSsrfRiskUrl } from "../security/ssrf-guard";

const URL_RE = /^https?:\/\/[^\s<>"{}|\\^`[\]]+$/i;
const FETCH_TIMEOUT_MS = 5000;
const MAX_BODY_LENGTH = 100_000;

function extractOgMeta(html: string): { image?: string; title?: string; description?: string } {
  const result: { image?: string; title?: string; description?: string } = {};
  const ogImage = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  if (ogImage?.[1]) result.image = ogImage[1].trim();
  const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
  if (ogTitle?.[1]) result.title = ogTitle[1].trim().slice(0, 200);
  const ogDesc = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i);
  if (ogDesc?.[1]) result.description = ogDesc[1].trim().slice(0, 300);
  return result;
}

export function registerLinkPreviewRoutes(app: import("express").Express): void {
  app.get("/api/link-preview", requireAuth, linkPreviewLimiter, async (req: Request, res: Response) => {
    const url = typeof req.query.url === "string" ? req.query.url.trim() : "";
    if (!url || !URL_RE.test(url)) {
      return res.status(400).json({ message: "Некорректный URL" });
    }
    let parsed: URL;
    try {
      parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return res.status(400).json({ message: "Некорректный URL" });
      }
      if (isSsrfRiskUrl(parsed)) {
        return res.status(400).json({ message: "URL недоступен для превью" });
      }
    } catch {
      return res.status(400).json({ message: "Некорректный URL" });
    }
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      const resp = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": "Mozilla/5.0 (compatible; PING-MOOT/1.0)" },
      });
      clearTimeout(timeout);
      if (!resp.ok) {
        return res.status(502).json({ message: "Не удалось загрузить страницу" });
      }
      const text = await resp.text();
      const body = text.slice(0, MAX_BODY_LENGTH);
      const meta = extractOgMeta(body);
      if (!meta.image && !meta.title && !meta.description) {
        return res.json({ image: null, title: null, description: null });
      }
      res.json({
        image: meta.image ?? null,
        title: meta.title ?? null,
        description: meta.description ?? null,
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return res.status(504).json({ message: "Таймаут" });
      }
      res.status(502).json({ message: "Ошибка загрузки" });
    }
  });
}
