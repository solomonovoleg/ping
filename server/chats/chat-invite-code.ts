import { randomBytes } from "crypto";
import type { Chat } from "@shared/schema";
import { storage } from "../storage";

export function generateChatInviteCode(): string {
  return randomBytes(12).toString("base64url");
}

/** Гарантирует invite_code у группового чата (лениво для старых чатов). */
export async function ensureGroupChatHasInviteCode(chat: Chat): Promise<Chat> {
  if (chat.type !== "group" || chat.inviteCode) return chat;
  const inviteCode = generateChatInviteCode();
  const updated = await storage.updateChat(chat.id, { inviteCode });
  return updated ?? { ...chat, inviteCode };
}
