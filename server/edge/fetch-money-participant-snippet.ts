import { fetchUpstreamEdgeServicePath } from "./upstream-client";

export type MoneyParticipantSnippet = {
  followCreatorCompleted: boolean;
};

export async function fetchMoneyParticipantSnippetFromEdge(
  edgeId: string,
  platformUserId: string,
): Promise<MoneyParticipantSnippet | null> {
  const e = edgeId.trim();
  const u = platformUserId.trim();
  if (!e || !u) return null;
  const qs = new URLSearchParams({ edgeId: e, platformUserId: u });
  const up = await fetchUpstreamEdgeServicePath(`/v1/money/participant-snippet?${qs}`, { method: "GET" });
  if (!up.ok || up.status < 200 || up.status >= 300) return null;
  try {
    const j = JSON.parse(up.body) as { followCreatorCompleted?: unknown };
    return { followCreatorCompleted: j.followCreatorCompleted === true };
  } catch {
    return null;
  }
}
