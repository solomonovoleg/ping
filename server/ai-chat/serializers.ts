import type { AiMessageRow } from "./repository";
import type { AiMemorySearchPayloadV1 } from "./memory-search";

export type AiMessageDto = {
  id: string;
  role: string;
  content: string;
  createdAt: string;
  payload?: AiMemorySearchPayloadV1 | null;
};

function coercePayload(raw: unknown): AiMemorySearchPayloadV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.v !== 1) return null;
  const tags = Array.isArray(o.tags) ? o.tags.filter((t): t is string => typeof t === "string") : [];
  const bm = o.bestMatch;
  let bestMatch: AiMemorySearchPayloadV1["bestMatch"] = null;
  if (bm && typeof bm === "object") {
    const b = bm as Record<string, unknown>;
    if (
      typeof b.messageId === "string" &&
      typeof b.chatId === "string" &&
      typeof b.chatTitle === "string" &&
      typeof b.excerpt === "string" &&
      typeof b.createdAt === "string"
    ) {
      bestMatch = {
        messageId: b.messageId,
        chatId: b.chatId,
        chatTitle: b.chatTitle,
        excerpt: b.excerpt,
        createdAt: b.createdAt,
      };
    }
  }
  const altsRaw = o.alternatives;
  const alternatives: NonNullable<AiMemorySearchPayloadV1["alternatives"]> = [];
  if (Array.isArray(altsRaw)) {
    for (const item of altsRaw) {
      if (!item || typeof item !== "object") continue;
      const a = item as Record<string, unknown>;
      if (
        typeof a.messageId === "string" &&
        typeof a.chatId === "string" &&
        typeof a.chatTitle === "string" &&
        typeof a.excerpt === "string" &&
        typeof a.createdAt === "string"
      ) {
        alternatives.push({
          messageId: a.messageId,
          chatId: a.chatId,
          chatTitle: a.chatTitle,
          excerpt: a.excerpt,
          createdAt: a.createdAt,
        });
      }
    }
  }
  return { v: 1, tags, bestMatch, alternatives: alternatives.length ? alternatives : undefined };
}

export function toAiMessageDto(row: AiMessageRow): AiMessageDto {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    payload: coercePayload(row.payload),
  };
}
