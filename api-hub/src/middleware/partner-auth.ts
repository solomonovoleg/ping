import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../lib/http-error.js";
import { store } from "../store/in-memory-store.js";
import { getPool } from "../infra/db/pool.js";
import * as repo from "../infra/db/repository.js";

declare module "express-serve-static-core" {
  interface Request {
    partnerId?: string;
  }
}

export function partnerAuth(req: Request, _res: Response, next: NextFunction): void {
  void (async () => {
    const apiKey = req.headers["x-partner-api-key"]?.toString();
    if (!apiKey) throw new HttpError(401, "missing_partner_api_key", "Missing x-partner-api-key header");

    if (getPool()) {
      const fromDb = await repo.findPartnerByApiKey(apiKey);
      if (fromDb) {
        store.partners.set(fromDb.id, fromDb);
        req.partnerId = fromDb.id;
        next();
        return;
      }
    }

    const partner = Array.from(store.partners.values()).find((item) => item.apiKey === apiKey);
    if (!partner) throw new HttpError(401, "invalid_partner_api_key", "Invalid partner API key");
    req.partnerId = partner.id;
    next();
  })().catch(next);
}
