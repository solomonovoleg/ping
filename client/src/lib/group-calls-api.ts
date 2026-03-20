import { API, apiFetch } from "@/lib/api-base";

export type GroupCallMedia = "audio" | "video";

export async function createGroupCallRoom(chatId: string, mediaType: GroupCallMedia): Promise<{
  roomId: string;
  mediaType: GroupCallMedia;
  reused: boolean;
}> {
  const res = await apiFetch(`${API}/group-calls/rooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chatId, mediaType }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(err?.message || "Не удалось создать групповой звонок");
  }
  return res.json() as Promise<{ roomId: string; mediaType: GroupCallMedia; reused: boolean }>;
}

export async function fetchActiveGroupCall(chatId: string): Promise<
  | { active: false }
  | { active: true; roomId: string; mediaType: GroupCallMedia; participantCount: number }
> {
  const res = await apiFetch(`${API}/group-calls/chats/${encodeURIComponent(chatId)}/active`);
  if (!res.ok) return { active: false };
  return res.json() as Promise<
    | { active: false }
    | { active: true; roomId: string; mediaType: GroupCallMedia; participantCount: number }
  >;
}
