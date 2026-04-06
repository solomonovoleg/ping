import { config } from "../config.js";

export class PlatformPmIssueError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = "PlatformPmIssueError";
    this.statusCode = statusCode;
  }
}

const PLATFORM_USER_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isPlatformUserUuid(id: string): boolean {
  return PLATFORM_USER_UUID_RE.test(id.trim());
}

/**
 * Запрашивает у основной платформы Bearer `pm.*` для пользователя (internal + PRIME).
 */
export async function fetchPlatformPmBearer(userId: string): Promise<string> {
  const base = config.platformBaseUrl?.trim();
  const secret = config.hubServiceSecret?.trim();
  if (!base || !secret) {
    throw new PlatformPmIssueError(503, "platform_pm_exchange_not_configured");
  }
  const origin = base.replace(/\/$/, "");
  let res: Response;
  try {
    res = await fetch(`${origin}/internal/api-hub/issue-user-bearer`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ userId }),
    });
  } catch (e) {
    throw new PlatformPmIssueError(502, e instanceof Error ? e.message : "fetch_failed");
  }
  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = {};
  }
  const msg =
    body && typeof body === "object" && "message" in body && typeof (body as { message?: unknown }).message === "string"
      ? (body as { message: string }).message
      : text.slice(0, 200);
  if (!res.ok) {
    throw new PlatformPmIssueError(res.status, msg || `HTTP ${res.status}`);
  }
  const token =
    body && typeof body === "object" && "token" in body ? (body as { token?: unknown }).token : undefined;
  if (typeof token !== "string" || !token.startsWith("pm.")) {
    throw new PlatformPmIssueError(502, "platform_pm_issue_invalid_response");
  }
  return token;
}

export function isPlatformPmExchangeConfigured(): boolean {
  return Boolean(config.platformBaseUrl?.trim() && config.hubServiceSecret?.trim());
}
