import { and, asc, count, desc, eq, inArray, isNull, lte, max, or } from "drizzle-orm";
import { z } from "zod";
import { ensureAdminMediaStudioSchema, getDb } from "../../db";
import { storage } from "../../storage";
import {
  adminMediaStudioCampaignPosts,
  adminMediaStudioCampaigns,
  posts as postsTable,
  users as usersTable,
} from "@shared/schema";
import type { AdminMediaStudioCampaign, AdminMediaStudioCampaignPost } from "@shared/schema";
import { createPost } from "../../posts/service";

const BATCH_PER_CAMPAIGN = 8;

async function ensureCampaignSchema(): Promise<void> {
  await ensureAdminMediaStudioSchema();
}

export function parseMediaUrlsJson(raw: unknown): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw
      .filter((x): x is string => typeof x === "string" && x.trim() !== "")
      .map((x) => x.trim())
      .slice(0, 10);
  }
  return [];
}

export const patchCampaignBodySchema = z
  .object({
    status: z.enum(["draft", "running", "paused", "cancelled"]).optional(),
    title: z.string().max(200).nullable().optional(),
  })
  .refine((d) => d.status !== undefined || d.title !== undefined, {
    message: "Укажите status и/или title",
  });

export const addCampaignPostBodySchema = z.object({
  authorUserId: z.string().min(1),
  bodyText: z.string().max(8000).optional().default(""),
  mediaUrls: z.array(z.string().min(1).max(2048)).max(10).optional().default([]),
  /** ISO 8601 или пусто — публикация сразу при запуске кампании (как только сработает воркер) */
  scheduledAt: z.string().max(64).nullable().optional(),
});

function assertCampaignAllowsNewPosts(status: string): void {
  if (status === "cancelled") throw new Error("Кампания отменена");
  if (status === "completed") throw new Error("Кампания завершена — переведите в черновик, чтобы добавлять посты");
}

function assertStatusTransition(from: string, to: string): void {
  if (from === to) return;
  if (to === "running" && (from === "draft" || from === "paused")) return;
  if (to === "paused" && from === "running") return;
  if (to === "cancelled" && (from === "draft" || from === "running" || from === "paused")) return;
  if (to === "draft" && (from === "completed" || from === "cancelled")) return;
  throw new Error(`Недопустимый переход статуса: ${from} → ${to}`);
}

async function verifyStudioAuthor(authorUserId: string): Promise<void> {
  const u = await storage.getUser(authorUserId);
  if (!u || u.isStudioSynthetic !== true) {
    throw new Error("Автор должен быть синтетическим пользователем медиа-студии");
  }
}

async function nextSortOrder(campaignId: string): Promise<number> {
  const db = getDb();
  const [agg] = await db
    .select({ m: max(adminMediaStudioCampaignPosts.sortOrder) })
    .from(adminMediaStudioCampaignPosts)
    .where(eq(adminMediaStudioCampaignPosts.campaignId, campaignId));
  return Number(agg?.m ?? -1) + 1;
}

export function campaignToJson(c: AdminMediaStudioCampaign) {
  return {
    id: c.id,
    createdByAdminId: c.createdByAdminId,
    title: c.title ?? null,
    status: c.status,
    scheduleMode: c.scheduleMode,
    scheduleIntervalSecondsMin: c.scheduleIntervalSecondsMin,
    scheduleIntervalSecondsMax: c.scheduleIntervalSecondsMax,
    shuffleSeed: c.shuffleSeed,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

export function campaignPostToJson(p: AdminMediaStudioCampaignPost) {
  return {
    id: p.id,
    campaignId: p.campaignId,
    sortOrder: p.sortOrder,
    authorUserId: p.authorUserId,
    bodyText: p.bodyText ?? "",
    mediaUrls: parseMediaUrlsJson(p.mediaUrls),
    scheduledAt: p.scheduledAt ? p.scheduledAt.toISOString() : null,
    publishedPostId: p.publishedPostId,
    state: p.state,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export type CampaignPostResponseJson = ReturnType<typeof campaignPostToJson> & {
  publishedPath: string | null;
};

/** Публичный путь к посту `/u/{publicId}/p/{linkCode}` для строки «Открыть» в админке. */
export async function enrichCampaignPosts(rows: AdminMediaStudioCampaignPost[]): Promise<CampaignPostResponseJson[]> {
  const pubIds = [...new Set(rows.map((r) => r.publishedPostId).filter(Boolean))] as string[];
  if (pubIds.length === 0) {
    return rows.map((r) => ({ ...campaignPostToJson(r), publishedPath: null }));
  }

  const db = getDb();
  const pr = await db
    .select({
      id: postsTable.id,
      linkCode: postsTable.linkCode,
      authorId: postsTable.authorId,
    })
    .from(postsTable)
    .where(inArray(postsTable.id, pubIds));

  const pathByPostId = new Map<string, string>();
  if (pr.length > 0) {
    const authorIds = [...new Set(pr.map((r) => r.authorId))];
    const usrs = await db
      .select({ id: usersTable.id, publicId: usersTable.publicId })
      .from(usersTable)
      .where(inArray(usersTable.id, authorIds));
    const pubByAuthor = new Map(usrs.map((u) => [u.id, u.publicId]));
    for (const r of pr) {
      const pid = pubByAuthor.get(r.authorId);
      if (pid == null) continue;
      const seg = (r.linkCode && String(r.linkCode).trim()) || r.id;
      pathByPostId.set(r.id, `/u/${encodeURIComponent(String(pid))}/p/${encodeURIComponent(seg)}`);
    }
  }

  return rows.map((r) => ({
    ...campaignPostToJson(r),
    publishedPath: r.publishedPostId ? pathByPostId.get(r.publishedPostId) ?? null : null,
  }));
}

export async function listMediaStudioCampaigns(): Promise<AdminMediaStudioCampaign[]> {
  await ensureCampaignSchema();
  const db = getDb();
  return db.select().from(adminMediaStudioCampaigns).orderBy(desc(adminMediaStudioCampaigns.createdAt));
}

/** Число элементов в очереди по кампаниям (для списка в админке). */
export async function countQueuedPostsByCampaignIds(campaignIds: string[]): Promise<Map<string, number>> {
  await ensureCampaignSchema();
  const map = new Map<string, number>();
  if (campaignIds.length === 0) return map;
  const db = getDb();
  const rows = await db
    .select({
      cid: adminMediaStudioCampaignPosts.campaignId,
      n: count(),
    })
    .from(adminMediaStudioCampaignPosts)
    .where(
      and(
        inArray(adminMediaStudioCampaignPosts.campaignId, campaignIds),
        eq(adminMediaStudioCampaignPosts.state, "queued"),
      ),
    )
    .groupBy(adminMediaStudioCampaignPosts.campaignId);
  for (const r of rows) {
    map.set(r.cid, Number(r.n));
  }
  return map;
}

export async function getMediaStudioCampaignById(id: string): Promise<AdminMediaStudioCampaign | null> {
  await ensureCampaignSchema();
  const db = getDb();
  const [row] = await db.select().from(adminMediaStudioCampaigns).where(eq(adminMediaStudioCampaigns.id, id));
  return row ?? null;
}

export async function listCampaignPosts(campaignId: string): Promise<AdminMediaStudioCampaignPost[]> {
  await ensureCampaignSchema();
  const db = getDb();
  return db
    .select()
    .from(adminMediaStudioCampaignPosts)
    .where(eq(adminMediaStudioCampaignPosts.campaignId, campaignId))
    .orderBy(asc(adminMediaStudioCampaignPosts.sortOrder), asc(adminMediaStudioCampaignPosts.createdAt));
}

export async function createMediaStudioCampaign(
  createdByAdminId: string,
  title: string | null = null,
): Promise<AdminMediaStudioCampaign> {
  await ensureCampaignSchema();
  const db = getDb();
  const trimmed = title?.trim() ? title.trim().slice(0, 200) : null;
  const [row] = await db
    .insert(adminMediaStudioCampaigns)
    .values({
      createdByAdminId,
      status: "draft",
      ...(trimmed ? { title: trimmed } : {}),
    })
    .returning();
  if (!row) throw new Error("Не удалось создать кампанию");
  return row;
}

export async function patchMediaStudioCampaign(
  campaignId: string,
  body: z.infer<typeof patchCampaignBodySchema>,
): Promise<AdminMediaStudioCampaign | null> {
  await ensureCampaignSchema();
  const db = getDb();
  const existing = await getMediaStudioCampaignById(campaignId);
  if (!existing) return null;
  if (body.status !== undefined) {
    assertStatusTransition(existing.status, body.status);
  }
  const now = new Date();
  const nextTitle =
    body.title === undefined
      ? undefined
      : body.title === null || body.title.trim() === ""
        ? null
        : body.title.trim().slice(0, 200);
  const [row] = await db
    .update(adminMediaStudioCampaigns)
    .set({
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(nextTitle !== undefined ? { title: nextTitle } : {}),
      updatedAt: now,
    })
    .where(eq(adminMediaStudioCampaigns.id, campaignId))
    .returning();
  return row ?? null;
}

export async function addMediaStudioCampaignPost(
  campaignId: string,
  body: z.infer<typeof addCampaignPostBodySchema>,
): Promise<AdminMediaStudioCampaignPost> {
  await ensureCampaignSchema();
  const db = getDb();
  const campaign = await getMediaStudioCampaignById(campaignId);
  if (!campaign) throw new Error("Кампания не найдена");
  assertCampaignAllowsNewPosts(campaign.status);
  await verifyStudioAuthor(body.authorUserId);

  let scheduledAt: Date | null = null;
  if (body.scheduledAt && String(body.scheduledAt).trim()) {
    const d = new Date(body.scheduledAt);
    if (Number.isNaN(d.getTime())) throw new Error("Некорректная дата scheduledAt");
    scheduledAt = d;
  }

  const text = body.bodyText?.trim() ?? "";
  const urls = body.mediaUrls ?? [];
  if (!text && urls.length === 0) {
    throw new Error("Нужен текст или хотя бы один URL медиа");
  }

  const sortOrder = await nextSortOrder(campaignId);
  const now = new Date();
  const [row] = await db
    .insert(adminMediaStudioCampaignPosts)
    .values({
      campaignId,
      sortOrder,
      authorUserId: body.authorUserId,
      bodyText: text || null,
      mediaUrls: urls,
      scheduledAt,
      state: "queued",
      updatedAt: now,
    })
    .returning();
  if (!row) throw new Error("Не удалось добавить пост в очередь");

  await db.update(adminMediaStudioCampaigns).set({ updatedAt: now }).where(eq(adminMediaStudioCampaigns.id, campaignId));

  return row;
}

export async function deleteMediaStudioCampaignPost(postId: string): Promise<boolean> {
  await ensureCampaignSchema();
  const db = getDb();
  const [existing] = await db.select().from(adminMediaStudioCampaignPosts).where(eq(adminMediaStudioCampaignPosts.id, postId));
  if (!existing || existing.state !== "queued") return false;
  await db.delete(adminMediaStudioCampaignPosts).where(eq(adminMediaStudioCampaignPosts.id, postId));
  await db
    .update(adminMediaStudioCampaigns)
    .set({ updatedAt: new Date() })
    .where(eq(adminMediaStudioCampaigns.id, existing.campaignId));
  return true;
}

async function countQueuedForCampaign(campaignId: string): Promise<number> {
  await ensureCampaignSchema();
  const db = getDb();
  const [r] = await db
    .select({ n: count() })
    .from(adminMediaStudioCampaignPosts)
    .where(
      and(eq(adminMediaStudioCampaignPosts.campaignId, campaignId), eq(adminMediaStudioCampaignPosts.state, "queued")),
    );
  return Number(r?.n ?? 0);
}

async function maybeMarkCampaignCompleted(campaignId: string): Promise<void> {
  await ensureCampaignSchema();
  const db = getDb();
  const campaign = await getMediaStudioCampaignById(campaignId);
  if (!campaign || campaign.status !== "running") return;
  const n = await countQueuedForCampaign(campaignId);
  if (n > 0) return;
  await db
    .update(adminMediaStudioCampaigns)
    .set({ status: "completed", updatedAt: new Date() })
    .where(eq(adminMediaStudioCampaigns.id, campaignId));
}

export async function processDuePostsForCampaign(
  campaignId: string,
  limit = BATCH_PER_CAMPAIGN,
): Promise<{ published: number; failed: number }> {
  await ensureCampaignSchema();
  const db = getDb();
  const campaign = await getMediaStudioCampaignById(campaignId);
  if (!campaign || campaign.status !== "running") {
    return { published: 0, failed: 0 };
  }

  const now = new Date();
  const rows = await db
    .select()
    .from(adminMediaStudioCampaignPosts)
    .where(
      and(
        eq(adminMediaStudioCampaignPosts.campaignId, campaignId),
        eq(adminMediaStudioCampaignPosts.state, "queued"),
        or(
          isNull(adminMediaStudioCampaignPosts.scheduledAt),
          lte(adminMediaStudioCampaignPosts.scheduledAt, now),
        ),
      ),
    )
    .orderBy(asc(adminMediaStudioCampaignPosts.sortOrder), asc(adminMediaStudioCampaignPosts.createdAt))
    .limit(limit);

  let published = 0;
  let failed = 0;

  for (const row of rows) {
    const tick = new Date();
    if (!row.authorUserId) {
      await db
        .update(adminMediaStudioCampaignPosts)
        .set({ state: "failed", updatedAt: tick })
        .where(eq(adminMediaStudioCampaignPosts.id, row.id));
      failed += 1;
      continue;
    }
    const u = await storage.getUser(row.authorUserId);
    if (!u || u.isStudioSynthetic !== true) {
      await db
        .update(adminMediaStudioCampaignPosts)
        .set({ state: "failed", updatedAt: tick })
        .where(eq(adminMediaStudioCampaignPosts.id, row.id));
      failed += 1;
      continue;
    }

    const urls = parseMediaUrlsJson(row.mediaUrls);
    const text = row.bodyText?.trim() ?? "";
    if (!text && urls.length === 0) {
      await db
        .update(adminMediaStudioCampaignPosts)
        .set({ state: "failed", updatedAt: tick })
        .where(eq(adminMediaStudioCampaignPosts.id, row.id));
      failed += 1;
      continue;
    }

    try {
      const first = urls.length ? urls[0] : null;
      const post = await createPost({
        userId: row.authorUserId,
        text,
        imageUrl: first,
        mediaUrls: urls.length ? urls : null,
        mediaLayout: null,
        isDraft: false,
        visibility: "public",
      });
      await db
        .update(adminMediaStudioCampaignPosts)
        .set({ state: "published", publishedPostId: post.id, updatedAt: new Date() })
        .where(eq(adminMediaStudioCampaignPosts.id, row.id));
      published += 1;
    } catch (e) {
      console.error("[media-studio campaign] publish failed", row.id, e);
      await db
        .update(adminMediaStudioCampaignPosts)
        .set({ state: "failed", updatedAt: new Date() })
        .where(eq(adminMediaStudioCampaignPosts.id, row.id));
      failed += 1;
    }
  }

  await maybeMarkCampaignCompleted(campaignId);
  return { published, failed };
}

export async function processRunningMediaStudioCampaigns(): Promise<{ published: number; failed: number }> {
  await ensureCampaignSchema();
  const db = getDb();
  const running = await db.select().from(adminMediaStudioCampaigns).where(eq(adminMediaStudioCampaigns.status, "running"));
  let published = 0;
  let failed = 0;
  for (const c of running) {
    const r = await processDuePostsForCampaign(c.id, BATCH_PER_CAMPAIGN);
    published += r.published;
    failed += r.failed;
  }
  return { published, failed };
}
