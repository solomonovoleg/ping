import type { Chat, User } from "@shared/schema";

export function formatTrackDmChatTitle(peer: User | null): string {
  if (!peer) return "Диалог";
  const name = [peer.displayName, peer.surname].filter(Boolean).join(" ").trim();
  return name || `ID ${peer.publicId}`;
}

export function formatTrackGroupChatTitle(chat: Chat): string {
  return chat.name || (chat.type === "business" ? "BUSINESS чат" : "Группа");
}

export function formatTrackCallSessionChatTitle(chat: Chat | undefined): string {
  return chat?.name || "Созвон";
}
