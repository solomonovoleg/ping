import type { Express, Request, Response } from "express";
import { getFeedAlgoConfig, setFeedAlgoConfig, type FeedAlgoConfig, type FeedAlgoMode } from "../../feed/config";

const FEED_MODES: FeedAlgoMode[] = ["strict_chrono", "chrono_boost_v1"];

function clampNumber(value: unknown, min: number, max: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.min(max, Math.max(min, value));
}

export function registerAdminFeedRoutes(app: Express): void {
  app.get("/api/admin/feed-algorithm", (_req: Request, res: Response) => {
    res.json(getFeedAlgoConfig());
  });

  app.patch("/api/admin/feed-algorithm", (req: Request, res: Response) => {
    const body = (req.body ?? {}) as Partial<FeedAlgoConfig>;
    const patch: Partial<FeedAlgoConfig> = {};

    if (body.mode !== undefined) {
      if (!FEED_MODES.includes(body.mode)) {
        res.status(400).json({ message: "mode должен быть strict_chrono или chrono_boost_v1" });
        return;
      }
      patch.mode = body.mode;
    }

    const numericFields: Array<keyof FeedAlgoConfig> = [
      "boostWindowHours",
      "boostCapMinutes",
      "reactionBoostMinutes",
      "commentBoostMinutes",
      "shareBoostMinutes",
      "candidatePadding",
      "candidateMin",
      "candidateMax",
      "veryNewAccountHours",
      "newAccountHours",
      "veryNewAccountFactor",
      "newAccountFactor",
    ];

    for (const field of numericFields) {
      if (!(field in body)) continue;
      const isFactor = field === "veryNewAccountFactor" || field === "newAccountFactor";
      const value = clampNumber((body as Record<string, unknown>)[field], isFactor ? 0 : 0, isFactor ? 1 : 5000);
      if (value == null) {
        res.status(400).json({ message: `Поле ${field} должно быть числом` });
        return;
      }
      (patch as Record<string, number>)[field] = value;
    }

    const updated = setFeedAlgoConfig(patch);
    res.json(updated);
  });
}

