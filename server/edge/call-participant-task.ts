import { fetchUpstreamParticipantPath, getEdgeUpstreamBase } from "./upstream-client";

export type EdgePlatformTaskKey = "view_post" | "react_post" | "share_post";

/** Сервер-сервер: начисление XP за действие в ленте (ошибки глотаем — EDGE опционален). */
export async function callEdgeParticipantTask(params: {
  platformUserId: string;
  edgeId: string;
  taskKey: EdgePlatformTaskKey;
  ref: string;
}): Promise<void> {
  if (!getEdgeUpstreamBase()) return;
  const qs = new URLSearchParams({ edgeId: params.edgeId.trim() });
  await fetchUpstreamParticipantPath(`/v1/participant/task?${qs}`, {
    method: "POST",
    platformUserId: params.platformUserId,
    body: JSON.stringify({ taskKey: params.taskKey, ref: params.ref }),
  });
}
