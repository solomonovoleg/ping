import { API, apiFetch } from "@/lib/api-base";

export type GroupCallMedia = "audio" | "video";

export async function createGroupCallRoom(chatId: string, mediaType: GroupCallMedia): Promise<{
  roomId: string;
  mediaType: GroupCallMedia;
  reused: boolean;
  hostUserId?: string;
  maxMeshPeers?: number;
}> {
  const res = await apiFetch(`${API}/group-calls/rooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chatId, mediaType }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { message?: string };
    const fallback =
      res.status === 404
        ? "Групповые звонки выключены на сервере (GROUP_CALLS_ENABLED=1 в .env)"
        : res.status === 403
          ? "Нет доступа к этому чату"
          : res.status === 400
            ? "Некорректный запрос (нужен групповой чат)"
            : "Не удалось создать групповой звонок";
    throw new Error((err?.message && String(err.message).trim()) || fallback);
  }
  return res.json() as Promise<{
    roomId: string;
    mediaType: GroupCallMedia;
    reused: boolean;
    hostUserId?: string;
    maxMeshPeers?: number;
  }>;
}

export async function fetchActiveGroupCall(chatId: string): Promise<
  | { active: false }
  | {
      active: true;
      roomId: string;
      mediaType: GroupCallMedia;
      participantCount: number;
      hostUserId?: string;
      maxMeshPeers?: number;
    }
> {
  const res = await apiFetch(`${API}/group-calls/chats/${encodeURIComponent(chatId)}/active`);
  if (!res.ok) return { active: false };
  return res.json() as Promise<
    | { active: false }
    | {
        active: true;
        roomId: string;
        mediaType: GroupCallMedia;
        participantCount: number;
        hostUserId?: string;
        maxMeshPeers?: number;
      }
  >;
}
