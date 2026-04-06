import type { IndexHtmlTransformContext, Plugin } from "vite";
import {
  SITE_APPLE_WEB_APP_TITLE,
  SITE_DEFAULT_ORIGIN,
  SITE_DOCUMENT_TITLE,
  SITE_META_DESCRIPTION,
  SITE_OG_IMAGE_PATH,
  SITE_OG_LOCALE,
} from "./client/src/lib/site-seo-defaults";

function escAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function resolveSiteOrigin(isDevServer: boolean): string {
  const fromEnv = (process.env.VITE_SITE_ORIGIN || process.env.SITE_ORIGIN || "").trim().replace(/\/+$/, "");
  if (fromEnv && /^https?:\/\//i.test(fromEnv)) return fromEnv;
  if (!isDevServer && SITE_DEFAULT_ORIGIN.trim()) {
    return SITE_DEFAULT_ORIGIN.trim().replace(/\/+$/, "");
  }
  return "";
}

function absolutePublicUrl(path: string, origin: string): string {
  if (!origin) return path;
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${p}`;
}

/**
 * Подставляет SEO из `client/src/lib/site-seo-defaults.ts` в client/index.html при сборке и в dev.
 */
export function siteSeoHtmlPlugin(): Plugin {
  return {
    name: "vite-plugin-site-seo-html",
    transformIndexHtml(html, ctx: IndexHtmlTransformContext) {
      const isDevServer = Boolean(ctx.server);
      const origin = resolveSiteOrigin(isDevServer);
      const ogImage = absolutePublicUrl(SITE_OG_IMAGE_PATH, origin);
      const ogUrlLine =
        origin && /^https?:\/\//i.test(origin)
          ? `    <meta property="og:url" content="${escAttr(`${origin}/`)}" />\n`
          : "";
      return html
        .replace(/__PING_SITE_DOCUMENT_TITLE__/g, escAttr(SITE_DOCUMENT_TITLE))
        .replace(/__PING_SITE_META_DESCRIPTION__/g, escAttr(SITE_META_DESCRIPTION))
        .replace(/__PING_SITE_OG_LOCALE__/g, escAttr(SITE_OG_LOCALE))
        .replace(/__PING_SITE_APPLE_WEB_APP_TITLE__/g, escAttr(SITE_APPLE_WEB_APP_TITLE))
        .replace(/__PING_SITE_OG_IMAGE_PATH__/g, escAttr(ogImage))
        .replace(/__PING_SITE_OG_URL_META_LINE__/g, ogUrlLine);
    },
  };
}
