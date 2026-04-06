import { fetchOidcMetadata } from "./oidc-discovery.js";
import type { Scope } from "../config.js";

export async function buildPingAuthorizationUrl(params: {
  issuer: string;
  clientId: string;
  redirectUri: string;
  scope: string;
  state: string;
  codeChallenge: string;
}): Promise<string> {
  const meta = await fetchOidcMetadata(params.issuer);
  const u = new URL(meta.authorization_endpoint);
  u.searchParams.set("client_id", params.clientId);
  u.searchParams.set("redirect_uri", params.redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", params.scope);
  u.searchParams.set("state", params.state);
  u.searchParams.set("code_challenge", params.codeChallenge);
  u.searchParams.set("code_challenge_method", "S256");
  return u.toString();
}

export async function exchangeAuthorizationCode(params: {
  issuer: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
  codeVerifier: string;
}): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  id_token?: string;
  scope?: string;
}> {
  const meta = await fetchOidcMetadata(params.issuer);
  const body = new URLSearchParams();
  body.set("grant_type", "authorization_code");
  body.set("code", params.code);
  body.set("redirect_uri", params.redirectUri);
  body.set("client_id", params.clientId);
  if (params.clientSecret) body.set("client_secret", params.clientSecret);
  body.set("code_verifier", params.codeVerifier);
  const res = await fetch(meta.token_endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
    },
    body,
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Token exchange failed ${res.status}: ${t.slice(0, 500)}`);
  }
  return (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    id_token?: string;
    scope?: string;
  };
}

export async function exchangePingRefreshToken(params: {
  issuer: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
}> {
  const meta = await fetchOidcMetadata(params.issuer);
  const body = new URLSearchParams();
  body.set("grant_type", "refresh_token");
  body.set("refresh_token", params.refreshToken);
  body.set("client_id", params.clientId);
  if (params.clientSecret) body.set("client_secret", params.clientSecret);
  const res = await fetch(meta.token_endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
    },
    body,
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Refresh token failed ${res.status}: ${t.slice(0, 500)}`);
  }
  return (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };
}

/** Decode `sub` from id_token payload (signature verification should be added for production hardening). */
export function decodeIdTokenSub(idToken: string): string {
  const parts = idToken.split(".");
  if (parts.length < 2) throw new Error("Invalid id_token");
  const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as { sub?: string };
  if (!payload.sub) throw new Error("id_token missing sub");
  return String(payload.sub);
}

export function parseScopeList(scope: string | undefined, fallback: Scope[]): Scope[] {
  if (!scope) return fallback;
  const allowed = new Set<Scope>(["profile.read", "chat.read", "chat.write", "presence.write"]);
  const out: Scope[] = [];
  for (const p of scope.split(/\s+/)) {
    if (allowed.has(p as Scope)) out.push(p as Scope);
  }
  return out.length ? out : fallback;
}
