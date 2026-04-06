import { fetchMoneyPostAccrualTargetsFromEdge } from "../edge/fetch-money-post-accrual-targets";
import type { MoneyPostAccrualTargetDto } from "../edge/fetch-money-post-accrual-targets";

const TTL_MS = 45_000;
const cache = new Map<string, { expires: number; targets: MoneyPostAccrualTargetDto[] }>();

export async function getMoneyPostAccrualTargetsCached(platformUserId: string): Promise<MoneyPostAccrualTargetDto[]> {
  const u = platformUserId.trim();
  if (!u) return [];
  const now = Date.now();
  const hit = cache.get(u);
  if (hit && hit.expires > now) return hit.targets;
  const fresh = await fetchMoneyPostAccrualTargetsFromEdge(u);
  if (fresh === null) {
    if (hit) return hit.targets;
    return [];
  }
  cache.set(u, { expires: now + TTL_MS, targets: fresh });
  return fresh;
}
