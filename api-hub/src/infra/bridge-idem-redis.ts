import { createHash } from "node:crypto";
import { createClient, type RedisClientType } from "redis";
import { config } from "../config.js";

const TTL_SEC = 600;

let client: RedisClientType | null = null;

function redisStorageKey(rawKey: string): string {
  const h = createHash("sha256").update(rawKey).digest("hex");
  return `apihub:bridge:idem:${h}`;
}

async function getClient(): Promise<RedisClientType | null> {
  const url = config.redisUrl?.trim();
  if (!url) return null;
  if (client?.isOpen) return client;
  const c = createClient({ url });
  c.on("error", () => {});
  try {
    await c.connect();
    client = c as RedisClientType;
    return client;
  } catch {
    try {
      await c.disconnect();
    } catch {
      /* ignore */
    }
    return null;
  }
}

/**
 * При заданном `API_HUB_REDIS_URL` — атомарный SET NX (дедуп между инстансами).
 * @returns `redis_duplicate` — ключ уже есть; `redis_claimed` — мы владельцы ключа до TTL;
 *   `use_memory` — Redis недоступен или не настроен, использовать in-memory в маршруте.
 */
export async function bridgeIdemTryClaim(rawKey: string): Promise<
  "redis_duplicate" | "redis_claimed" | "use_memory"
> {
  try {
    const c = await getClient();
    if (!c) return "use_memory";
    const ok = await c.set(redisStorageKey(rawKey), "1", { EX: TTL_SEC, NX: true });
    return ok === "OK" ? "redis_claimed" : "redis_duplicate";
  } catch {
    return "use_memory";
  }
}

/** Снять блокировку идемпотентности после ошибки валидации (после успешного `redis_claimed`). */
export async function bridgeIdemRelease(rawKey: string): Promise<void> {
  try {
    const c = client?.isOpen ? client : await getClient();
    if (!c) return;
    await c.del(redisStorageKey(rawKey));
  } catch {
    /* ignore */
  }
}

export async function closeBridgeIdemRedis(): Promise<void> {
  if (!client?.isOpen) {
    client = null;
    return;
  }
  try {
    await client.quit();
  } catch {
    /* ignore */
  }
  client = null;
}
