import { and, count, eq } from "drizzle-orm";
import { follows, senderWelcomeDeliveries, senderWelcomeSettings } from "@shared/schema";
import { getDb } from "../db";
import { sendChatMessage } from "../messages/service";
import { storage } from "../storage";

const MAX_WELCOME_TEXT = 4096;
const MAX_MEDIA_URL_LEN = 2048;

export type SenderWelcomePayload = {
  moduleEnabled: boolean;
  autoSendOnFollow: boolean;
  welcomeText: string;
  welcomeMediaUrl: string | null;
  stats: {
    followersCount: number;
    welcomesDeliveredCount: number;
  };
};

function mediaTypeForUrl(url: string): "image" | "video" {
  const n = url.toLowerCase();
  if (/\.(mp4|mov|webm|m4v|3gp)(\?|$)/i.test(n)) return "video";
  return "image";
}

function emptyPayload(stats: { followersCount: number; welcomesDeliveredCount: number }): SenderWelcomePayload {
  return {
    moduleEnabled: false,
    autoSendOnFollow: false,
    welcomeText: "",
    welcomeMediaUrl: null,
    stats,
  };
}

async function countFollowersOf(userId: string): Promise<number> {
  const db = getDb();
  const [r] = await db.select({ c: count() }).from(follows).where(eq(follows.followingId, userId));
  return Number(r?.c ?? 0);
}

async function countDeliveries(ownerUserId: string): Promise<number> {
  const db = getDb();
  const [r] = await db
    .select({ c: count() })
    .from(senderWelcomeDeliveries)
    .where(eq(senderWelcomeDeliveries.ownerUserId, ownerUserId));
  return Number(r?.c ?? 0);
}

export async function getSenderWelcomeForUser(userId: string): Promise<SenderWelcomePayload> {
  const db = getDb();
  const [followersCount, deliveriesCount] = await Promise.all([countFollowersOf(userId), countDeliveries(userId)]);
  const [row] = await db.select().from(senderWelcomeSettings).where(eq(senderWelcomeSettings.userId, userId)).limit(1);
  if (!row) {
    return emptyPayload({ followersCount: followersCount, welcomesDeliveredCount: deliveriesCount });
  }
  return {
    moduleEnabled: row.moduleEnabled,
    autoSendOnFollow: row.autoSendOnFollow,
    welcomeText: row.welcomeText ?? "",
    welcomeMediaUrl: row.welcomeMediaUrl ?? null,
    stats: { followersCount: followersCount, welcomesDeliveredCount: deliveriesCount },
  };
}

export type PatchSenderWelcomeInput = {
  moduleEnabled?: boolean;
  autoSendOnFollow?: boolean;
  welcomeText?: string;
  welcomeMediaUrl?: string | null;
};

export async function patchSenderWelcome(userId: string, patch: PatchSenderWelcomeInput): Promise<SenderWelcomePayload> {
  const db = getDb();
  const text =
    patch.welcomeText !== undefined
      ? patch.welcomeText.replace(/\r\n/g, "\n").trim().slice(0, MAX_WELCOME_TEXT)
      : undefined;
  let mediaUrl: string | null | undefined = patch.welcomeMediaUrl;
  if (mediaUrl !== undefined) {
    const t = typeof mediaUrl === "string" ? mediaUrl.trim() : "";
    mediaUrl = t.length === 0 ? null : t.slice(0, MAX_MEDIA_URL_LEN);
  }

  const [existing] = await db.select().from(senderWelcomeSettings).where(eq(senderWelcomeSettings.userId, userId)).limit(1);

  const next = {
    moduleEnabled: patch.moduleEnabled !== undefined ? patch.moduleEnabled : (existing?.moduleEnabled ?? false),
    autoSendOnFollow:
      patch.autoSendOnFollow !== undefined ? patch.autoSendOnFollow : (existing?.autoSendOnFollow ?? false),
    welcomeText: text !== undefined ? text : (existing?.welcomeText ?? ""),
    welcomeMediaUrl:
      mediaUrl !== undefined ? mediaUrl : (existing?.welcomeMediaUrl ?? null),
  };

  if (next.moduleEnabled && next.autoSendOnFollow && !next.welcomeText.trim() && !next.welcomeMediaUrl) {
    const err = new Error("Укажите текст или медиа для приветствия");
    (err as { status?: number }).status = 400;
    throw err;
  }

  await db
    .insert(senderWelcomeSettings)
    .values({
      userId,
      moduleEnabled: next.moduleEnabled,
      autoSendOnFollow: next.autoSendOnFollow,
      welcomeText: next.welcomeText,
      welcomeMediaUrl: next.welcomeMediaUrl,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [senderWelcomeSettings.userId],
      set: {
        moduleEnabled: next.moduleEnabled,
        autoSendOnFollow: next.autoSendOnFollow,
        welcomeText: next.welcomeText,
        welcomeMediaUrl: next.welcomeMediaUrl,
        updatedAt: new Date(),
      },
    });

  return getSenderWelcomeForUser(userId);
}

/**
 * Отправка приветствия от владельца (на кого подписались) новому подписчику.
 */
export async function trySendSenderWelcomeDm(creatorUserId: string, followerUserId: string): Promise<void> {
  if (!creatorUserId || !followerUserId || creatorUserId === followerUserId) return;
  const db = getDb();
  /** Один раз за всё время на пару «автор — подписчик» (отписка/повторная подписка не дублируют ЛС). */
  const [alreadySent] = await db
    .select({ id: senderWelcomeDeliveries.id })
    .from(senderWelcomeDeliveries)
    .where(
      and(
        eq(senderWelcomeDeliveries.ownerUserId, creatorUserId),
        eq(senderWelcomeDeliveries.followerUserId, followerUserId),
      ),
    )
    .limit(1);
  if (alreadySent) return;

  const [row] = await db
    .select()
    .from(senderWelcomeSettings)
    .where(
      and(
        eq(senderWelcomeSettings.userId, creatorUserId),
        eq(senderWelcomeSettings.moduleEnabled, true),
        eq(senderWelcomeSettings.autoSendOnFollow, true),
      ),
    )
    .limit(1);
  if (!row) return;
  const t = (row.welcomeText ?? "").trim();
  const m = (row.welcomeMediaUrl ?? "").trim();
  if (!t && !m) return;

  /** Ни при какой блокировке между ними не шлём (только 1:1, без «лишних»). */
  const blockedAB = await storage.isBlocked(creatorUserId, followerUserId);
  const blockedBA = await storage.isBlocked(followerUserId, creatorUserId);
  if (blockedAB || blockedBA) return;

  const a = await storage.getBlockFlags(creatorUserId, followerUserId);
  const b = await storage.getBlockFlags(followerUserId, creatorUserId);
  if (a?.restrictChat || b?.restrictChat) return;

  /** Подписка должна быть актуальной в момент отправки (фоновая задержка, мгновенная отписка). */
  const stillFollowing = await storage.isFollowing(followerUserId, creatorUserId);
  if (!stillFollowing) return;

  try {
    const chat = await storage.getOrCreateDmChat(creatorUserId, followerUserId);
    if (t) {
      await sendChatMessage({
        userId: creatorUserId,
        chatId: chat.id,
        content: t,
        type: "text",
      });
    }
    if (m) {
      await sendChatMessage({
        userId: creatorUserId,
        chatId: chat.id,
        content: m,
        type: mediaTypeForUrl(m),
      });
    }
    await db.insert(senderWelcomeDeliveries).values({
      ownerUserId: creatorUserId,
      followerUserId,
    });
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[sender] trySendSenderWelcomeDm:", e);
    }
  }
}
