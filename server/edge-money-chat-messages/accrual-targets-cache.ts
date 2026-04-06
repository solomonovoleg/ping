import { fetchMoneyChatAccrualTargetsFromEdge } from "../edge/fetch-money-chat-accrual-targets";
import type { MoneyChatAccrualTargetDto } from "../edge/fetch-money-chat-accrual-targets";

const TTL_MS = 45_000;
const cache = new Map<string, { expires: number; targets: MoneyChatAccrualTargetDto[] }>();

export async function getMoneyChatAccrualTargetsCached(platformUserId: string): Promise<MoneyChatAccrualTargetDto[]> {
  const u = platformUserId.trim();
  if (!u) return [];
  const now = Date.now();
  const hit = cache.get(u);
  if (hit && hit.expires > now) return hit.targets;
  const fresh = await fetchMoneyChatAccrualTargetsFromEdge(u);
  if (fresh === null) {
    if (hit) return hit.targets;
    return [];
  }
  cache.set(u, { expires: now + TTL_MS, targets: fresh });
  return fresh;
}
