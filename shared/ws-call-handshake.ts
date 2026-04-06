/**
 * WebSocket auth for /calls and /group-calls.
 * Prefer token in Sec-WebSocket-Protocol (not in URL) — avoids default access_log query strings and Referer leaks.
 */

export const CALL_WS_SUBPROTOCOL = "ping.call.v1";

/** Исторически: только `randomBytes(24).toString("hex")` (48 символов). */
export const CALL_WS_TOKEN_HEX_LEN_LEGACY = 48;
/** Текущий `server/calls/token.ts`: 48 hex + UUID без дефисов (32 hex) = 80. */
export const CALL_WS_TOKEN_HEX_LEN = 80;

export type ResolvedCallHandshake = { kind: "subprotocol" | "legacy"; token: string };

function isHexSessionToken(s: string): boolean {
  if (!/^[a-f0-9]+$/.test(s)) return false;
  const len = s.length;
  return len === CALL_WS_TOKEN_HEX_LEN_LEGACY || len === CALL_WS_TOKEN_HEX_LEN;
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
