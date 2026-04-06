import { API, apiFetch } from "@/lib/api-base";

function errorMessageFromApiBody(text: string, fallback: string): string {
  try {
    const j = JSON.parse(text) as { error?: unknown; message?: unknown };
    if (typeof j.error === "string" && j.error.trim()) return j.error.trim();
    if (typeof j.message === "string" && j.message.trim()) return j.message.trim();
  } catch {
    /* raw text */
  }
  const t = text.trim();
  return t || fallback;
}

export type EdgeMoneyInviteProgress = {
  edgeId: string;
  inviteTaskEnabled: boolean;
  pointsAwardedForInviteTask: number;
  pointsPerThreshold: number;
  threshold: number;
  batchId: string | null;
  slotCount: number;
  codesIssuedInOpenBatch: number;
  registrationsFromOpenBatchCodes: number;
  canRequestNewBatch: boolean;
  pendingReason?: string;
};

export async function fetchEdgeMoneyInviteProgress(edgeId: string): Promise<EdgeMoneyInviteProgress> {
  const id = edgeId.trim();
  const qs = new URLSearchParams({ edgeId: id });
  const res = await apiFetch(`${API}/edge/money/invite-progress?${qs}`, {
    method: "GET",
    credentials: "include",
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(errorMessageFromApiBody(text, res.statusText || `${res.status}`));
  }
  return JSON.parse(text) as EdgeMoneyInviteProgress;
}

export type PostEdgeMoneyInvitePackResult = {
  ok: boolean;
  chatId: string;
  batchId: string;
  codesCount: number;
  hint?: string;
};

export async function postEdgeMoneyInvitePack(edgeId: string): Promise<PostEdgeMoneyInvitePackResult> {
  const id = edgeId.trim();
  const qs = new URLSearchParams({ edgeId: id });
  const res = await apiFetch(`${API}/edge/money/ping-invite-pack?${qs}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(errorMessageFromApiBody(text, res.statusText));
  }
  return JSON.parse(text) as PostEdgeMoneyInvitePackResult;
}
