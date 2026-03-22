import { API, apiFetch } from "@/lib/api-base";

/** Конфиг кампании EDGE Companion (с платформы или заглушка до подключения внешнего сервиса). */
export type EdgeCompanionCampaignConfig = {
  status: "draft" | "published" | "paused" | "ended";
  title: string;
  gifts?: { templates?: unknown[] };
  leaderboard?: { globalEnabled?: boolean };
  followReward?: { enabled?: boolean };
  /** true — ответ с платформы без реального EDGE-бэкенда (превью UIX). */
  isStub?: boolean;
};

export async function fetchEdgeCompanionCampaignConfig(edgeId: string): Promise<EdgeCompanionCampaignConfig> {
  const id = edgeId.trim();
  if (!id) {
    throw new Error("Не указан идентификатор кампании (edgeId).");
  }
  const qs = new URLSearchParams({ edgeId: id });
  const res = await apiFetch(`${API}/edge/companion/campaign-config?${qs.toString()}`, {
    method: "GET",
    credentials: "include",
  });
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(text || `${res.status}`);
  }
  return (await res.json()) as EdgeCompanionCampaignConfig;
}
