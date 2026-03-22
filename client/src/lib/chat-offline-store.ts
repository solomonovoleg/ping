import type { ApiChat, ApiMessage } from "@/features/chat";
type OfflineChatFolder = {
  id: string;
  name: string;
  isMain: boolean;
  orderIndex: number;
  unreadCount?: number;
  messageCount?: number;
};


const DB_NAME = "ping_chat_offline";
const DB_VERSION = 1;
const CHAT_LISTS_STORE = "chat_lists";
const CHAT_DETAILS_STORE = "chat_details";
const CHAT_MESSAGES_STORE = "chat_messages";

const MAX_MESSAGES_PER_BUCKET = 140;

type ChatListScope = "all" | "hidden";

type ChatListRow = {
  scope: ChatListScope;
  chats: ApiChat[];
  updatedAtMs: number;
};

type ChatDetailsRow = {
  chatId: string;
  chat: ApiChat;
  folders: OfflineChatFolder[];
  currentFolderId: string | null;
  updatedAtMs: number;
};

type ChatMessagesRow = {
  key: string;
  chatId: string;
  folderId: string | null;
  messages: ApiMessage[];
  updatedAtMs: number;
};

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onerror = () => resolve(null);
      req.onsuccess = () => resolve(req.result);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(CHAT_LISTS_STORE)) {
          db.createObjectStore(CHAT_LISTS_STORE, { keyPath: "scope" });
        }
        if (!db.objectStoreNames.contains(CHAT_DETAILS_STORE)) {
          db.createObjectStore(CHAT_DETAILS_STORE, { keyPath: "chatId" });
        }
        if (!db.objectStoreNames.contains(CHAT_MESSAGES_STORE)) {
          db.createObjectStore(CHAT_MESSAGES_STORE, { keyPath: "key" });
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

function buildMessagesKey(chatId: string, folderId?: string | null): string {
  return `${chatId}::${folderId ?? "__main__"}`;
}

function normalizeMessages(messages: ApiMessage[]): ApiMessage[] {
  const byId = new Map<string, ApiMessage>();
  for (const message of messages) {
    if (!message?.id) continue;
    byId.set(message.id, message);
  }
  return Array.from(byId.values())
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .slice(-MAX_MESSAGES_PER_BUCKET);
}

export async function saveOfflineChatList(scope: ChatListScope, chats: ApiChat[]): Promise<void> {
  const db = await openDb();
  if (!db) return;
  const row: ChatListRow = {
    scope,
    chats: Array.isArray(chats) ? chats : [],
    updatedAtMs: Date.now(),
  };
  const tx = db.transaction(CHAT_LISTS_STORE, "readwrite");
  await idbReq(tx.objectStore(CHAT_LISTS_STORE).put(row));
}

export async function getOfflineChatList(scope: ChatListScope): Promise<ApiChat[]> {
  const db = await openDb();
  if (!db) return [];
  const tx = db.transaction(CHAT_LISTS_STORE, "readonly");
  const row = await idbReq(tx.objectStore(CHAT_LISTS_STORE).get(scope));
  const chats = (row as ChatListRow | null)?.chats;
  return Array.isArray(chats) ? chats : [];
}

export async function saveOfflineChatDetails(
  chatId: string,
  chat: ApiChat,
  folders: OfflineChatFolder[],
  currentFolderId?: string | null
): Promise<void> {
  const db = await openDb();
  if (!db) return;
  const row: ChatDetailsRow = {
    chatId,
    chat,
    folders: Array.isArray(folders) ? folders : [],
    currentFolderId: currentFolderId ?? null,
    updatedAtMs: Date.now(),
  };
  const tx = db.transaction(CHAT_DETAILS_STORE, "readwrite");
  await idbReq(tx.objectStore(CHAT_DETAILS_STORE).put(row));
}

export async function getOfflineChatDetails(
  chatId: string
): Promise<{ chat: ApiChat | null; folders: OfflineChatFolder[]; currentFolderId: string | null }> {
  const db = await openDb();
  if (!db) return { chat: null, folders: [], currentFolderId: null };
  const tx = db.transaction(CHAT_DETAILS_STORE, "readonly");
  const row = (await idbReq(tx.objectStore(CHAT_DETAILS_STORE).get(chatId))) as ChatDetailsRow | null;
  return {
    chat: row?.chat ?? null,
    folders: Array.isArray(row?.folders) ? row!.folders : [],
    currentFolderId: row?.currentFolderId ?? null,
  };
}

export async function saveOfflineMessages(
  chatId: string,
  folderId: string | null | undefined,
  messages: ApiMessage[]
): Promise<void> {
  const db = await openDb();
  if (!db) return;
  const row: ChatMessagesRow = {
    key: buildMessagesKey(chatId, folderId),
    chatId,
    folderId: folderId ?? null,
    messages: normalizeMessages(messages),
    updatedAtMs: Date.now(),
  };
  const tx = db.transaction(CHAT_MESSAGES_STORE, "readwrite");
  await idbReq(tx.objectStore(CHAT_MESSAGES_STORE).put(row));
}

export async function getOfflineMessages(
  chatId: string,
  folderId?: string | null
): Promise<ApiMessage[]> {
  const db = await openDb();
  if (!db) return [];
  const tx = db.transaction(CHAT_MESSAGES_STORE, "readonly");
  const row = (await idbReq(
    tx.objectStore(CHAT_MESSAGES_STORE).get(buildMessagesKey(chatId, folderId))
  )) as ChatMessagesRow | null;
  return Array.isArray(row?.messages) ? row!.messages : [];
}

export async function getOfflineChatSnapshot(
  chatId: string,
  folderId?: string | null
): Promise<{ chat: ApiChat | null; folders: OfflineChatFolder[]; currentFolderId: string | null; messages: ApiMessage[] }> {
  const [details, messages] = await Promise.all([
    getOfflineChatDetails(chatId),
    getOfflineMessages(chatId, folderId),
  ]);
  return {
    chat: details.chat,
    folders: details.folders,
    currentFolderId: details.currentFolderId,
    messages,
  };
}
