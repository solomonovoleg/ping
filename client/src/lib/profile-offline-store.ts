import type { OtherProfilePageData } from "@/features/profile/user-profile/queries/fetch-other-profile-page";

const DB_NAME = "ping_profile_offline";
const DB_VERSION = 1;
const STORE = "pages";
const MAX_ROWS = 40;

type Row = {
  routeKey: string;
  payloadJson: string;
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
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "routeKey" });
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

function normalizeRouteKey(routeKey: string): string {
  return routeKey.trim();
}

function parseRowPayload(json: string): OtherProfilePageData | null {
  try {
    const v = JSON.parse(json) as unknown;
    if (!v || typeof v !== "object") return null;
    const o = v as Record<string, unknown>;
    if (!o.profile || typeof o.profile !== "object") return null;
    return v as OtherProfilePageData;
  } catch {
    return null;
  }
}

async function pruneOldest(db: IDBDatabase): Promise<void> {
  const readTx = db.transaction(STORE, "readonly");
  const all = await idbReq(readTx.objectStore(STORE).getAll());
  if (!Array.isArray(all)) return;
  const rows = all as Row[];
  if (rows.length <= MAX_ROWS) return;
  const toDelete = rows
    .sort((a, b) => a.updatedAtMs - b.updatedAtMs)
    .slice(0, Math.max(0, rows.length - MAX_ROWS));
  for (const row of toDelete) {
    const tx = db.transaction(STORE, "readwrite");
    await idbReq(tx.objectStore(STORE).delete(row.routeKey));
  }
}

export async function saveOtherProfilePageCache(routeKey: string, data: OtherProfilePageData): Promise<void> {
  const db = await openDb();
  if (!db) return;
  const key = normalizeRouteKey(routeKey);
  if (!key) return;
  let payloadJson: string;
  try {
    payloadJson = JSON.stringify(data);
  } catch {
    return;
  }
  const row: Row = { routeKey: key, payloadJson, updatedAtMs: Date.now() };
  const tx = db.transaction(STORE, "readwrite");
  await idbReq(tx.objectStore(STORE).put(row));
  await pruneOldest(db);
}

export async function getOtherProfilePageCache(routeKey: string): Promise<OtherProfilePageData | null> {
  const db = await openDb();
  if (!db) return null;
  const key = normalizeRouteKey(routeKey);
  if (!key) return null;
  const tx = db.transaction(STORE, "readonly");
  const row = (await idbReq(tx.objectStore(STORE).get(key))) as Row | null;
  if (!row?.payloadJson) return null;
  return parseRowPayload(row.payloadJson);
}

export async function clearProfileOfflineStore(): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.objectStore(STORE).clear();
    } catch {
      resolve(false);
    }
  });
}
