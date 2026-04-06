import type { Scope } from "../config.js";

export type OauthTransientPayload = {
  verifier: string;
  partnerId: string;
  externalUserId?: string;
  loginCallbackUrl?: string;
  redirectUrl?: string;
  scopes: Scope[];
};

const memory = new Map<string, { payload: OauthTransientPayload; expiresAt: number }>();
const TTL_MS = 600 * 1000;

/** In-memory OAuth state/PKCE (single-instance or sticky LB). See docs/SCALING.md. */
export async function saveOauthTransient(state: string, payload: OauthTransientPayload): Promise<void> {
  memory.set(state, { payload, expiresAt: Date.now() + TTL_MS });
}

export async function takeOauthTransient(state: string): Promise<OauthTransientPayload | null> {
  const row = memory.get(state);
  memory.delete(state);
  if (!row || row.expiresAt < Date.now()) return null;
  return row.payload;
}

export function sweepOauthMemory(): void {
  const now = Date.now();
  for (const [k, v] of memory.entries()) {
    if (v.expiresAt < now) memory.delete(k);
  }
}
