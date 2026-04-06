import type { StickerPackRow, StickerRow } from "@shared/schema";

export function stickerRowToJson(s: StickerRow) {
  return { id: s.id, imageUrl: s.imageUrl, sortOrder: s.sortOrder };
}

export function packRowToListJson(pack: StickerPackRow, stickers: StickerRow[]) {
  return {
    id: pack.id,
    title: pack.title,
    visibility: pack.visibility,
    createdAt: pack.createdAt.toISOString(),
    stickers: stickers.map(stickerRowToJson),
  };
}

export function packRowToPublicSearchJson(pack: { id: string; title: string; userId: string; createdAt: Date }) {
  return {
    id: pack.id,
    title: pack.title,
    ownerUserId: pack.userId,
    createdAt: pack.createdAt.toISOString(),
  };
}

export function packDetailJson(pack: StickerPackRow) {
  return {
    id: pack.id,
    title: pack.title,
    visibility: pack.visibility,
    ownerUserId: pack.userId,
    createdAt: pack.createdAt.toISOString(),
  };
}
