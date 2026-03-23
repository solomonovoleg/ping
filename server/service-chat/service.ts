import { and, asc, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { getDb, getPool } from "../db";
import { storage } from "../storage";
import {
  chatMemberPrefs,
  serviceChatCampaigns,
  serviceChatHosts,
  serviceChatStepStates,
  serviceChatTemplateSteps,
  serviceChatTemplates,
  serviceChatThreads,
  users,
} from "@shared/schema";
import { sendChatMessage } from "../messages/service";

type TemplateStepInput = { content: string; delayAfterReadSec: number; mediaJson?: string | null };
type ServiceThreadRef = { id: string; chatId: string };

export class ServiceChatError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const DEFAULT_LIST_SECTION = "invitations";

async function getActiveTemplate(hostUserId: string) {
  const db = getDb();
  const [tpl] = await db
    .select()
    .from(serviceChatTemplates)
    .where(and(eq(serviceChatTemplates.hostUserId, hostUserId), eq(serviceChatTemplates.isActive, true)))
    .orderBy(desc(serviceChatTemplates.createdAt))
    .limit(1);
  if (!tpl) return null;
  const steps = await db
    .select()
    .from(serviceChatTemplateSteps)
    .where(eq(serviceChatTemplateSteps.templateId, tpl.id))
    .orderBy(asc(serviceChatTemplateSteps.orderIndex), asc(serviceChatTemplateSteps.createdAt));
  return { template: tpl, steps };
}

function parseMediaUrls(mediaJson?: string | null): string[] {
  if (!mediaJson) return [];
  try {
    const parsed = JSON.parse(mediaJson) as unknown;
    if (typeof parsed === "string") {
      return parsed
        .split(/\r?\n|,/g)
        .map((s: string) => s.trim())
        .filter(Boolean);
    }
    if (Array.isArray(parsed)) {
      return parsed
        .filter((x) => typeof x === "string")
        .map((x) => String(x).trim())
        .filter(Boolean);
    }
  } catch {
    return mediaJson
      .split(/\r?\n|,/g)
      .map((s: string) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function detectMediaTypeByUrl(url: string): "image" | "video" | "text" {
  const normalized = url.toLowerCase();
  if (/\.(jpg|jpeg|png|gif|webp|heic|bmp)(\?|$)/i.test(normalized)) return "image";
  if (/\.(mp4|mov|webm|m4v|avi)(\?|$)/i.test(normalized)) return "video";
  return "text";
}

async function sendContentAndMedia(input: {
  userId: string;
  chatId: string;
  content?: string;
  mediaJson?: string | null;
}): Promise<string | null> {
  let firstMessageId: string | null = null;
  const text = (input.content ?? "").trim();
  if (text) {
    const msg = await sendChatMessage({
      userId: input.userId,
      chatId: input.chatId,
      content: text,
      type: "text",
    });
    firstMessageId = msg.id;
  }
  const mediaUrls = parseMediaUrls(input.mediaJson);
  for (const url of mediaUrls) {
    const type = detectMediaTypeByUrl(url);
    const msg = await sendChatMessage({
      userId: input.userId,
      chatId: input.chatId,
      content: url,
      type,
    });
    if (!firstMessageId) firstMessageId = msg.id;
  }
  return firstMessageId;
}

async function ensureServiceThread(
  hostUserId: string,
  targetUserId: string,
  opts?: { seedTemplate?: boolean },
): Promise<ServiceThreadRef | null> {
  if (hostUserId === targetUserId) return null;
  const seedTemplate = opts?.seedTemplate === true;
  const active = seedTemplate ? await getActiveTemplate(hostUserId) : null;
  if (seedTemplate && (!active || active.steps.length === 0)) return null;
  const db = getDb();
  const [existing] = await db
    .select()
    .from(serviceChatThreads)
    .where(and(eq(serviceChatThreads.hostUserId, hostUserId), eq(serviceChatThreads.targetUserId, targetUserId)))
    .limit(1);
  const thread =
    existing ??
    (await (async () => {
      const chat = await storage.getOrCreateDmChat(hostUserId, targetUserId);
      await storage.upsertChatMemberPrefs(hostUserId, chat.id, { listSection: DEFAULT_LIST_SECTION });
      const [created] = await db
        .insert(serviceChatThreads)
        .values({
          hostUserId,
          targetUserId,
          chatId: chat.id,
          templateId: active?.template.id ?? null,
          localRepliesEnabled: false,
          status: "active",
        })
        .onConflictDoNothing({ target: [serviceChatThreads.hostUserId, serviceChatThreads.targetUserId] })
        .returning();
      if (created) return created;
      const [fallback] = await db
        .select()
        .from(serviceChatThreads)
        .where(and(eq(serviceChatThreads.hostUserId, hostUserId), eq(serviceChatThreads.targetUserId, targetUserId)))
        .limit(1);
      return fallback ?? null;
    })());
  if (!thread) return null;
  await storage.upsertChatMemberPrefs(hostUserId, thread.chatId, { listSection: DEFAULT_LIST_SECTION });
  if (active?.steps?.length) {
    const rows = active.steps.map((step, idx) => ({
      threadId: thread.id,
      stepId: step.id,
      status: idx === 0 ? "scheduled" : "pending",
      nextSendAt: idx === 0 ? new Date() : null,
    }));
    await db.insert(serviceChatStepStates).values(rows).onConflictDoNothing();
  }
  return { id: thread.id, chatId: thread.chatId };
}

export async function bootstrapServiceThreadForNewUser(userId: string): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  const db = getDb();
  const hosts = await db
    .select({ hostUserId: serviceChatHosts.hostUserId })
    .from(serviceChatHosts)
    .where(eq(serviceChatHosts.enabled, true));
  for (const host of hosts) {
    await ensureServiceThread(host.hostUserId, userId, { seedTemplate: true });
  }
}

export async function ensureServiceChatReplyAllowed(chatId: string, senderUserId: string): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  const db = getDb();
  const [thread] = await db
    .select({
      hostUserId: serviceChatThreads.hostUserId,
      targetUserId: serviceChatThreads.targetUserId,
      localRepliesEnabled: serviceChatThreads.localRepliesEnabled,
      globalRepliesAllowed: serviceChatHosts.globalRepliesAllowed,
    })
    .from(serviceChatThreads)
    .innerJoin(serviceChatHosts, eq(serviceChatHosts.hostUserId, serviceChatThreads.hostUserId))
    .where(eq(serviceChatThreads.chatId, chatId))
    .limit(1);
  if (!thread) return;
  if (senderUserId === thread.hostUserId) return;
  if (senderUserId !== thread.targetUserId) return;
  const [hostPref] = await db
    .select({ listSection: chatMemberPrefs.listSection })
    .from(chatMemberPrefs)
    .where(and(eq(chatMemberPrefs.chatId, chatId), eq(chatMemberPrefs.userId, thread.hostUserId)))
    .limit(1);
  const hostSection = hostPref?.listSection ?? "general";
  // Restriction applies only while the chat stays in host's "invitations" folder.
  if (hostSection !== "invitations") return;
  const allowed = thread.globalRepliesAllowed || thread.localRepliesEnabled;
  if (!allowed) throw new ServiceChatError(403, "Хост отключил обратную связь в этом сервисном чате");
}

export async function markServiceStepRead(chatId: string, messageId: string): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const updated = await client.query<{ thread_id: string; step_id: string }>(
      `
      UPDATE service_chat_step_states ss
      SET read_at = NOW(), status = 'read'
      FROM service_chat_threads t
      WHERE ss.thread_id = t.id
        AND t.chat_id = $1
        AND ss.sent_message_id = $2
        AND ss.read_at IS NULL
      RETURNING ss.thread_id, ss.step_id
      `,
      [chatId, messageId],
    );
    const row = updated.rows[0];
    if (!row) {
      await client.query("COMMIT");
      return;
    }
    const next = await client.query<{ state_id: string; delay_sec: number }>(
      `
      SELECT ss.id AS state_id, COALESCE(st.delay_after_read_sec, 0)::int AS delay_sec
      FROM service_chat_step_states ss
      JOIN service_chat_template_steps st ON st.id = ss.step_id
      WHERE ss.thread_id = $1
        AND ss.status = 'pending'
      ORDER BY st.order_index ASC, st.created_at ASC
      LIMIT 1
      `,
      [row.thread_id],
    );
    const nextRow = next.rows[0];
    if (nextRow) {
      await client.query(
        `
        UPDATE service_chat_step_states
        SET status = 'scheduled',
            next_send_at = NOW() + make_interval(secs => $2::int)
        WHERE id = $1
        `,
        [nextRow.state_id, nextRow.delay_sec],
      );
    }
    await client.query("COMMIT");
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw e;
  } finally {
    client.release();
  }
}

export async function processServiceChatQueue(limit = 30): Promise<number> {
  if (!process.env.DATABASE_URL) return 0;
  const pool = getPool();
  const claimClient = await pool.connect();
  let claimed: Array<{ id: string; thread_id: string; content: string; media_json: string | null; host_user_id: string; chat_id: string }> = [];
  try {
    await claimClient.query("BEGIN");
    const result = await claimClient.query<{ id: string; thread_id: string; content: string; media_json: string | null; host_user_id: string; chat_id: string }>(
      `
      WITH due AS (
        SELECT cand.id
        FROM service_chat_step_states cand
        WHERE cand.status = 'scheduled'
          AND cand.sent_at IS NULL
          AND cand.next_send_at IS NOT NULL
          AND cand.next_send_at <= NOW()
        ORDER BY cand.next_send_at ASC
        LIMIT $1
        FOR UPDATE SKIP LOCKED
      )
      UPDATE service_chat_step_states sc
      SET status = 'sending'
      FROM due
      INNER JOIN service_chat_step_states picked ON picked.id = due.id
      INNER JOIN service_chat_threads t ON t.id = picked.thread_id
      INNER JOIN service_chat_template_steps st ON st.id = picked.step_id
      WHERE sc.id = due.id
      RETURNING sc.id, sc.thread_id, st.content, st.media_json, t.host_user_id, t.chat_id
      `,
      [Math.max(1, Math.min(limit, 100))],
    );
    claimed = result.rows;
    await claimClient.query("COMMIT");
  } catch (e) {
    try {
      await claimClient.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw e;
  } finally {
    claimClient.release();
  }
  let processed = 0;
  for (const job of claimed) {
    try {
      const firstMessageId = await sendContentAndMedia({
        userId: job.host_user_id,
        chatId: job.chat_id,
        content: job.content,
        mediaJson: job.media_json,
      });
      await getDb()
        .update(serviceChatStepStates)
        .set({ status: "sent", sentAt: new Date(), sentMessageId: firstMessageId, nextSendAt: null })
        .where(eq(serviceChatStepStates.id, job.id));
      processed += 1;
    } catch {
      await getDb()
        .update(serviceChatStepStates)
        .set({ status: "scheduled", nextSendAt: new Date(Date.now() + 15_000) })
        .where(eq(serviceChatStepStates.id, job.id));
    }
  }
  return processed;
}

export async function listServiceChatAdminState() {
  const db = getDb();
  const hostRows = await db
    .select({
      hostUserId: serviceChatHosts.hostUserId,
      enabled: serviceChatHosts.enabled,
      globalRepliesAllowed: serviceChatHosts.globalRepliesAllowed,
      activatedAt: serviceChatHosts.activatedAt,
      displayName: users.displayName,
      surname: users.surname,
      publicId: users.publicId,
    })
    .from(serviceChatHosts)
    .innerJoin(users, eq(users.id, serviceChatHosts.hostUserId))
    .orderBy(desc(serviceChatHosts.activatedAt), desc(serviceChatHosts.updatedAt));
  return hostRows;
}

export async function upsertServiceHostConfig(input: { hostUserId: string; enabled: boolean; globalRepliesAllowed: boolean }) {
  const db = getDb();
  const [hostUser] = await db.select({ id: users.id }).from(users).where(eq(users.id, input.hostUserId)).limit(1);
  if (!hostUser) throw new ServiceChatError(404, "Пользователь-хост не найден");
  const [row] = await db
    .insert(serviceChatHosts)
    .values({
      hostUserId: input.hostUserId,
      enabled: input.enabled,
      globalRepliesAllowed: input.globalRepliesAllowed,
      activatedAt: input.enabled ? new Date() : null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [serviceChatHosts.hostUserId],
      set: {
        enabled: input.enabled,
        globalRepliesAllowed: input.globalRepliesAllowed,
        activatedAt: input.enabled ? sql`COALESCE(${serviceChatHosts.activatedAt}, NOW())` : null,
        updatedAt: new Date(),
      },
    })
    .returning();
  return row;
}

export async function replaceActiveTemplate(hostUserId: string, name: string, steps: TemplateStepInput[]) {
  if (steps.length === 0) throw new ServiceChatError(400, "Добавьте минимум один шаг шаблона");
  const db = getDb();
  await db.update(serviceChatTemplates).set({ isActive: false }).where(eq(serviceChatTemplates.hostUserId, hostUserId));
  const [tpl] = await db.insert(serviceChatTemplates).values({ hostUserId, name, isActive: true }).returning();
  const rows = steps.map((s, i) => ({
    templateId: tpl.id,
    orderIndex: i,
    content: s.content.trim(),
    mediaJson: s.mediaJson ?? null,
    delayAfterReadSec: Math.max(0, Math.floor(s.delayAfterReadSec || 0)),
  }));
  await db.insert(serviceChatTemplateSteps).values(rows);
  return tpl;
}

export async function runServiceCampaign(input: {
  hostUserId: string;
  mode: "all" | "selected" | "personal";
  targetUserIds?: string[];
  content?: string;
  mediaJson?: string | null;
}) {
  const db = getDb();
  let targetIds: string[] = [];
  if (input.mode === "all") {
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(and(ne(users.id, input.hostUserId), isNull(users.deletedAt)));
    targetIds = rows.map((r) => r.id);
  } else {
    targetIds = Array.from(new Set((input.targetUserIds ?? []).filter(Boolean))).filter((id) => id !== input.hostUserId);
  }
  const [campaign] = await db
    .insert(serviceChatCampaigns)
    .values({ hostUserId: input.hostUserId, mode: input.mode, filtersJson: JSON.stringify({ targetIds }), status: "running" })
    .returning();
  let created = 0;
  let sent = 0;
  for (const uid of targetIds) {
    const thread = await ensureServiceThread(input.hostUserId, uid, { seedTemplate: false });
    if (!thread) continue;
    created += 1;
    if ((input.content && input.content.trim()) || parseMediaUrls(input.mediaJson).length > 0) {
      await sendContentAndMedia({
        userId: input.hostUserId,
        chatId: thread.chatId,
        content: input.content,
        mediaJson: input.mediaJson,
      });
      sent += 1;
    }
  }
  await db.update(serviceChatCampaigns).set({ status: "done" }).where(eq(serviceChatCampaigns.id, campaign.id));
  return { campaignId: campaign.id, targetCount: targetIds.length, affectedThreads: created, sentMessagesTo: sent };
}

export async function setLocalRepliesByChat(hostUserId: string, chatId: string, enabled: boolean) {
  const db = getDb();
  const rows = await db
    .update(serviceChatThreads)
    .set({ localRepliesEnabled: enabled })
    .where(and(eq(serviceChatThreads.chatId, chatId), eq(serviceChatThreads.hostUserId, hostUserId)))
    .returning({ id: serviceChatThreads.id, localRepliesEnabled: serviceChatThreads.localRepliesEnabled });
  if (!rows[0]) throw new ServiceChatError(404, "Сервисный чат не найден или у вас нет прав хоста");
  return rows[0];
}

export async function getThreadByChatForUser(userId: string, chatId: string) {
  const db = getDb();
  const [row] = await db
    .select({
      id: serviceChatThreads.id,
      hostUserId: serviceChatThreads.hostUserId,
      targetUserId: serviceChatThreads.targetUserId,
      localRepliesEnabled: serviceChatThreads.localRepliesEnabled,
      globalRepliesAllowed: serviceChatHosts.globalRepliesAllowed,
    })
    .from(serviceChatThreads)
    .innerJoin(serviceChatHosts, eq(serviceChatHosts.hostUserId, serviceChatThreads.hostUserId))
    .where(eq(serviceChatThreads.chatId, chatId))
    .limit(1);
  if (!row) return null;
  if (row.hostUserId !== userId && row.targetUserId !== userId) return null;
  return row;
}

export async function listServiceTemplates(hostUserId: string) {
  const db = getDb();
  const templates = await db
    .select()
    .from(serviceChatTemplates)
    .where(eq(serviceChatTemplates.hostUserId, hostUserId))
    .orderBy(desc(serviceChatTemplates.createdAt));
  const templateIds = templates.map((t) => t.id);
  const steps = templateIds.length
    ? await db
        .select()
        .from(serviceChatTemplateSteps)
        .where(inArray(serviceChatTemplateSteps.templateId, templateIds))
        .orderBy(asc(serviceChatTemplateSteps.orderIndex), asc(serviceChatTemplateSteps.createdAt))
    : [];
  return templates.map((tpl) => ({
    ...tpl,
    steps: steps.filter((step: (typeof steps)[number]) => step.templateId === tpl.id),
  }));
}
