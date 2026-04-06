import { API, apiFetch } from "@/lib/api-base";

export type EdgeMoneyTaskProgressInviteDto = {
  codesIssuedInOpenBatch: number;
  registrationsFromOpenBatchCodes: number;
  pointsAwardedForInviteTask: number;
  pointsPerThreshold: number;
  threshold: number;
};

export type EdgeMoneyTaskProgressItemDto = {
  kind: string;
  ruleId: string;
  threshold: number;
  points: number;
  trackingActive: boolean;
  ratio: number | null;
  label: string;
  detail: string;
  invite?: EdgeMoneyTaskProgressInviteDto;
  followCompleted?: boolean;
};

export type EdgeMoneyTaskProgressResponseDto = {
  edgeId: string;
  trackingStarted: boolean;
  updatedAt: string;
  tasks: EdgeMoneyTaskProgressItemDto[];
};

export async function fetchEdgeMoneyTaskProgress(edgeId: string): Promise<EdgeMoneyTaskProgressResponseDto> {
  const id = edgeId.trim();
  if (!id) throw new Error("Не указан edgeId.");
  const qs = new URLSearchParams({ edgeId: id });
  const res = await apiFetch(`${API}/edge/money/task-progress?${qs}`, {
    method: "GET",
    credentials: "include",
  });
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(text || `${res.status}`);
  }
  return (await res.json()) as EdgeMoneyTaskProgressResponseDto;
}
