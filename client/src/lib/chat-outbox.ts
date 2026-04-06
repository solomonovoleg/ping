/**
 * Очередь исходящих сообщений офлайн: текст и голос → IndexedDB, отправка при появлении сети.
 */
import { sendMessage, uploadChatMediaWithMeta, uploadVoice, ChatRequestError, type ChatMessage } from "@/lib/chat";
import { getAuthToken } from "@/lib/api-base";
import type { ApiMessage } from "@/features/chat/types";

const DB_NAME = "ping_chat_outbox";
const DB_VERSION = 1;
const STORE = "items";

const MAX_QUEUE_ITEMS = 80;
const MAX_VOICE_BYTES = 4 * 1024 * 1024;
const MAX_VIDEO_NOTE_BYTES = 64 * 1024 * 1024;

export const CHAT_OUTBOX_FLUSHED = "ping:chat-outbox-flushed";

export type ChatOutboxFlushedDetail = {
  chatId: string;
  localId: string;
  message: ChatMessage;
};

type OutboxRow = {
  localId: string;
  chatId: string;
  userId: string;
  folderId?: string;
  replyToId?: string;
  kind: "text" | "voice" | "video_note";
  createdAtMs: number;
  text?: string;
  voiceMime?: string;
  voiceBuffer?: ArrayBuffer;
  videoMime?: string;
  videoBuffer?: ArrayBuffer;
};

const objectUrlByLocalId = new Map<string, string>();

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onerror = () => resolve(null);
      req.onsuccess = () => resolve(req.result);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "localId" });
        }
      };
    } catch {
      resolve(null);
    }
  });
}

function idbReq<T>(req: IDBRequest<T>): Promise<T | null> {
  return new Promise((resolve) => {
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => resolve(null);
  });
}

/** Эвристика: navigator.onLine не гарантирует доступ до API, но отсекает явный офлайн. */
export function isLikelyOnline(): boolean {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine !== false;
}

export function newOutboxLocalId(): string {
  const c = globalThis.crypto?.randomUUID?.();
  return c ? `obq-${c}` : `obq-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function isOutboxMessageId(id: string): boolean {
  return id.startsWith("obq-");
}

async function countAll(db: IDBDatabase): Promise<number> {
  const tx = db.transaction(STORE, "readonly");
  const store = tx.objectStore(STORE);
  const r = await idbReq(store.count());
  return typeof r === "number" ? r : 0;
}

export async function enqueueOutboxText(params: {
  localId: string;
  chatId: string;
  userId: string;
  folderId?: string | null;
  replyToId?: string | null;
  text: string;
}): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;
  if ((await countAll(db)) >= MAX_QUEUE_ITEMS) return false;
  const row: OutboxRow = {
    localId: params.localId,
    chatId: params.chatId,
    userId: params.userId,
    folderId: params.folderId ?? undefined,
    replyToId: params.replyToId ?? undefined,
    kind: "text",
    createdAtMs: Date.now(),
    text: params.text,
  };
  const tx = db.transaction(STORE, "readwrite");
  await idbReq(tx.objectStore(STORE).put(row));
  return true;
}

export async function enqueueOutboxVoice(params: {
  localId: string;
  chatId: string;
  userId: string;
  folderId?: string | null;
  blob: Blob;
}): Promise<boolean> {
  if (params.blob.size > MAX_VOICE_BYTES) return false;
  const db = await openDb();
  if (!db) return false;
  if ((await countAll(db)) >= MAX_QUEUE_ITEMS) return false;
  const voiceBuffer = await params.blob.arrayBuffer();
  const row: OutboxRow = {
    localId: params.localId,
    chatId: params.chatId,
    userId: params.userId,
    folderId: params.folderId ?? undefined,
    kind: "voice",
    createdAtMs: Date.now(),
    voiceMime: params.blob.type || "audio/webm",
    voiceBuffer,
  };
  const tx = db.transaction(STORE, "readwrite");
  await idbReq(tx.objectStore(STORE).put(row));
  return true;
}

export async function enqueueOutboxVideoNote(params: {
  localId: string;
  chatId: string;
  userId: string;
  folderId?: string | null;
  blob: Blob;
}): Promise<boolean> {
  if (params.blob.size > MAX_VIDEO_NOTE_BYTES) return false;
  const db = await openDb();
  if (!db) return false;
  if ((await countAll(db)) >= MAX_QUEUE_ITEMS) return false;
  const videoBuffer = await params.blob.arrayBuffer();
  const row: OutboxRow = {
    localId: params.localId,
    chatId: params.chatId,
    userId: params.userId,
    folderId: params.folderId ?? undefined,
    kind: "video_note",
    createdAtMs: Date.now(),
    videoMime: params.blob.type || "video/webm",
    videoBuffer,
  };
  const tx = db.transaction(STORE, "readwrite");
  await idbReq(tx.objectStore(STORE).put(row));
  return true;
}

async function listAllRows(db: IDBDatabase): Promise<OutboxRow[]> {
  const tx = db.transaction(STORE, "readonly");
  const store = tx.objectStore(STORE);
  const r = await idbReq(store.getAll());
  return Array.isArray(r) ? (r as OutboxRow[]) : [];
}

export async function removeOutboxItem(localId: string): Promise<void> {
  const url = objectUrlByLocalId.get(localId);
  if (url) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
    objectUrlByLocalId.delete(localId);
  }
  const db = await openDb();
  if (!db) return;
  const tx = db.transaction(STORE, "readwrite");
  await idbReq(tx.objectStore(STORE).delete(localId));
}

function registerOutboxDisplayUrl(localId: string, url: string): void {
  const prev = objectUrlByLocalId.get(localId);
  if (prev && prev !== url) {
    try {
      URL.revokeObjectURL(prev);
    } catch {
      /* ignore */
    }
  }
  objectUrlByLocalId.set(localId, url);
}

/** Сообщения из очереди для отображения в ленте (после перезахода в чат). */
export async function getPendingApiMessagesForChat(
  chatId: string,
  userId: string,
  activeFolderId?: string | null
): Promise<ApiMessage[]> {
  const db = await openDb();
  if (!db) return [];
  const rows = await listAllRows(db);
  const out: ApiMessage[] = [];
  for (const r of rows) {
    if (r.chatId !== chatId || r.userId !== userId) continue;
    if (activeFolderId != null && activeFolderId !== "") {
      if (r.folderId != null && r.folderId !== activeFolderId) continue;
    }
    const iso = new Date(r.createdAtMs).toISOString();
    if (r.kind === "text" && r.text) {
      out.push({
        id: r.localId,
        chatId,
        senderId: userId,
        type: "text",
        content: r.text,
        replyToId: r.replyToId ?? undefined,
        createdAt: iso,
        sendStatus: "sending",
      });
    } else if (r.kind === "voice" && r.voiceBuffer) {
      const blob = new Blob([r.voiceBuffer], { type: r.voiceMime || "audio/webm" });
      const url = URL.createObjectURL(blob);
      registerOutboxDisplayUrl(r.localId, url);
      out.push({
        id: r.localId,
        chatId,
        senderId: userId,
        type: "voice",
        content: url,
        createdAt: iso,
        sendStatus: "sending",
      });
    } else if (r.kind === "video_note" && r.videoBuffer) {
      const blob = new Blob([r.videoBuffer], { type: r.videoMime || "video/webm" });
      const url = URL.createObjectURL(blob);
      registerOutboxDisplayUrl(r.localId, url);
      out.push({
        id: r.localId,
        chatId,
        senderId: userId,
        type: "video_note",
        content: url,
        createdAt: iso,
        sendStatus: "sending",
      });
    }
  }
  out.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  return out;
}

/** Подмешать неотправленные из IndexedDB к списку с сервера (сортировка по времени). */
export async function mergeOutboxIntoServerList(
  chatId: string,
  userId: string,
  serverList: ApiMessage[],
  activeFolderId?: string | null
): Promise<ApiMessage[]> {
  const pending = await getPendingApiMessagesForChat(chatId, userId, activeFolderId);
  if (pending.length === 0) return serverList;
  const seen = new Set(serverList.map((m) => m.id));
  const extra = pending.filter((p) => !seen.has(p.id));
  if (extra.length === 0) return serverList;
  return [...serverList, ...extra].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}

function dispatchFlushed(chatId: string, localId: string, message: ChatMessage): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<ChatOutboxFlushedDetail>(CHAT_OUTBOX_FLUSHED, {
      detail: { chatId, localId, message },
    })
  );
}

let flushInFlight = false;

export async function flushChatOutbox(): Promise<void> {
  if (!isLikelyOnline() || !getAuthToken() || flushInFlight) return;
  flushInFlight = true;
  try {
    const db = await openDb();
    if (!db) return;
    const rows = (await listAllRows(db)).sort((a, b) => a.createdAtMs - b.createdAtMs);
    for (const row of rows) {
      try {
        if (row.kind === "text" && row.text) {
          const sent = await sendMessage(row.chatId, {
            content: row.text,
            folderId: row.folderId,
            replyToId: row.replyToId,
          });
          await removeOutboxItem(row.localId);
          dispatchFlushed(row.chatId, row.localId, sent);
        } else if (row.kind === "voice" && row.voiceBuffer) {
          const blob = new Blob([row.voiceBuffer], { type: row.voiceMime || "audio/webm" });
          const url = await uploadVoice(blob);
          const sent = await sendMessage(row.chatId, {
            type: "voice",
            content: url,
            folderId: row.folderId,
          });
          await removeOutboxItem(row.localId);
          dispatchFlushed(row.chatId, row.localId, sent);
        } else if (row.kind === "video_note" && row.videoBuffer) {
          const blob = new Blob([row.videoBuffer], { type: row.videoMime || "video/webm" });
          const type = blob.type || "video/webm";
          const file = new File([blob], type.includes("mp4") ? "video-note.mp4" : "video-note.webm", { type });
          const uploaded = await uploadChatMediaWithMeta(file);
          const sent = await sendMessage(row.chatId, {
            type: "video_note",
            content: uploaded.url,
            folderId: row.folderId,
          });
          await removeOutboxItem(row.localId);
          dispatchFlushed(row.chatId, row.localId, sent);
        }
      } catch (e) {
        if (
          e instanceof ChatRequestError &&
          e.status === 403 &&
          e.message.includes("ограничил вам переписку")
        ) {
          await removeOutboxItem(row.localId);
        }
        break;
      }
    }
  } finally {
    flushInFlight = false;
  }
}

let outboxListenersStarted = false;

export function ensureChatOutboxOnlineFlush(): void {
  if (typeof window === "undefined" || outboxListenersStarted) return;
  outboxListenersStarted = true;
  window.addEventListener("online", () => {
    void flushChatOutbox();
  });
  window.setInterval(() => {
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
    if (isLikelyOnline()) void flushChatOutbox();
  }, 25_000);
}
