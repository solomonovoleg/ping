import type { Express, Request, Response } from "express";
import { getUserId, requireAuth } from "../auth/session";
import { noStorePrivateJson } from "../middleware/no-store-private-json";
import { packDetailJson, packRowToListJson, packRowToPublicSearchJson, stickerRowToJson } from "./sticker-dto";
import {
  getPublicPackOrOwnedWithStickers,
  listPacksWithStickersForUser,
  searchPublicPacks,
} from "./repo";

export function attachStickerReadRoutes(app: Express): void {
  app.get("/api/sticker-packs/mine", noStorePrivateJson, requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    try {
      const rows = await listPacksWithStickersForUser(userId);
      res.json({
        packs: rows.map(({ pack, stickers: st }) => packRowToListJson(pack, st)),
      });
    } catch (err) {
      console.error("[stickers] GET mine failed", err);
      res.status(500).json({ message: "Не удалось загрузить наборы" });
    }
  });

  app.get("/api/sticker-packs/public", noStorePrivateJson, requireAuth, async (req: Request, res: Response) => {
    const q = typeof req.query.q === "string" ? req.query.q : "";
    const limitRaw = Number.parseInt(String(req.query.limit ?? "20"), 10);
    const limit = Number.isFinite(limitRaw) ? limitRaw : 20;
    try {
      const rows = await searchPublicPacks(q, limit);
      res.json({ packs: rows.map(packRowToPublicSearchJson) });
    } catch (err) {
      console.error("[stickers] GET public failed", err);
      res.status(500).json({ message: "Не удалось выполнить поиск" });
    }
  });

  app.get("/api/sticker-packs/:packId", noStorePrivateJson, requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const packId = String(req.params.packId || "").trim();
    if (!packId) {
      res.status(400).json({ message: "packId required" });
      return;
    }
    try {
      const data = await getPublicPackOrOwnedWithStickers(packId, userId);
      if (!data) {
        res.status(404).json({ message: "Набор не найден" });
        return;
      }
      res.json({
        pack: packDetailJson(data.pack),
        stickers: data.stickers.map(stickerRowToJson),
      });
    } catch (err) {
      console.error("[stickers] GET pack failed", err);
      res.status(500).json({ message: "Не удалось загрузить набор" });
    }
  });
}
