import { apiFetch } from "@/lib/api-base";

const DB_NAME = "ping_media_cache";
const DB_VERSION = 1;
const STORE = "items";

const MAX_CACHE_ITEMS = 120;
const MAX_CACHE_BYTES = 180 * 1024 * 1024;

type MediaCacheRow = {
  url: string;
  blob: Blob;
  sizeBytes: number;
  contentType: string;
  createdAtMs: number;
  lastAccessedAtMs: number;
};

const objectUrlBySource = new Map<string, string>();

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
          db.createObjectStore(STORE, { keyPath: "url" });
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

function normalizeUrl(url: string): string {
  return typeof url === "string" ? url.trim() : "";
}

function registerObjectUrl(sourceUrl: string, blob: Blob): string {
  const prev = objectUrlBySource.get(sourceUrl);
  if (prev) return prev;
  const objectUrl = URL.createObjectURL(blob);
  objectUrlBySource.set(sourceUrl, objectUrl);
  return objectUrl;
}

async function touchRow(db: IDBDatabase, row: MediaCacheRow): Promise<void> {
  const tx = db.transaction(STORE, "readwrite");
  await idbReq(
    tx.objectStore(STORE).put({
      ...row,
      lastAccessedAtMs: Date.now(),
    } satisfies MediaCacheRow)
  );
}

async function pruneCache(db: IDBDatabase): Promise<void> {
  const tx = db.transaction(STORE, "readwrite");
  const store = tx.objectStore(STORE);
  const rows = ((await idbReq(store.getAll())) as MediaCacheRow[] | null) ?? [];
  if (rows.length <= MAX_CACHE_ITEMS) {
    const total = rows.reduce((sum, row) => sum + (row.sizeBytes || 0), 0);
    if (total <= MAX_CACHE_BYTES) return;
  }
  rows.sort((a, b) => a.lastAccessedAtMs - b.lastAccessedAtMs);
  let totalBytes = rows.reduce((sum, row) => sum + (row.sizeBytes || 0), 0);
  while (rows.length > MAX_CACHE_ITEMS || totalBytes > MAX_CACHE_BYTES) {
    const row = rows.shift();
    if (!row) break;
    totalBytes -= row.sizeBytes || 0;
    await idbReq(store.delete(row.url));
    const objectUrl = objectUrlBySource.get(row.url);
    if (objectUrl) {
      try {
        URL.revokeObjectURL(objectUrl);
      } catch {
        /* ignore */
      }
      objectUrlBySource.delete(row.url);
    }
  }
}

export async function getCachedMediaObjectUrl(url: string): Promise<string | null> {
  const normalized = normalizeUrl(url);
  if (!normalized || normalized.startsWith("blob:") || normalized.startsWith("data:")) {
    return normalized || null;
  }
  const objectUrl = objectUrlBySource.get(normalized);
  if (objectUrl) return objectUrl;
  const db = await openDb();
  if (!db) return null;
  const tx = db.transaction(STORE, "readonly");
  const row = (await idbReq(tx.objectStore(STORE).get(normalized))) as MediaCacheRow | null;
  if (!row?.blob) return null;
  void touchRow(db, row);
  return registerObjectUrl(normalized, row.blob);
}

/** Удалить весь локальный кэш медиа (IndexedDB + object URLs). Не трогает очередь исходящих сообщений. */
export async function clearMediaOfflineCache(): Promise<{ clearedRows: number } | null> {
  const db = await openDb();
  if (!db) return null;
  const tx = db.transaction(STORE, "readwrite");
  const store = tx.objectStore(STORE);
  const rows = ((await idbReq(store.getAll())) as MediaCacheRow[] | null) ?? [];
  const clearedRows = rows.length;
  for (const row of rows) {
    const objectUrl = objectUrlBySource.get(row.url);
    if (objectUrl) {
      try {
        URL.revokeObjectURL(objectUrl);
      } catch {
        /* ignore */
      }
      objectUrlBySource.delete(row.url);
    }
    await idbReq(store.delete(row.url));
  }
  return { clearedRows };
}

export async function ensureMediaCached(url: string): Promise<string | null> {
  const normalized = normalizeUrl(url);
  if (!normalized || normalized.startsWith("blob:") || normalized.startsWith("data:")) {
    return normalized || null;
  }
  const cached = await getCachedMediaObjectUrl(normalized);
  if (cached) return cached;
  const db = await openDb();
  if (!db) return null;
  try {
    const res = await apiFetch(normalized, { cache: "no-store" });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob || blob.size <= 0) return null;
    const row: MediaCacheRow = {
      url: normalized,
      blob,
      sizeBytes: blob.size,
      contentType: blob.type || "application/octet-stream",
      createdAtMs: Date.now(),
      lastAccessedAtMs: Date.now(),
    };
    const tx = db.transaction(STORE, "readwrite");
    await idbReq(tx.objectStore(STORE).put(row));
    await pruneCache(db);
    return registerObjectUrl(normalized, blob);
  } catch {
    return null;
  }
}
