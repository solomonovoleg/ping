import { randomBytes } from "crypto";
import { storage } from "../storage";

const SHORT_CODE_BYTES = 4;
const MAX_SHORT_CODE_ATTEMPTS = 8;

function makeShortCode(): string {
  return randomBytes(SHORT_CODE_BYTES).toString("hex");
}

function isPgUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code =
    (error as { code?: unknown }).code ??
    ((error as { cause?: { code?: unknown } }).cause?.code ?? null);
  return code === "23505";
}

/**
 * Ensure group/business chats always receive a human-readable short code.
 * Safe for concurrent creation thanks to unique-index retry loop.
 */
export async function ensureChatShortCode(chatId: string): Promise<string | null> {
  const chat = await storage.getChatById(chatId);
  if (!chat) return null;
  if (chat.type === "dm") return null;
  if (chat.shortCode) return chat.shortCode;

  for (let attempt = 0; attempt < MAX_SHORT_CODE_ATTEMPTS; attempt++) {
    const code = makeShortCode();
    try {
      const updated = await storage.updateChat(chatId, { shortCode: code });
      if (updated?.shortCode) return updated.shortCode;
    } catch (error) {
      if (!isPgUniqueViolation(error)) throw error;
    }
  }
  throw new Error("Не удалось сгенерировать уникальный shortCode для чата");
}
