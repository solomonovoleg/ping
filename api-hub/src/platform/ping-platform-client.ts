import { config } from "../config.js";

/**
 * Proxies to main PING platform using the user's PING access token (OIDC).
 * Expects `GET /api/auth/me` on the platform (see `server/auth/routes.ts`).
 */
export async function fetchPingAuthMe(pingAccessToken: string): Promise<Record<string, unknown> | null> {
  const raw = config.platformBaseUrl?.trim();
  if (!raw) return null;
  const base = raw.replace(/\/$/, "");
  const res = await fetch(`${base}/api/auth/me`, {
    headers: {
      authorization: `Bearer ${pingAccessToken}`,
      accept: "application/json",
    },
  });
  if (!res.ok) return null;
  return (await res.json()) as Record<string, unknown>;
}
