/**
 * WebSocket auth for /calls and /group-calls.
 * Prefer token in Sec-WebSocket-Protocol (not in URL) — avoids default access_log query strings and Referer leaks.
 */

export const CALL_WS_SUBPROTOCOL = "ping.call.v1";

/** Matches server/calls/token.ts randomToken (24 bytes → 48 hex chars). */
export const CALL_WS_TOKEN_HEX_LEN = 48;

export type ResolvedCallHandshake = { kind: "subprotocol" | "legacy"; token: string };

function isHexSessionToken(s: string): boolean {
  return s.length === CALL_WS_TOKEN_HEX_LEN && /^[a-f0-9]+$/.test(s);
}

/**
 * Resolves the call WS token from the handshake.
 * - Legacy: no Sec-WebSocket-Protocol → `?token=` only.
 * - Preferred: header includes `CALL_WS_SUBPROTOCOL` and exactly one hex token.
 * If the client sent any subprotocol but not our pair, query token is ignored (reject).
 */
export function resolveCallHandshakeToken(
  secWebSocketProtocol: string | string[] | undefined,
  queryToken: string | null,
): ResolvedCallHandshake | null {
  const headerRaw = Array.isArray(secWebSocketProtocol)
    ? secWebSocketProtocol.join(",")
    : secWebSocketProtocol;
  const header = headerRaw?.trim() ?? "";
  if (!header) {
    if (queryToken && isHexSessionToken(queryToken)) return { kind: "legacy", token: queryToken };
    return null;
  }
  const parts = header.split(",").map((p) => p.trim()).filter(Boolean);
  const hasMarker = parts.includes(CALL_WS_SUBPROTOCOL);
  const hexTokens = parts.filter(isHexSessionToken);
  if (hasMarker) {
    if (hexTokens.length === 1) return { kind: "subprotocol", token: hexTokens[0] };
    return null;
  }
  if (parts.length > 0) return null;
  return null;
}
