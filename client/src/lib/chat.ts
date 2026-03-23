import { API, apiFetch } from "@/lib/api-base";

/** Ошибка HTTP при операции с чатом (например 403 при блокировке). */
export class ChatRequestError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ChatRequestError";
    this.status = status;
  }
}

export type MessageType =
  | "text"
  | "system"
  | "voice"
  | "image"
  | "video"
  | "video_note"
  | "post_share"
  | "story_reply";

export async function getChatMedia(
  chatId: string,
  opts?: { folderId?: string | null; limit?: number; before?: string }
): Promise<{ id: string; type: string; content: string; createdAt: string }[]> {
  const params = new URLSearchParams({ limit: String(opts?.limit ?? 30) });
  if (opts?.folderId) params.set("folderId", opts.folderId);
  if (opts?.before) params.set("before", opts.before);
  const res = await apiFetch(`${API}/chats/${encodeURIComponent(chatId)}/media?${params}`);
  if (!res.ok) throw new Error("Не удалось загрузить медиа");
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function getChatLinks(
  chatId: string,
  opts?: { folderId?: string | null; limit?: number; before?: string }
): Promise<{ url: string; messageId: string; createdAt: string }[]> {
  const params = new URLSearchParams({ limit: String(opts?.limit ?? 50) });
  if (opts?.folderId) params.set("folderId", opts.folderId);
  if (opts?.before) params.set("before", opts.before);
  const res = await apiFetch(`${API}/chats/${encodeURIComponent(chatId)}/links?${params}`);
  if (!res.ok) throw new Error("Не удалось загрузить ссылки");
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function getMessages(
  chatId: string,
  opts?: { limit?: number; before?: string; folderId?: string }
): Promise<ChatMessage[]> {
  const limit = opts?.limit ?? 100;
  const params = new URLSearchParams({ limit: String(limit) });
  if (opts?.before) params.set("before", opts.before);
  if (opts?.folderId) params.set("folderId", opts.folderId);
  const res = await apiFetch(`${API}/chats/${encodeURIComponent(chatId)}/messages?${params}`);
  if (!res.ok) throw new Error("Не удалось загрузить сообщения");
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

/** Расшифровка голосового или видеокружка по запросу из меню сообщения. */
export async function transcribeVoiceOrVideoNoteMessage(
  chatId: string,
  messageId: string,
): Promise<{ transcript: string }> {
  const res = await apiFetch(
    `${API}/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}/transcribe`,
    { method: "POST" },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message || "Не удалось расшифровать");
  }
  return res.json() as Promise<{ transcript: string }>;
}

export type SearchMessageHit = {
  messageId: string;
  chatId: string;
  /** Тип сообщения (text, story_reply, …) — для человекочитаемого превью в поиске. */
  type?: string;
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

export async function patchChatMemberMe(
  chatId: string,
  body: { pinned?: boolean; hidden?: boolean; listSection?: string }
): Promise<void> {
  const res = await apiFetch(`${API}/chats/${encodeURIComponent(chatId)}/me`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message || "Не удалось сохранить");
  }
}

export type ServiceChatThreadMeta = {
  id: string;
  hostUserId: string;
  targetUserId: string;
  localRepliesEnabled: boolean;
  globalRepliesAllowed: boolean;
};

export async function getServiceChatThread(chatId: string): Promise<ServiceChatThreadMeta | null> {
  const res = await apiFetch(`${API}/service-chat/chats/${encodeURIComponent(chatId)}`);
  if (!res.ok) return null;
  const data = (await res.json()) as { thread?: ServiceChatThreadMeta | null };
  return data.thread ?? null;
}

export async function setServiceChatLocalReplies(chatId: string, enabled: boolean): Promise<void> {
  const res = await apiFetch(`${API}/service-chat/chats/${encodeURIComponent(chatId)}/local-replies`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message || "Не удалось изменить обратную связь");
  }
}

export async function deleteChatForMe(chatId: string): Promise<void> {
  const res = await apiFetch(`${API}/chats/${encodeURIComponent(chatId)}/me`, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message || "Не удалось выйти из чата");
  }
}

export async function deleteChatForEveryone(chatId: string): Promise<void> {
  const res = await apiFetch(`${API}/chats/${encodeURIComponent(chatId)}/for-all`, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message || "Не удалось удалить чат");
  }
}

export async function updateChat(
  chatId: string,
  data: { name?: string; avatarUrl?: string }
): Promise<{ id: string; name: string | null; avatarUrl: string | null }> {
  const res = await apiFetch(`${API}/chats/${encodeURIComponent(chatId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message || "Не удалось обновить чат");
  }
  return res.json();
}

export async function addGroupMember(
  chatId: string,
  userId: string
): Promise<{ id: string; type: string; name: string | null; members?: unknown[]; myRole?: string }> {
  const res = await apiFetch(`${API}/chats/${encodeURIComponent(chatId)}/members`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message || "Не удалось добавить участника");
  }
  return res.json();
}

export async function removeGroupMember(
  chatId: string,
  userId: string
): Promise<{ id: string; type: string; name: string | null; members?: unknown[]; myRole?: string }> {
  const res = await apiFetch(`${API}/chats/${encodeURIComponent(chatId)}/members/${encodeURIComponent(userId)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message || "Не удалось исключить участника");
  }
  return res.json();
}

export type ChatFolder = {
  id: string;
  chatId: string;
  name: string;
  isMain: boolean;
  orderIndex: number;
  createdAt: string;
  unreadCount?: number;
  messageCount?: number;
};

export async function listChatFolders(chatId: string): Promise<ChatFolder[]> {
  const res = await apiFetch(`${API}/chats/${encodeURIComponent(chatId)}/folders`);
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function createChatFolder(chatId: string, name: string): Promise<ChatFolder> {
  const res = await apiFetch(`${API}/chats/${encodeURIComponent(chatId)}/folders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message || "Не удалось создать папку");
  }
  return res.json();
}

export async function updateChatFolder(chatId: string, folderId: string, name: string): Promise<ChatFolder> {
  const res = await apiFetch(`${API}/chats/${encodeURIComponent(chatId)}/folders/${encodeURIComponent(folderId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message || "Не удалось переименовать");
  }
  return res.json();
}

export async function deleteChatFolder(chatId: string, folderId: string): Promise<void> {
  const res = await apiFetch(`${API}/chats/${encodeURIComponent(chatId)}/folders/${encodeURIComponent(folderId)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message || "Не удалось удалить папку");
  }
}

export async function sendMessage(
  chatId: string,
  payload: { content: string; type?: MessageType; folderId?: string; replyToId?: string; forwardedFromMessageId?: string; originalChatId?: string; scheduledAt?: string }
): Promise<ChatMessage> {
  const body: { content: string; type: string; folderId?: string; replyToId?: string; forwardedFromMessageId?: string; originalChatId?: string; scheduledAt?: string } = {
    content: payload.content,
    type: payload.type ?? "text",
  };
  if (payload.folderId) body.folderId = payload.folderId;
  if (payload.replyToId) body.replyToId = payload.replyToId;
  if (payload.forwardedFromMessageId && payload.originalChatId) {
    body.forwardedFromMessageId = payload.forwardedFromMessageId;
    body.originalChatId = payload.originalChatId;
  }
  if (payload.scheduledAt) body.scheduledAt = payload.scheduledAt;
  const res = await apiFetch(`${API}/chats/${encodeURIComponent(chatId)}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = (err as { message?: string }).message || "Не удалось отправить";
    throw new ChatRequestError(msg, res.status);
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
    if (res.status === 413) {
      throw new Error("Файл слишком большой: фото до 50 МБ, видео до 500 МБ.");
    }
    const errJson = await res.json().catch(() => null);
    const errText = errJson && typeof errJson === "object" && "message" in errJson
      ? String((errJson as { message?: unknown }).message ?? "")
      : "";
    throw new Error(errText || "Не удалось загрузить файл");
  }
  const data = (await res.json()) as { url: string };
  return data.url;
}

export type ReplySnapshot = { id: string; senderId: string | null; type: string; content: string };

export type ReactionItem = { emoji: string; count: number };

export type ChatMessage = {
  id: string;
  chatId: string;
  folderId?: string | null;
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
