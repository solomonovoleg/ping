import type { Express } from "express";
import { attachStickerReadRoutes } from "./sticker-route-handlers-read";
import { attachStickerWriteRoutes } from "./sticker-route-handlers-write";
import { ensureStickerUploadPrepared } from "./sticker-upload";

/** Регистрирует все HTTP-маршруты домена стикеров (только вызов из `server/routes.ts`). */
export function registerStickerPackRoutes(app: Express): void {
  ensureStickerUploadPrepared();
  attachStickerReadRoutes(app);
  attachStickerWriteRoutes(app);
}
