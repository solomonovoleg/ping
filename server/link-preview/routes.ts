/**
 * Превью ссылок: извлечение og:image, og:title, og:description.
 * GET /api/link-preview?url=...  (короткие URL)
 * POST /api/link-preview  body: { "url": "..." }  (длинные ссылки без лимита query в nginx)
 *
 * Ошибки загрузки целевой страницы → 200 и пустые поля (не 502), чтобы не засорять консоль
 * и не считать «нет og-тегов» серверной поломкой.
 */
import type { Request, Response } from "express";
import { linkPreviewLimiter } from "../auth/rate-limit";
import { requireAuth } from "../auth/session";
import { isSsrfRiskUrl } from "../security/ssrf-guard";

const URL_RE = /^https?:\/\/[^\s<>"{}|\\^`[\]]+$/i;
const FETCH_TIMEOUT_MS = 5000;
const MAX_BODY_LENGTH = 100_000;
const MAX_URL_CHARS = 12_000;

const emptyPreview = () => ({
  image: null as string | null,
  title: null as string | null,
  description: null as string | null,
  embedUrl: null as string | null,
});

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

function extractVkEmbedUrl(html: string): string | null {
  const patterns = [
    /https?:\\\/\\\/vk\.com\\\/video_ext\.php\?[^"'\\\s<]+/gi,
    /https?:\/\/vk\.com\/video_ext\.php\?[^"'\s<]+/gi,
    /\/\/vk\.com\/video_ext\.php\?[^"'\s<]+/gi,
  ];
  for (const pattern of patterns) {
    const m = html.match(pattern);
    if (!m?.length) continue;
    for (const raw of m) {
      let candidate = raw;
      candidate = candidate.replace(/\\\//g, "/");
      candidate = candidate.replace(/&amp;/gi, "&");
      candidate = candidate.replace(/\\u0026/gi, "&");
      if (candidate.startsWith("//")) candidate = `https:${candidate}`;
      if (!/^https?:\/\/vk\.com\/video_ext\.php\?/i.test(candidate)) continue;
      if (!/[?&]oid=-?\d+/i.test(candidate) || !/[?&]id=\d+/i.test(candidate)) continue;
      return candidate;
    }
  }
  return null;
}

function readUrlFromRequest(req: Request): string {
  const fromQuery = typeof req.query.url === "string" ? req.query.url.trim() : "";
  if (fromQuery) return fromQuery;
  const body = req.body as { url?: unknown } | undefined;
  return typeof body?.url === "string" ? body.url.trim() : "";
}

async function handleLinkPreview(req: Request, res: Response): Promise<void> {
  res.setHeader("Cache-Control", "no-store, private");
  const url = readUrlFromRequest(req);
  if (!url || url.length > MAX_URL_CHARS || !URL_RE.test(url)) {
    res.status(400).json({ message: "Некорректный URL" });
    return;
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      res.status(400).json({ message: "Некорректный URL" });
      return;
    }
    if (isSsrfRiskUrl(parsed)) {
      res.status(400).json({ message: "URL недоступен для превью" });
      return;
    }
  } catch {
    res.status(400).json({ message: "Некорректный URL" });
    return;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let resp: globalThis.Response;
    try {
      resp = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": "Mozilla/5.0 (compatible; PING-MOOT/1.0)" },
      });
    } finally {
      clearTimeout(timeout);
    }
    if (!resp.ok) {
      res.json(emptyPreview());
      return;
    }
    const text = await resp.text();
    const body = text.slice(0, MAX_BODY_LENGTH);
    const meta = extractOgMeta(body);
    const host = parsed.hostname.replace(/^www\./i, "").replace(/^m\./i, "").toLowerCase();
    const isVkHost = host === "vk.com" || host === "vk.ru";
    const embedUrl = isVkHost ? extractVkEmbedUrl(body) : null;
    if (!meta.image && !meta.title && !meta.description && !embedUrl) {
      res.json(emptyPreview());
      return;
    }
    res.json({
      image: meta.image ?? null,
      title: meta.title ?? null,
      description: meta.description ?? null,
      embedUrl: embedUrl ?? null,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      res.json(emptyPreview());
      return;
    }
    res.json(emptyPreview());
  }
}

export function registerLinkPreviewRoutes(app: import("express").Express): void {
  app.get("/api/link-preview", requireAuth, linkPreviewLimiter, (req: Request, res: Response) => {
    void handleLinkPreview(req, res);
  });
  app.post("/api/link-preview", requireAuth, linkPreviewLimiter, (req: Request, res: Response) => {
    void handleLinkPreview(req, res);
  });
}
