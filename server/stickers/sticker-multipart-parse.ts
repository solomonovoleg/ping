import { StickerPackError } from "./sticker-pack-error";
import { STICKER_MAX_TITLE_LEN } from "./sticker-constants";

export function parseStickerPackVisibility(raw: unknown): "private" | "public" {
  if (raw === "public") return "public";
  return "private";
}

export function parseStickerPackTitle(raw: unknown): string {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s) throw new StickerPackError(400, "Укажите название набора");
  if (s.length > STICKER_MAX_TITLE_LEN) {
    throw new StickerPackError(400, `Название не длиннее ${STICKER_MAX_TITLE_LEN} символов`);
  }
  return s;
}
