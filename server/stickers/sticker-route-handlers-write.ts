import type { Express, Request, Response } from "express";
import { getUserId, requireAuth } from "../auth/session";
import { noStorePrivateJson } from "../middleware/no-store-private-json";
import { packDetailJson, stickerRowToJson } from "./sticker-dto";
import { sendStickerPackHttpError } from "./sticker-http";
import { parseStickerPackTitle, parseStickerPackVisibility } from "./sticker-multipart-parse";
import { persistStickerBuffersToStorage, stickerFilesUploadMiddleware } from "./sticker-upload";
import {
  assertPackOwner,
  createPackWithStickerUrls,
  deletePack,
  deleteSticker,
  insertStickers,
  updatePack,
} from "./repo";

export function attachStickerWriteRoutes(app: Express): void {
  app.post(
    "/api/sticker-packs/create-with-stickers",
    noStorePrivateJson,
    requireAuth,
    stickerFilesUploadMiddleware(),
    async (req: Request, res: Response) => {
      const userId = getUserId(req)!;
      const files = req.files as Express.Multer.File[] | undefined;
      try {
        const title = parseStickerPackTitle(req.body?.title);
        const visibility = parseStickerPackVisibility(req.body?.visibility);
        if (!files?.length) {
          res.status(400).json({ message: "Прикрепите хотя бы одно изображение" });
          return;
        }
        const bufs = files.map((f) => f.buffer).filter(Boolean);
        const urls = await persistStickerBuffersToStorage(bufs);
        const { pack, stickers: st } = await createPackWithStickerUrls({
          userId,
          title,
          visibility,
          imageUrls: urls,
        });
        res.status(201).json({
          pack: {
            id: pack.id,
            title: pack.title,
            visibility: pack.visibility,
            createdAt: pack.createdAt.toISOString(),
          },
          stickers: st.map(stickerRowToJson),
        });
      } catch (err) {
        if (sendStickerPackHttpError(res, err)) return;
        console.error("[stickers] create-with-stickers failed", err);
        res.status(500).json({ message: "Не удалось создать набор" });
      }
    },
  );

  app.post(
    "/api/sticker-packs/:packId/stickers",
    noStorePrivateJson,
    requireAuth,
    stickerFilesUploadMiddleware(),
    async (req: Request, res: Response) => {
      const userId = getUserId(req)!;
      const packId = String(req.params.packId || "").trim();
      const files = req.files as Express.Multer.File[] | undefined;
      try {
        await assertPackOwner(packId, userId);
        if (!files?.length) {
          res.status(400).json({ message: "Прикрепите хотя бы одно изображение" });
          return;
        }
        const bufs = files.map((f) => f.buffer).filter(Boolean);
        const urls = await persistStickerBuffersToStorage(bufs);
        const inserted = await insertStickers(packId, urls);
        res.status(201).json({ stickers: inserted.map(stickerRowToJson) });
      } catch (err) {
        if (sendStickerPackHttpError(res, err)) return;
        console.error("[stickers] add stickers failed", err);
        res.status(500).json({ message: "Не удалось добавить стикеры" });
      }
    },
  );

  app.patch("/api/sticker-packs/:packId", noStorePrivateJson, requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const packId = String(req.params.packId || "").trim();
    const body = req.body ?? {};
    try {
      const patch: { title?: string; visibility?: "private" | "public" } = {};
      if (typeof body.title === "string") patch.title = parseStickerPackTitle(body.title);
      if (body.visibility === "public" || body.visibility === "private") patch.visibility = body.visibility;
      const row = await updatePack(packId, userId, patch);
      if (!row) {
        res.status(404).json({ message: "Набор не найден" });
        return;
      }
      res.json({ pack: packDetailJson(row) });
    } catch (err) {
      if (sendStickerPackHttpError(res, err)) return;
      console.error("[stickers] PATCH pack failed", err);
      res.status(500).json({ message: "Не удалось обновить набор" });
    }
  });

  app.delete("/api/sticker-packs/:packId", noStorePrivateJson, requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const packId = String(req.params.packId || "").trim();
    try {
      await deletePack(packId, userId);
      res.status(204).end();
    } catch (err) {
      if (sendStickerPackHttpError(res, err)) return;
      console.error("[stickers] DELETE pack failed", err);
      res.status(500).json({ message: "Не удалось удалить набор" });
    }
  });

  app.delete("/api/stickers/:stickerId", noStorePrivateJson, requireAuth, async (req: Request, res: Response) => {
    const userId = getUserId(req)!;
    const stickerId = String(req.params.stickerId || "").trim();
    try {
      await deleteSticker(stickerId, userId);
      res.status(204).end();
    } catch (err) {
      if (sendStickerPackHttpError(res, err)) return;
      console.error("[stickers] DELETE sticker failed", err);
      res.status(500).json({ message: "Не удалось удалить стикер" });
    }
  });
}
