import type { Request } from "express";

function trimBase(raw: string | undefined): string {
  return typeof raw === "string" ? raw.trim().replace(/\/+$/, "") : "";
}

function isLocalUrl(u: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/i.test(u);
}

/**
 * Публичный https://origin для callbackLink в New-Tel call-password-id.
 * Приоритет: явные env → Host запроса (nginx X-Forwarded-*).
 */
export function resolveNewTelWebhookPublicBaseUrl(req: Request): string {
  const candidates = [
    trimBase(process.env.NEW_TEL_WEBHOOK_PUBLIC_BASE_URL),
    trimBase(process.env.PUBLIC_APP_URL),
    trimBase(process.env.BASE_URL),
    trimBase(process.env.PING_INVITE_APP_URL),
  ].filter(Boolean);

  for (const c of candidates) {
    if (!isLocalUrl(c)) return c;
  }

  const host = String(req.get("x-forwarded-host") || req.get("host") || "")
    .split(",")[0]
    .trim();
  const proto = (
    String(req.get("x-forwarded-proto") || req.protocol || "https").split(",")[0].trim() || "https"
  ).replace(/:$/, "");
  const requestBase = host ? `${proto}://${host}`.replace(/\/+$/, "") : "";

  if (requestBase && !isLocalUrl(requestBase)) return requestBase;

  for (const c of candidates) {
    if (c) return c;
  }

  throw new Error(
    "Для подтверждения звонком задайте NEW_TEL_WEBHOOK_PUBLIC_BASE_URL или PUBLIC_APP_URL (https://ваш-домен) — иначе New-Tel не дойдёт до вебхука.",
  );
}
