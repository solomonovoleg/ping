import { and, asc, desc, eq, ilike, inArray, sql } from "drizzle-orm";
import { getDb } from "../db";
import { stickerPacks, stickers } from "@shared/schema";
import { StickerPackError } from "./sticker-pack-error";

const MAX_PACKS_PER_USER = 40;
const MAX_STICKERS_PER_PACK = 120;

export { MAX_PACKS_PER_USER, MAX_STICKERS_PER_PACK };

export async function countUserPacks(userId: string): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(stickerPacks)
    .where(eq(stickerPacks.userId, userId));
  return row?.c ?? 0;
}

export async function countStickersInPack(packId: string): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(stickers)
    .where(eq(stickers.packId, packId));
  return row?.c ?? 0;
}

export async function createPack(input: { userId: string; title: string; visibility: "private" | "public" }) {
  const db = getDb();
  const n = await countUserPacks(input.userId);
  if (n >= MAX_PACKS_PER_USER) {
    throw new StickerPackError(400, `Не больше ${MAX_PACKS_PER_USER} наборов стикеров`);
  }
  const [row] = await db
    .insert(stickerPacks)
    .values({
      userId: input.userId,
      title: input.title.trim(),
      visibility: input.visibility,
    })
    .returning();
  return row;
}

export async function getPackById(packId: string) {
  const db = getDb();
  const [row] = await db.select().from(stickerPacks).where(eq(stickerPacks.id, packId)).limit(1);
  return row ?? null;
}

export async function assertPackOwner(packId: string, userId: string) {
  const pack = await getPackById(packId);
  if (!pack) throw new StickerPackError(404, "Набор не найден");
  if (pack.userId !== userId) throw new StickerPackError(403, "Нет доступа к набору");
  return pack;
}

export async function updatePack(
  packId: string,
  userId: string,
  patch: { title?: string; visibility?: "private" | "public" },
) {
  await assertPackOwner(packId, userId);
  const db = getDb();
  const set: Record<string, unknown> = {};
  if (typeof patch.title === "string") set.title = patch.title.trim();
  if (patch.visibility === "private" || patch.visibility === "public") set.visibility = patch.visibility;
  if (Object.keys(set).length === 0) return getPackById(packId);
  const [row] = await db.update(stickerPacks).set(set).where(eq(stickerPacks.id, packId)).returning();
  return row ?? null;
}

export async function deletePack(packId: string, userId: string) {
  await assertPackOwner(packId, userId);
  const db = getDb();
  await db.delete(stickerPacks).where(eq(stickerPacks.id, packId));
}

export async function listPacksWithStickersForUser(userId: string) {
  const db = getDb();
  const packs = await db
    .select()
    .from(stickerPacks)
    .where(eq(stickerPacks.userId, userId))
    .orderBy(desc(stickerPacks.createdAt));
  if (packs.length === 0) return [];
  const packIds = packs.map((p) => p.id);
  const allStickers = await db
    .select()
    .from(stickers)
    .where(inArray(stickers.packId, packIds))
    .orderBy(asc(stickers.sortOrder), asc(stickers.createdAt));
  const byPack = new Map<string, typeof allStickers>();
  for (const s of allStickers) {
    const list = byPack.get(s.packId) ?? [];
    list.push(s);
    byPack.set(s.packId, list);
  }
  return packs.map((p) => ({ pack: p, stickers: byPack.get(p.id) ?? [] }));
}

export async function searchPublicPacks(query: string, limit: number) {
  const q = query.trim();
  if (!q) return [];
  const db = getDb();
  const pattern = `%${q.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
  return db
    .select({
      id: stickerPacks.id,
      title: stickerPacks.title,
      userId: stickerPacks.userId,
      createdAt: stickerPacks.createdAt,
    })
    .from(stickerPacks)
    .where(and(eq(stickerPacks.visibility, "public"), ilike(stickerPacks.title, pattern)))
    .orderBy(desc(stickerPacks.createdAt))
    .limit(Math.min(Math.max(limit, 1), 50));
}

export async function getPublicPackOrOwnedWithStickers(packId: string, userId: string) {
  const pack = await getPackById(packId);
  if (!pack) return null;
  if (pack.visibility !== "public" && pack.userId !== userId) return null;
  const db = getDb();
  const st = await db
    .select()
    .from(stickers)
    .where(eq(stickers.packId, packId))
    .orderBy(asc(stickers.sortOrder), asc(stickers.createdAt));
  return { pack, stickers: st };
}

export async function insertStickers(packId: string, imageUrls: string[]) {
  if (imageUrls.length === 0) return [];
  const db = getDb();
  const current = await countStickersInPack(packId);
  if (current + imageUrls.length > MAX_STICKERS_PER_PACK) {
    throw new StickerPackError(400, `В наборе не больше ${MAX_STICKERS_PER_PACK} стикеров`);
  }
  const baseOrder = current;
  const rows = imageUrls.map((imageUrl, i) => ({
    packId,
    imageUrl,
    sortOrder: baseOrder + i,
  }));
  return db.insert(stickers).values(rows).returning();
}

export async function createPackWithStickerUrls(input: {
  userId: string;
  title: string;
  visibility: "private" | "public";
  imageUrls: string[];
}) {
  if (input.imageUrls.length === 0) {
    throw new StickerPackError(400, "Добавьте хотя бы один файл стикера");
  }
  if (input.imageUrls.length > MAX_STICKERS_PER_PACK) {
    throw new StickerPackError(400, `Не больше ${MAX_STICKERS_PER_PACK} стикеров за раз`);
  }
  const db = getDb();
  const n = await countUserPacks(input.userId);
  if (n >= MAX_PACKS_PER_USER) {
    throw new StickerPackError(400, `Не больше ${MAX_PACKS_PER_USER} наборов стикеров`);
  }
  return db.transaction(async (tx) => {
    const [pack] = await tx
      .insert(stickerPacks)
      .values({
        userId: input.userId,
        title: input.title.trim(),
        visibility: input.visibility,
      })
      .returning();
    if (!pack) throw new StickerPackError(500, "Не удалось создать набор");
    const rows = input.imageUrls.map((imageUrl, i) => ({
      packId: pack.id,
      imageUrl,
      sortOrder: i,
    }));
    const inserted = await tx.insert(stickers).values(rows).returning();
    return { pack, stickers: inserted };
  });
}

export async function deleteSticker(stickerId: string, userId: string) {
  const db = getDb();
  const [st] = await db.select().from(stickers).where(eq(stickers.id, stickerId)).limit(1);
  if (!st) throw new StickerPackError(404, "Стикер не найден");
  const pack = await getPackById(st.packId);
  if (!pack || pack.userId !== userId) throw new StickerPackError(403, "Нет доступа");
  await db.delete(stickers).where(eq(stickers.id, stickerId));
}

export async function getStickerForSendValidation(stickerId: string) {
  const db = getDb();
  const [st] = await db.select().from(stickers).where(eq(stickers.id, stickerId)).limit(1);
  if (!st) return null;
  const pack = await getPackById(st.packId);
  if (!pack) return null;
  return { sticker: st, pack };
}

/** Пользователь может отправить стикер, если набор его или набор публичный. */
export function canUserSendSticker(pack: { userId: string; visibility: string }, userId: string): boolean {
  if (pack.userId === userId) return true;
  return pack.visibility === "public";
}
