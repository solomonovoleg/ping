import { API, apiFetch } from "@/lib/api-base";

export async function fetchEdgeMoneyTrackingStarted(edgeId: string): Promise<boolean> {
  const id = edgeId.trim();
  if (!id) return false;
  const qs = new URLSearchParams({ edgeId: id });
  const res = await apiFetch(`${API}/edge/money/tracking-started?${qs}`, {
    method: "GET",
    credentials: "include",
  });
  if (!res.ok) return false;
  const j = (await res.json()) as { started?: unknown };
  return j.started === true;
}

export async function postEdgeMoneyStartTracking(edgeId: string): Promise<void> {
  const id = edgeId.trim();
  if (!id) throw new Error("Не указан edgeId.");
  const res = await apiFetch(`${API}/edge/money/start-tracking`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ edgeId: id }),
  });
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(text || `${res.status}`);
  }
}
