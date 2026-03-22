import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../db";
import { storage } from "../storage";
import { resolveProfileTarget } from "../users/service";
import {
  posts,
  stories,
  postViews,
  storyViews,
  storyLikes,
  profilePinFolders,
  profilePinItems,
} from "@shared/schema";

export class ProfilePinsError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const NAME_MAX = 80;
const DESC_MAX = 500;

function sumReactionsCounts(reactions: unknown): number {
  if (!Array.isArray(reactions)) return 0;
  let s = 0;
  for (const r of reactions) {
    if (r && typeof r === "object" && "count" in r) {
      const n = Number((r as { count?: unknown }).count);
      if (Number.isFinite(n)) s += n;
    }
  }
  return s;
}

function firstPostMediaUrl(p: { imageUrl: string | null; mediaUrls: unknown }): string | null {
  const urls = p.mediaUrls;
  if (Array.isArray(urls) && urls.length > 0 && typeof urls[0] === "string") return urls[0];
  return p.imageUrl ?? null;
}

async function assertNotBlocked(a: string, b: string): Promise<void> {
  const ab = await storage.isBlocked(a, b);
  const ba = await storage.isBlocked(b, a);
  if (ab || ba) throw new ProfilePinsError(403, "Нет доступа");
}

/** URL после upload/post-media: локальный префикс или ключ posts/ в S3. */
function isAllowedProfilePinMediaUrl(url: string): boolean {
  const u = url.trim();
  if (!u || u.length > 2048) return false;
  if (u.startsWith("/uploads/posts/")) return true;
  try {
    return new URL(u).pathname.includes("/posts/");
  } catch {
    return false;
  }
}

function normalizePinProfileParam(raw: string): string {
  try {
    return decodeURIComponent(raw).trim().replace(/^@+/, "");
  } catch {
    return raw.trim().replace(/^@+/, "");
  }
}

export async function resolvePinsTargetUserId(viewerId: string, idParam: string): Promise<string> {
  const raw = normalizePinProfileParam(idParam);
  if (!raw) throw new ProfilePinsError(400, "ID не указан");
  if (raw.toLowerCase() === "me") return viewerId;
  const target = await resolveProfileTarget(raw);
  if (target.deletedAt || target.isBlocked) throw new ProfilePinsError(404, "Пользователь не найден");
  await assertNotBlocked(viewerId, target.id);
  return target.id;
}

async function assertFolderOwner(userId: string, folderId: string) {
  const db = getDb();
  const [row] = await db
    .select({ id: profilePinFolders.id })
    .from(profilePinFolders)
    .where(and(eq(profilePinFolders.id, folderId), eq(profilePinFolders.ownerUserId, userId)))
    .limit(1);
  if (!row) throw new ProfilePinsError(404, "Папка не найдена");
}

export async function listPinFolders(viewerId: string, profileIdParam: string) {
  const ownerId = await resolvePinsTargetUserId(viewerId, profileIdParam);
  const db = getDb();
  const folders = await db
    .select()
    .from(profilePinFolders)
    .where(eq(profilePinFolders.ownerUserId, ownerId))
    .orderBy(asc(profilePinFolders.sortOrder), asc(profilePinFolders.createdAt));

  if (folders.length === 0) {
    return { folders: [] as ReturnType<typeof mapFolderSummary>[] };
  }

  const folderIds = folders.map((f) => f.id);
  const items = await db
    .select()
    .from(profilePinItems)
    .where(inArray(profilePinItems.folderId, folderIds))
    .orderBy(desc(profilePinItems.createdAt));

  const latestByFolder = new Map<string, (typeof items)[0]>();
  for (const it of items) {
    if (!latestByFolder.has(it.folderId)) latestByFolder.set(it.folderId, it);
  }

  const postIds = [...new Set(items.map((i) => i.postId).filter(Boolean) as string[])];
  const storyIds = [...new Set(items.map((i) => i.storyId).filter(Boolean) as string[])];

  const postRows =
    postIds.length > 0
      ? await db
          .select({
            id: posts.id,
            imageUrl: posts.imageUrl,
            mediaUrls: posts.mediaUrls,
          })
          .from(posts)
          .where(inArray(posts.id, postIds))
      : [];
  const postMap = new Map(postRows.map((p) => [p.id, p]));

  const storyRows =
    storyIds.length > 0
      ? await db
          .select({
            id: stories.id,
            mediaUrl: stories.mediaUrl,
            thumbnailUrl: stories.thumbnailUrl,
          })
          .from(stories)
          .where(inArray(stories.id, storyIds))
      : [];
  const storyMap = new Map(storyRows.map((s) => [s.id, s]));

  function previewForItem(it: (typeof items)[0]): { url: string | null; isVideo: boolean } {
    if (it.kind === "post" && it.postId) {
      const p = postMap.get(it.postId);
      if (!p) return { url: null, isVideo: false };
      const url = firstPostMediaUrl(p);
      const v = url ? /\.(mp4|webm|mov)(\?|$)/i.test(url) : false;
      return { url, isVideo: v };
    }
    if (it.kind === "story" && it.storyId) {
      const s = storyMap.get(it.storyId);
      if (!s) return { url: null, isVideo: false };
      const url = s.thumbnailUrl ?? s.mediaUrl;
      const v = /\.(mp4|webm|mov)(\?|$)/i.test(s.mediaUrl) || /\.(mp4|webm|mov)(\?|$)/i.test(url);
      return { url, isVideo: v };
    }
    if (it.kind === "media" && it.mediaUrl) {
      const url = it.mediaUrl.trim();
      const v =
        it.mediaIsVideo === true || /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);
      return { url, isVideo: v };
    }
    return { url: null, isVideo: false };
  }

  function mapFolderSummary(f: (typeof folders)[0]) {
    const last = latestByFolder.get(f.id);
    const fallback = last ? previewForItem(last) : { url: null, isVideo: false };
    const coverUrl = f.coverUrl?.trim() || null;
    const useCover = !!coverUrl;
    const itemCount = items.filter((i) => i.folderId === f.id).length;
    return {
      id: f.id,
      name: f.name,
      description: f.description ?? null,
      coverUrl,
      coverIsVideo: useCover ? f.coverIsVideo === true : fallback.isVideo,
      fallbackPreviewUrl: useCover ? null : fallback.url,
      fallbackIsVideo: useCover ? false : fallback.isVideo,
      displayPreviewUrl: useCover ? coverUrl : fallback.url,
      displayIsVideo: useCover ? f.coverIsVideo === true : fallback.isVideo,
      itemCount,
    };
  }

  return { folders: folders.map(mapFolderSummary) };
}

async function countPostViews(postId: string): Promise<number> {
  const db = getDb();
  const [r] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(postViews)
    .where(eq(postViews.postId, postId));
  return r?.c ?? 0;
}

async function countStoryViews(storyId: string): Promise<number> {
  const db = getDb();
  const [r] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(storyViews)
    .where(eq(storyViews.storyId, storyId));
  return r?.c ?? 0;
}

async function countStoryLikes(storyId: string): Promise<number> {
  const db = getDb();
  const [r] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(storyLikes)
    .where(eq(storyLikes.storyId, storyId));
  return r?.c ?? 0;
}

export async function getPinFolderDetail(viewerId: string, folderId: string) {
  const db = getDb();
  const [folder] = await db.select().from(profilePinFolders).where(eq(profilePinFolders.id, folderId)).limit(1);
  if (!folder) throw new ProfilePinsError(404, "Папка не найдена");
  await assertNotBlocked(viewerId, folder.ownerUserId);

  const rows = await db
    .select()
    .from(profilePinItems)
    .where(eq(profilePinItems.folderId, folderId))
    .orderBy(asc(profilePinItems.createdAt));

  const postIds = rows.map((r) => r.postId).filter(Boolean) as string[];
  const storyIds = rows.map((r) => r.storyId).filter(Boolean) as string[];

  const postRows =
    postIds.length > 0
      ? await db
          .select()
          .from(posts)
          .where(inArray(posts.id, postIds))
      : [];
  const postMap = new Map(postRows.map((p) => [p.id, p]));

  const storyRows =
    storyIds.length > 0
      ? await db
          .select()
          .from(stories)
          .where(inArray(stories.id, storyIds))
      : [];
  const storyMap = new Map(storyRows.map((s) => [s.id, s]));

  const items = await Promise.all(
    rows.map(async (it) => {
      if (it.kind === "post" && it.postId) {
        const p = postMap.get(it.postId);
        if (!p) return null;
        const url = firstPostMediaUrl(p);
        const viewsCount = await countPostViews(it.postId);
        const likesCount = sumReactionsCounts(p.reactions);
        return {
          id: it.id,
          kind: "post" as const,
          refId: it.postId,
          createdAt: it.createdAt.toISOString(),
          previewUrl: url,
          isVideo: url ? /\.(mp4|webm|mov)(\?|$)/i.test(url) : false,
          viewsCount,
          likesCount,
          text: p.text?.slice(0, 200) ?? "",
        };
      }
      if (it.kind === "story" && it.storyId) {
        const s = storyMap.get(it.storyId);
        if (!s) return null;
        const url = s.thumbnailUrl ?? s.mediaUrl;
        const viewsCount = await countStoryViews(it.storyId);
        const likesCount = await countStoryLikes(it.storyId);
        const isVideo = /\.(mp4|webm|mov)(\?|$)/i.test(s.mediaUrl);
        return {
          id: it.id,
          kind: "story" as const,
          refId: it.storyId,
          createdAt: it.createdAt.toISOString(),
          previewUrl: url,
          isVideo,
          viewsCount,
          likesCount,
          text: "",
        };
      }
      if (it.kind === "media" && it.mediaUrl) {
        const url = it.mediaUrl.trim();
        const isVideo =
          it.mediaIsVideo === true || /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);
        return {
          id: it.id,
          kind: "media" as const,
          refId: it.id,
          createdAt: it.createdAt.toISOString(),
          previewUrl: url,
          isVideo,
          viewsCount: 0,
          likesCount: 0,
          text: "",
        };
      }
      return null;
    })
  );

  return {
    folder: {
      id: folder.id,
      name: folder.name,
      description: folder.description ?? null,
      coverUrl: folder.coverUrl ?? null,
      coverIsVideo: folder.coverIsVideo === true,
      ownerUserId: folder.ownerUserId,
    },
    items: items.filter(Boolean),
  };
}

export async function createPinFolder(userId: string, body: Record<string, unknown>) {
  const name = typeof body.name === "string" ? body.name.trim().slice(0, NAME_MAX) : "";
  if (!name) throw new ProfilePinsError(400, "Укажите название папки");
  let description: string | null =
    typeof body.description === "string" ? body.description.trim().slice(0, DESC_MAX) : null;
  if (description === "") description = null;

  const db = getDb();
  const [row] = await db
    .insert(profilePinFolders)
    .values({
      ownerUserId: userId,
      name,
      description,
    })
    .returning();
  return row;
}

export async function updatePinFolder(userId: string, folderId: string, body: Record<string, unknown>) {
  await assertFolderOwner(userId, folderId);
  const db = getDb();
  const cleanPatch: Partial<typeof profilePinFolders.$inferInsert> = {};
  if (typeof body.name === "string") {
    const name = body.name.trim().slice(0, NAME_MAX);
    if (!name) throw new ProfilePinsError(400, "Название не может быть пустым");
    cleanPatch.name = name;
  }
  if (body.description !== undefined) {
    if (body.description === null) cleanPatch.description = null;
    else if (typeof body.description === "string") {
      const d = body.description.trim().slice(0, DESC_MAX);
      cleanPatch.description = d.length ? d : null;
    }
  }
  if (body.coverUrl !== undefined) {
    if (body.coverUrl === null || body.coverUrl === "") {
      cleanPatch.coverUrl = null;
      cleanPatch.coverIsVideo = false;
    } else if (typeof body.coverUrl === "string") {
      const u = body.coverUrl.trim();
      cleanPatch.coverUrl = u || null;
      if (!cleanPatch.coverUrl) cleanPatch.coverIsVideo = false;
      else {
        cleanPatch.coverIsVideo =
          typeof body.coverIsVideo === "boolean"
            ? body.coverIsVideo
            : /\.(mp4|webm|mov)(\?|$)/i.test(u);
      }
    }
  } else if (typeof body.coverIsVideo === "boolean") {
    cleanPatch.coverIsVideo = body.coverIsVideo;
  }

  if (Object.keys(cleanPatch).length === 0) {
    const [cur] = await db.select().from(profilePinFolders).where(eq(profilePinFolders.id, folderId)).limit(1);
    return cur;
  }
  const [row] = await db
    .update(profilePinFolders)
    .set(cleanPatch)
    .where(eq(profilePinFolders.id, folderId))
    .returning();
  return row;
}

export async function deletePinFolder(userId: string, folderId: string) {
  await assertFolderOwner(userId, folderId);
  const db = getDb();
  await db.delete(profilePinFolders).where(eq(profilePinFolders.id, folderId));
}

export async function addPinItem(userId: string, folderId: string, body: Record<string, unknown>) {
  await assertFolderOwner(userId, folderId);
  const kindRaw = body.kind;
  const kind =
    kindRaw === "story"
      ? "story"
      : kindRaw === "post"
        ? "post"
        : kindRaw === "media"
          ? "media"
          : "";

  const db = getDb();

  if (kind === "media") {
    const mediaUrl = typeof body.mediaUrl === "string" ? body.mediaUrl.trim() : "";
    if (!mediaUrl) throw new ProfilePinsError(400, "Укажите mediaUrl");
    if (!isAllowedProfilePinMediaUrl(mediaUrl)) throw new ProfilePinsError(400, "Недопустимый URL медиа");
    const mediaIsVideo = body.mediaIsVideo === true;
    const [row] = await db
      .insert(profilePinItems)
      .values({
        folderId,
        ownerUserId: userId,
        kind: "media",
        postId: null,
        storyId: null,
        mediaUrl,
        mediaIsVideo,
      })
      .returning();
    return row;
  }

  if (kind !== "post" && kind !== "story") throw new ProfilePinsError(400, "kind: post, story или media");
  const refId = typeof body.refId === "string" ? body.refId.trim() : "";
  if (!refId) throw new ProfilePinsError(400, "Укажите refId");

  if (kind === "post") {
    const [p] = await db.select().from(posts).where(eq(posts.id, refId)).limit(1);
    if (!p || p.authorId !== userId) throw new ProfilePinsError(403, "Это не ваш пост");
    if (p.isDraft) throw new ProfilePinsError(400, "Черновик нельзя закрепить");
    const [exists] = await db
      .select({ id: profilePinItems.id })
      .from(profilePinItems)
      .where(
        and(eq(profilePinItems.folderId, folderId), eq(profilePinItems.postId, refId))
      )
      .limit(1);
    if (exists) throw new ProfilePinsError(409, "Уже в этой папке");
    const [row] = await db
      .insert(profilePinItems)
      .values({
        folderId,
        ownerUserId: userId,
        kind: "post",
        postId: refId,
        storyId: null,
        mediaUrl: null,
        mediaIsVideo: false,
      })
      .returning();
    return row;
  }

  const [s] = await db.select().from(stories).where(eq(stories.id, refId)).limit(1);
  if (!s || s.authorId !== userId) throw new ProfilePinsError(403, "Это не ваше сториз");
  const [exists] = await db
    .select({ id: profilePinItems.id })
    .from(profilePinItems)
    .where(and(eq(profilePinItems.folderId, folderId), eq(profilePinItems.storyId, refId)))
    .limit(1);
  if (exists) throw new ProfilePinsError(409, "Уже в этой папке");
  const [row] = await db
    .insert(profilePinItems)
    .values({
      folderId,
      ownerUserId: userId,
      kind: "story",
      postId: null,
      storyId: refId,
      mediaUrl: null,
      mediaIsVideo: false,
    })
    .returning();
  return row;
}

export async function deletePinItem(userId: string, itemId: string) {
  const db = getDb();
  const [it] = await db.select().from(profilePinItems).where(eq(profilePinItems.id, itemId)).limit(1);
  if (!it) throw new ProfilePinsError(404, "Элемент не найден");
  if (it.ownerUserId !== userId) throw new ProfilePinsError(403, "Нет доступа");
  await db.delete(profilePinItems).where(eq(profilePinItems.id, itemId));
}
