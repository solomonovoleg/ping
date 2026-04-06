import { createId } from "../lib/ids.js";
import type { Scope } from "../config.js";

interface TokenResult {
  accessToken: string;
  refreshToken: string;
  pingUserId: string;
  externalUserId?: string;
  loginCallbackUrl?: string;
  redirectUrl?: string;
  scopes: Scope[];
}

const codeMap = new Map<
  string,
  {
    pingUserId: string;
    externalUserId?: string;
    loginCallbackUrl?: string;
    redirectUrl?: string;
    scopes: Scope[];
  }
>();

export function issueAuthCode(input: {
  pingUserId: string;
  externalUserId?: string;
  loginCallbackUrl?: string;
  redirectUrl?: string;
  scopes: Scope[];
}): string {
  const code = `ping_code_${createId("code")}`;
  codeMap.set(code, input);
  return code;
}

export function exchangeCode(code: string): TokenResult {
  const payload = codeMap.get(code);
  if (!payload) {
    throw new Error("Invalid or expired code");
  }
  codeMap.delete(code);
  return {
    accessToken: `ping_access_${createId("at")}`,
    refreshToken: `ping_refresh_${createId("rt")}`,
    pingUserId: payload.pingUserId,
    externalUserId: payload.externalUserId,
    loginCallbackUrl: payload.loginCallbackUrl,
    redirectUrl: payload.redirectUrl,
    scopes: payload.scopes,
  };
}

export function exchangeRefreshToken(refreshToken: string): TokenResult {
  if (!refreshToken.startsWith("ping_refresh_")) {
    throw new Error("Invalid refresh token");
  }
  return {
    accessToken: `ping_access_${createId("at")}`,
    refreshToken: `ping_refresh_${createId("rt")}`,
    pingUserId: "ping_u_alex",
    scopes: ["profile.read", "chat.read", "chat.write", "presence.write"],
  };
}
