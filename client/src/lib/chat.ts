import { API, apiFetch } from "@/lib/api-base";

export type MessageType = "text" | "system" | "voice" | "image" | "video";

export async function getMessages(
  chatId: string,
  opts?: { limit?: number; before?: string }
): Promise<ChatMessage[]> {
  const limit = opts?.limit ?? 100;
  const params = new URLSearchParams({ limit: String(limit) });
  if (opts?.before) params.set("before", opts.before);
  const res = await apiFetch(`${API}/chats/${encodeURIComponent(chatId)}/messages?${params}`);
  if (!res.ok) throw new Error("Не удалось загрузить сообщения");
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export type SearchMessageHit = {
  messageId: string;
  chatId: string;
  content: string;
  createdAt: string;
  chatName: string;
};

export async function searchMessages(query: string): Promise<SearchMessageHit[]> {
  const q = query.trim();
  if (!q) return [];
  const res = await apiFetch(`${API}/search/messages?q=${encodeURIComponent(q)}`);
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export type SavedMessageItem = {
  messageId: string;
  chatId: string;
  savedAt: string;
  content: string;
  type: string;
  chatName: string;
};

export async function getSavedMessages(limit = 50, offset = 0): Promise<SavedMessageItem[]> {
  const res = await apiFetch(`${API}/saved-messages?limit=${limit}&offset=${offset}`);
  if (!res.ok) throw new Error("Не удалось загрузить избранное");
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function saveMessage(messageId: string, chatId: string): Promise<void> {
  const res = await apiFetch(`${API}/saved-messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messageId, chatId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message || "Не удалось сохранить");
  }
}

export async function unsaveMessage(messageId: string): Promise<void> {
  const res = await apiFetch(`${API}/saved-messages/${encodeURIComponent(messageId)}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Не удалось убрать из избранного");
}

export async function isMessageSaved(messageId: string): Promise<boolean> {
  const res = await apiFetch(`${API}/saved-messages/check/${encodeURIComponent(messageId)}`);
  if (!res.ok) return false;
  const data = (await res.json()) as { saved?: boolean };
  return !!data.saved;
}

export async function sendMessage(
  chatId: string,
  payload: { content: string; type?: MessageType; replyToId?: string; forwardedFromMessageId?: string; originalChatId?: string }
): Promise<ChatMessage> {
  const body: { content: string; type: string; replyToId?: string; forwardedFromMessageId?: string; originalChatId?: string } = {
    content: payload.content,
    type: payload.type ?? "text",
  };
  if (payload.replyToId) body.replyToId = payload.replyToId;
  if (payload.forwardedFromMessageId && payload.originalChatId) {
    body.forwardedFromMessageId = payload.forwardedFromMessageId;
    body.originalChatId = payload.originalChatId;
  }
  const res = await apiFetch(`${API}/chats/${encodeURIComponent(chatId)}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message || "Не удалось отправить");
  }
  return res.json();
}

/** Расширение файла по MIME (Safari даёт audio/mp4, Chrome — audio/webm) */
function voiceExtension(mime: string): string {
  if (mime.includes("mp4") || mime.includes("m4a")) return ".m4a";
  if (mime.includes("aac")) return ".aac";
  if (mime.includes("ogg")) return ".ogg";
  if (mime.includes("wav")) return ".wav";
  if (mime.includes("mpeg")) return ".mp3";
  return ".webm";
}

function fallbackVoiceMime(): string {
  if (typeof navigator !== "undefined" && /iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    return "audio/mp4";
  }
  return "audio/webm";
}

export async function uploadVoice(blob: Blob): Promise<string> {
  const form = new FormData();
  const normalizedType = (blob.type || "").startsWith("audio/") ? blob.type : fallbackVoiceMime();
  const ext = voiceExtension(normalizedType);
  const file = new File([blob], `voice${ext}`, { type: normalizedType });
  form.append("audio", file, file.name);
  const res = await apiFetch(`${API}/upload/voice`, { method: "POST", body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message || "Не удалось загрузить голосовое");
  }
  const data = (await res.json()) as { url: string };
  return data.url;
}

export async function uploadChatMedia(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await apiFetch(`${API}/upload/chat-media`, { method: "POST", body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message || "Не удалось загрузить файл");
  }
  const data = (await res.json()) as { url: string };
  return data.url;
}

export type ReplySnapshot = { id: string; senderId: string | null; type: string; content: string };

export type ReactionItem = { emoji: string; count: number };

export type ChatMessage = {
  id: string;
  chatId: string;
  senderId: string | null;
  type: MessageType;
  content: string;
  replyToId?: string | null;
  replyTo?: ReplySnapshot;
  forwardedFromMessageId?: string | null;
  forwardedFromSenderName?: string | null;
  reactions?: ReactionItem[];
  createdAt: string;
};

const REACTION_EMOJIS = ["👍", "❤️", "🔥", "👏", "😂", "🤔", "😮", "😢"];

export async function addMessageReaction(chatId: string, messageId: string, emoji: string): Promise<void> {
  const res = await apiFetch(`${API}/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}/reactions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ emoji }),
  });
  if (!res.ok) throw new Error("Не удалось поставить реакцию");
}

export async function removeMessageReaction(chatId: string, messageId: string): Promise<void> {
  const res = await apiFetch(`${API}/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}/reactions`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Не удалось убрать реакцию");
}

export { REACTION_EMOJIS };
