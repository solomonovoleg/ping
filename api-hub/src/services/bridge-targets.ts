import * as repo from "../infra/db/repository.js";
import { getPool } from "../infra/db/pool.js";
import { store } from "../store/in-memory-store.js";

function dedupe(rows: Array<{ partnerId: string; pingUserId: string }>): Array<{
  partnerId: string;
  pingUserId: string;
}> {
  const seen = new Set<string>();
  const out: Array<{ partnerId: string; pingUserId: string }> = [];
  for (const r of rows) {
    const k = `${r.partnerId}:${r.pingUserId}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

export async function listBridgeNotifyTargets(
  memberPingUserIds: string[],
): Promise<Array<{ partnerId: string; pingUserId: string }>> {
  const ids = [...new Set(memberPingUserIds.filter((x) => typeof x === "string" && x.trim()))];
  if (ids.length === 0) return [];

  if (getPool()) {
    const rows = await repo.listActiveSessionsForBridgeTargets(ids);
    return dedupe(rows);
  }

  const out: Array<{ partnerId: string; pingUserId: string }> = [];
  for (const s of store.sessions.values()) {
    if (s.revokedAt) continue;
    if (!ids.includes(s.pingUserId)) continue;
    if (!s.scopes.includes("chat.read")) continue;
    out.push({ partnerId: s.partnerId, pingUserId: s.pingUserId });
  }
  return dedupe(out);
}
