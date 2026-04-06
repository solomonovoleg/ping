import { sendChatMessage, MessagesServiceError } from "../messages/service";
import { storage } from "../storage";

function mediaTypeForPrizeDmUrl(url: string): "image" | "video" {
  const n = url.toLowerCase();
  if (/\.(mp4|mov|webm|m4v|3gp)(\?|$)/i.test(n)) return "video";
  return "image";
}

/** Как в EDGE `runPrizeDraw`: не больше стольких победителей за один вызов. */
export const MAX_PRIZE_DM_RECIPIENTS_PER_BATCH = 50;

const PLATFORM_USER_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** ID пользователя платформы (как в `users.id`), без пробелов и «левых» строк — иначе не шлём никому из партии. */
export function isValidPlatformUserIdForPrizeDm(id: string): boolean {
  const t = id.trim();
  return t.length > 0 && t.length <= 64 && PLATFORM_USER_ID_RE.test(t);
}

/** От чьего имени писать победителям: создатель кампании в EDGE или EDGE_PRIZE_NOTIFY_USER_ID. */
export function resolvePrizeDmSenderId(creatorPlatformUserId: string | null | undefined): string | null {
  const c = typeof creatorPlatformUserId === "string" ? creatorPlatformUserId.trim() : "";
  if (c) return c;
  const fb = process.env.EDGE_PRIZE_NOTIFY_USER_ID?.trim();
  return fb && fb.length > 0 ? fb : null;
}

export type PrizeDrawNotifyPayload = {
  campaignTitle: string;
  giftLabel: string;
  winners: { platformUserId: string; giftKey: string; giftLabel: string }[];
  winnerDm?: { text: string; mediaUrl: string | null } | null;
  /** Если задано — после дедупликации длина списка должна совпасть; иначе ЛС не уходят никому (защита от порчи ответа). */
  drawnCount?: number;
};

/** Только победители розыгрыша: пустые ID отбрасываем, дубликаты — один раз (никому «лишнему» не пишем). */
export function dedupePrizeWinnerRecipients(
  winners: { platformUserId: string; giftKey: string; giftLabel: string }[],
): { platformUserId: string; giftKey: string; giftLabel: string }[] {
  const seen = new Set<string>();
  const out: { platformUserId: string; giftKey: string; giftLabel: string }[] = [];
  for (const w of winners) {
    const id = typeof w.platformUserId === "string" ? w.platformUserId.trim() : "";
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push({
      platformUserId: id,
      giftKey: typeof w.giftKey === "string" ? w.giftKey : "",
      giftLabel: typeof w.giftLabel === "string" ? w.giftLabel : "",
    });
  }
  return out;
}

function applyWinnerDmPlaceholders(text: string, ctx: { giftLabel: string; campaignTitle: string }): string {
  return text
    .replace(/\{\{giftLabel\}\}/g, ctx.giftLabel)
    .replace(/\{\{campaignTitle\}\}/g, ctx.campaignTitle);
}

function abortNotifyResults(
  recipients: { platformUserId: string; giftKey: string; giftLabel: string }[],
  error: string,
): { platformUserId: string; ok: boolean; error?: string }[] {
  return recipients.map((r) => ({ platformUserId: r.platformUserId, ok: false, error }));
}

/** Только 1:1 ЛС: ровно два участника — отправитель и победитель (не группа и не третьи лица). */
async function openStrictPrizeDmChat(senderUserId: string, winnerUserId: string): Promise<{ id: string }> {
  const chat = await storage.getOrCreateDmChat(senderUserId, winnerUserId);
  const memberIds = await storage.getChatMemberIds(chat.id);
  const ms = new Set(memberIds);
  if (memberIds.length !== 2 || !ms.has(senderUserId) || !ms.has(winnerUserId)) {
    console.error("[prize-draw-notify] DM не строго 1:1, сообщение не отправляем", {
      chatId: chat.id,
      memberIds,
      senderUserId,
      winnerUserId,
    });
    throw new MessagesServiceError(500, "dm_not_strict_pair");
  }
  return chat;
}

/**
 * ЛС **только** адресатам из `payload.winners` (после дедупликации): один 1:1 DM-чат на пару отправитель–победитель.
 * Нет циклов по подписчикам/группам. Дубликаты user id в одном батче → одно сообщение. При сбое проверок целостности
 * не отправляем **никому** из этой партии (не «всем кроме одного»).
 */
export async function notifyPrizeDrawWinners(params: {
  senderId: string;
  payload: PrizeDrawNotifyPayload;
}): Promise<{ platformUserId: string; ok: boolean; error?: string }[]> {
  const { senderId, payload } = params;
  const sender = senderId.trim();
  const dmResults: { platformUserId: string; ok: boolean; error?: string }[] = [];
  const recipients = dedupePrizeWinnerRecipients(payload.winners);

  if (!isValidPlatformUserIdForPrizeDm(sender)) {
    console.error("[prize-draw-notify] invalid sender id, abort", senderId);
    return abortNotifyResults(recipients, "invalid_sender_id");
  }

  if (recipients.length > MAX_PRIZE_DM_RECIPIENTS_PER_BATCH) {
    console.error("[prize-draw-notify] too many recipients, abort", recipients.length);
    return abortNotifyResults(recipients, "too_many_recipients");
  }

  const invalidPeer = recipients.filter((r) => !isValidPlatformUserIdForPrizeDm(r.platformUserId));
  if (invalidPeer.length > 0) {
    console.error(
      "[prize-draw-notify] invalid winner user id(s), no messages sent",
      invalidPeer.map((p) => p.platformUserId),
    );
    return abortNotifyResults(recipients, "invalid_platform_user_id");
  }

  const dc = payload.drawnCount;
  if (typeof dc === "number" && Number.isFinite(dc) && dc !== recipients.length) {
    console.error("[prize-draw-notify] drawnCount vs unique winners mismatch, abort", {
      drawnCount: dc,
      uniqueRecipients: recipients.length,
    });
    return abortNotifyResults(recipients, "winner_list_integrity_mismatch");
  }

  const dmTpl = payload.winnerDm;
  const defaultBlock = [
    "🎉 Поздравляем!",
    `Вы выиграли приз в кампании «${payload.campaignTitle}»: ${payload.giftLabel}.`,
    "Свяжитесь с организатором для получения награды.",
  ].join("\n");

  for (const w of recipients) {
    const ctx = { giftLabel: w.giftLabel, campaignTitle: payload.campaignTitle };
    const customText =
      dmTpl?.text.trim() && dmTpl.text.trim().length > 0 ? applyWinnerDmPlaceholders(dmTpl.text, ctx) : "";
    const customMedia = dmTpl?.mediaUrl?.trim() ?? "";
    try {
      const chat = await openStrictPrizeDmChat(sender, w.platformUserId);
      if (customText || customMedia) {
        if (customText) {
          await sendChatMessage({
            userId: sender,
            chatId: chat.id,
            content: customText,
            type: "text",
          });
        }
        if (customMedia) {
          await sendChatMessage({
            userId: sender,
            chatId: chat.id,
            content: customMedia,
            type: mediaTypeForPrizeDmUrl(customMedia),
          });
        }
      } else {
        await sendChatMessage({
          userId: sender,
          chatId: chat.id,
          content: defaultBlock,
          type: "text",
        });
      }
      dmResults.push({ platformUserId: w.platformUserId, ok: true });
    } catch (e) {
      const msg = e instanceof MessagesServiceError ? e.message : "send_failed";
      console.error("[prize-draw-notify] dm", w.platformUserId, e);
      dmResults.push({ platformUserId: w.platformUserId, ok: false, error: msg });
    }
  }
  return dmResults;
}
