import type { ChatMessagePayload, MessageReactionItem } from "../realtime/chat";

function envInt(name: string, fallback: number): number {
  const v = process.env[name]?.trim();
  if (!v) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

const TIMEOUT_PER_ATTEMPT_MS = envInt("API_HUB_BRIDGE_TIMEOUT_MS", 5000);
const MAX_ATTEMPTS = Math.min(5, Math.max(1, envInt("API_HUB_BRIDGE_MAX_ATTEMPTS", 3)));
const RETRY_BASE_MS = Math.max(50, envInt("API_HUB_BRIDGE_RETRY_BASE_MS", 200));

type BridgeBody =
  | { event: "message.created"; chatId: string; memberUserIds: string[]; message: ChatMessagePayload }
  | {
      event: "message.updated";
      chatId: string;
      memberUserIds: string[];
      messageId: string;
      content: string;
    }
  | { event: "message.deleted"; chatId: string; memberUserIds: string[]; messageId: string }
  | {
      event: "message.reactions.updated";
      chatId: string;
      memberUserIds: string[];
      messageId: string;
      reactions: MessageReactionItem[];
      actorUserId: string;
      emoji: string | null;
    }
  | { event: "message.transcript.updated"; chatId: string; memberUserIds: string[]; message: ChatMessagePayload };

function bridgeIdempotencyKey(body: BridgeBody): string {
  const members = [...body.memberUserIds].sort().join(",");
  switch (body.event) {
    case "message.created":
      return `bridge:${body.event}:${body.chatId}:${body.message.id}:${members}`;
    case "message.updated":
      return `bridge:${body.event}:${body.chatId}:${body.messageId}:${members}`;
    case "message.deleted":
      return `bridge:${body.event}:${body.chatId}:${body.messageId}:${members}`;
    case "message.reactions.updated":
      return `bridge:${body.event}:${body.chatId}:${body.messageId}:${body.actorUserId}:${body.emoji ?? "null"}:${members}`;
    case "message.transcript.updated":
      return `bridge:${body.event}:${body.chatId}:${body.message.id}:${members}`;
    default:
      return `bridge:${JSON.stringify(body).slice(0, 180)}`;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function postBridgeOnce(
  url: string,
  secret: string,
  body: BridgeBody,
  idempotencyKey: string,
): Promise<{ ok: boolean; status: number; retriable: boolean }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_PER_ATTEMPT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const retriable = res.status === 429 || res.status >= 500;
    return { ok: res.ok, status: res.status, retriable };
  } catch {
    return { ok: false, status: 0, retriable: true };
  } finally {
    clearTimeout(timer);
  }
}

function scheduleApiHubBridge(body: BridgeBody): void {
  const url = process.env.API_HUB_BRIDGE_URL?.trim();
  const secret = process.env.API_HUB_BRIDGE_SECRET?.trim();
  if (!url || !secret || body.memberUserIds.length === 0) return;

  const idempotencyKey = bridgeIdempotencyKey(body);

  void (async () => {
    let lastStatus = 0;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      if (attempt > 0) {
        await sleep(RETRY_BASE_MS * 2 ** (attempt - 1));
      }
      const r = await postBridgeOnce(url, secret, body, idempotencyKey);
      lastStatus = r.status;
      if (r.ok) return;
      if (!r.retriable) {
        console.warn("[api-hub-bridge] hub responded", r.status);
        return;
      }
    }
    console.warn("[api-hub-bridge] gave up after retries, last status", lastStatus);
  })();
}

export function scheduleApiHubBridgeNewMessage(
  chatId: string,
  message: ChatMessagePayload,
  memberUserIds: string[],
): void {
  scheduleApiHubBridge({ event: "message.created", chatId, memberUserIds, message });
}

export function scheduleApiHubBridgeMessageEdited(
  chatId: string,
  messageId: string,
  content: string,
  memberUserIds: string[],
): void {
  scheduleApiHubBridge({ event: "message.updated", chatId, memberUserIds, messageId, content });
}

export function scheduleApiHubBridgeMessageDeleted(
  chatId: string,
  messageId: string,
  memberUserIds: string[],
): void {
  scheduleApiHubBridge({ event: "message.deleted", chatId, memberUserIds, messageId });
}

export function scheduleApiHubBridgeReactions(
  chatId: string,
  messageId: string,
  reactions: MessageReactionItem[],
  actorUserId: string,
  emoji: string | null,
  memberUserIds: string[],
): void {
  scheduleApiHubBridge({
    event: "message.reactions.updated",
    chatId,
    memberUserIds,
    messageId,
    reactions,
    actorUserId,
    emoji,
  });
}

export function scheduleApiHubBridgeTranscript(
  chatId: string,
  message: ChatMessagePayload,
  memberUserIds: string[],
): void {
  scheduleApiHubBridge({ event: "message.transcript.updated", chatId, memberUserIds, message });
}
