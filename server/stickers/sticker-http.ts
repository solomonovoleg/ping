import type { Response } from "express";
import { StickerPackError } from "./sticker-pack-error";

export function sendStickerPackHttpError(res: Response, err: unknown): boolean {
  if (err instanceof StickerPackError) {
    res.status(err.status).json({ message: err.message });
    return true;
  }
  return false;
}
