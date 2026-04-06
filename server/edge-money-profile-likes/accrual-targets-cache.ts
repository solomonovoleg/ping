import { fetchMoneyProfileLikeAccrualTargetsFromEdge } from "../edge/fetch-money-profile-like-accrual-targets";
import type { MoneyProfileLikeAccrualTargetDto } from "../edge/fetch-money-profile-like-accrual-targets";

const TTL_MS = 45_000;
const cache = new Map<string, { expires: number; targets: MoneyProfileLikeAccrualTargetDto[] }>();

export async function getMoneyProfileLikeAccrualTargetsCached(
  platformUserId: string,
): Promise<MoneyProfileLikeAccrualTargetDto[]> {
  const u = platformUserId.trim();
  if (!u) return [];
  const now = Date.now();
  const hit = cache.get(u);
  if (hit && hit.expires > now) return hit.targets;
  const fresh = await fetchMoneyProfileLikeAccrualTargetsFromEdge(u);
  if (fresh === null) {
    if (hit) return hit.targets;
    return [];
  }
  cache.set(u, { expires: now + TTL_MS, targets: fresh });
  return fresh;
}
