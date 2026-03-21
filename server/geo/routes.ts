import type { Express, Request, Response } from "express";
import { requireAuth } from "../auth/session";
import { fetchCitySuggestions } from "./city-suggest";

export function registerGeoRoutes(app: Express): void {
  app.get("/api/geo/city-suggest", requireAuth, async (req: Request, res: Response) => {
    const q = typeof req.query.q === "string" ? req.query.q : "";
    try {
      const suggestions = await fetchCitySuggestions(q);
      res.setHeader("Cache-Control", "private, max-age=120");
      res.json({ suggestions });
    } catch {
      res.json({ suggestions: [] });
    }
  });
}
