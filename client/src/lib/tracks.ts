import { API, apiFetch } from "@/lib/api-base";

export type Track = {
  id: string;
  name: string;
  createdAt: string;
  totalItems: number;
  activeItems: number;
  doneItems: number;
};

export type TrackItem = {
  id: string;
  messageId: string;
  chatId: string;
  chatName: string;
  content: string;
  type: string;
  messageCreatedAt: string;
  addedAt: string;
  doneAt: string | null;
};

export async function getTracks(): Promise<Track[]> {
  const res = await apiFetch(`${API}/tracks`);
  if (!res.ok) throw new Error("Не удалось загрузить треки");
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function createTrack(name: string): Promise<Track> {
  const res = await apiFetch(`${API}/tracks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: name.trim() || "Новый трек" }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message || "Не удалось создать трек");
  }
  return res.json();
}

export async function addMessageToTrack(trackId: string, messageId: string, chatId: string): Promise<void> {
  const res = await apiFetch(`${API}/tracks/${encodeURIComponent(trackId)}/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messageId, chatId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message || "Не удалось добавить в трек");
  }
}

export async function getTrackItems(trackId: string): Promise<TrackItem[]> {
  const res = await apiFetch(`${API}/tracks/${encodeURIComponent(trackId)}/items`);
  if (!res.ok) throw new Error("Не удалось загрузить элементы трека");
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function removeTrackItem(trackId: string, itemId: string): Promise<void> {
  const res = await apiFetch(`${API}/tracks/${encodeURIComponent(trackId)}/items/${encodeURIComponent(itemId)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message || "Не удалось убрать");
  }
}

export async function setTrackItemDone(trackId: string, itemId: string, done: boolean): Promise<void> {
  const res = await apiFetch(`${API}/tracks/${encodeURIComponent(trackId)}/items/${encodeURIComponent(itemId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ done }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message || "Не удалось обновить");
  }
}

export type TracksStats = {
  totalTracks: number;
  activeItemsCount: number;
  doneItemsCount: number;
  lastAddedAt: string | null;
};

export async function getTracksStats(): Promise<TracksStats> {
  const res = await apiFetch(`${API}/tracks/stats`);
  if (!res.ok) throw new Error("Не удалось загрузить");
  return res.json();
}

export async function updateTrack(trackId: string, name: string): Promise<void> {
  const res = await apiFetch(`${API}/tracks/${encodeURIComponent(trackId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: name.trim() }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message || "Не удалось переименовать");
  }
}

export async function deleteTrack(trackId: string): Promise<void> {
  const res = await apiFetch(`${API}/tracks/${encodeURIComponent(trackId)}`, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message || "Не удалось удалить");
  }
}
