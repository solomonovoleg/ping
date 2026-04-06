import { fetchUpstreamEdgeServicePath } from "./upstream-client";

export type MoneyChatAccrualTargetDto = { edgeId: string; threshold: number };

export async function fetchMoneyChatAccrualTargetsFromEdge(platformUserId: string): Promise<MoneyChatAccrualTargetDto[] | null> {
  const u = platformUserId.trim();
  if (!u) return [];
  const qs = new URLSearchParams({ platformUserId: u });
  try {
    const up = await fetchUpstreamEdgeServicePath(`/v1/money/chat-accrual-targets?${qs}`, { method: "GET" });
    if (!up.ok || up.status < 200 || up.status >= 300) return null;
    const j = JSON.parse(up.body) as { targets?: unknown };
    const arr = Array.isArray(j.targets) ? j.targets : [];
    const out: MoneyChatAccrualTargetDto[] = [];
    for (const x of arr) {
      if (!x || typeof x !== "object") continue;
      const o = x as Record<string, unknown>;
      const edgeId = typeof o.edgeId === "string" ? o.edgeId.trim() : "";
      const threshold = Number(o.threshold);
      if (!edgeId || !Number.isFinite(threshold) || threshold < 1) continue;
      out.push({ edgeId, threshold: Math.floor(threshold) });
    }
    return out;
  } catch {
    return null;
  }
}
