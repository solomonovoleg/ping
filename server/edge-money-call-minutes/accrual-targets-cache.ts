import { fetchMoneyCallAccrualTargetsFromEdge } from "../edge/fetch-money-call-accrual-targets";
import type { MoneyCallAccrualTargetDto } from "../edge/fetch-money-call-accrual-targets";

const TTL_MS = 45_000;
const cache = new Map<string, { expires: number; targets: MoneyCallAccrualTargetDto[] }>();

export async function getMoneyCallAccrualTargetsCached(platformUserId: string): Promise<MoneyCallAccrualTargetDto[]> {
  const u = platformUserId.trim();
  if (!u) return [];
  const now = Date.now();
  const hit = cache.get(u);
  if (hit && hit.expires > now) return hit.targets;
  const fresh = await fetchMoneyCallAccrualTargetsFromEdge(u);
  if (fresh === null) {
    if (hit) return hit.targets;
    return [];
  }
  cache.set(u, { expires: now + TTL_MS, targets: fresh });
  return fresh;
}
