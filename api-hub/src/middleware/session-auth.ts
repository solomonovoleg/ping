import type { NextFunction, Request, Response } from "express";
import { config, type Scope } from "../config.js";
import { HttpError } from "../lib/http-error.js";
import { verifySessionToken } from "../security/token.js";
import type { SessionTokenPayload } from "../types.js";
import { loadHubSession } from "../services/hub-session.js";

declare module "express-serve-static-core" {
  interface Request {
    sessionAuth?: SessionTokenPayload;
  }
}

function parseBearer(value: string | undefined): string | null {
  if (!value) return null;
  const [type, token] = value.split(" ");
  if (type?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

export function requireSession(scopes?: Scope[]) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const token = parseBearer(req.headers.authorization?.toString());
    if (!token) throw new HttpError(401, "missing_bearer_token", "Missing bearer token");
    let payload: SessionTokenPayload;
    try {
      payload = verifySessionToken(token, config.jwtSecret);
    } catch (error) {
      throw new HttpError(401, "invalid_bearer_token", "Invalid bearer token", {
        reason: error instanceof Error ? error.message : "unknown",
      });
    }
    const session = await loadHubSession(payload.sessionId);
    if (!session || session.revokedAt) {
      throw new HttpError(401, "session_revoked", "Session is revoked");
    }
    if (scopes?.length) {
      const missing = scopes.filter((scope) => !payload.scopes.includes(scope));
      if (missing.length > 0) {
        throw new HttpError(403, "insufficient_scope", "Insufficient scopes", { missing });
      }
    }
    req.sessionAuth = payload;
    next();
  };
}
