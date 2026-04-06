import { fetchUpstreamEdgeServicePath } from "./upstream-client";

export async function fetchMoneyInviteGrantsSumFromEdge(
  edgeId: string,
  platformUserId: string,
): Promise<number | null> {
  const e = edgeId.trim();
  const u = platformUserId.trim();
  if (!e || !u) return null;
  const qs = new URLSearchParams({ edgeId: e, platformUserId: u });
  try {
    const up = await fetchUpstreamEdgeServicePath(`/v1/money/invite-grants-sum?${qs}`, { method: "GET" });
    if (!up.ok || up.status < 200 || up.status >= 300) return null;
    const j = JSON.parse(up.body) as { pointsAwardedForInviteTask?: unknown };
    const n = j.pointsAwardedForInviteTask;
    return typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  } catch {
    return null;
  }
}
