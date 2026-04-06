import { fetchUpstreamEdgeServicePath, fetchUpstreamParticipantPath } from "./upstream-client";

export async function fetchMoneyTrackingStartedFromEdge(
  edgeId: string,
  platformUserId: string,
): Promise<boolean | null> {
  const e = edgeId.trim();
  const u = platformUserId.trim();
  if (!e || !u) return false;
  const qs = new URLSearchParams({ edgeId: e, platformUserId: u });
  const up = await fetchUpstreamEdgeServicePath(`/v1/money/tracking-started?${qs}`, { method: "GET" });
  if (!up.ok || up.status < 200 || up.status >= 300) return null;
  try {
    const j = JSON.parse(up.body) as { started?: unknown };
    return j.started === true;
  } catch {
    return null;
  }
}

export async function postMoneyStartTrackingUpstream(
  edgeId: string,
  platformUserId: string,
): Promise<{ ok: true } | { ok: false; status: number; body: string }> {
  const e = edgeId.trim();
  const u = platformUserId.trim();
  if (!e || !u) return { ok: false, status: 400, body: "bad_request" };
  const up = await fetchUpstreamParticipantPath("/v1/money/start-tracking", {
    method: "POST",
    platformUserId: u,
    body: JSON.stringify({ edgeId: e }),
  });
  if (!up.ok) return { ok: false, status: 503, body: "upstream_failed" };
  if (up.status >= 200 && up.status < 300) return { ok: true };
  return { ok: false, status: up.status, body: up.body };
}
