import { API, apiFetch } from "@/lib/api-base";

export type ProfilePinFolderSummary = {
  id: string;
  name: string;
  description: string | null;
  coverUrl: string | null;
  coverIsVideo: boolean;
  fallbackPreviewUrl: string | null;
  fallbackIsVideo: boolean;
  displayPreviewUrl: string | null;
  displayIsVideo: boolean;
  itemCount: number;
};

export type ProfilePinFolderRow = {
  id: string;
  name: string;
  description: string | null;
  coverUrl: string | null;
  coverIsVideo: boolean;
  ownerUserId: string;
};

export type ProfilePinItemRow = {
  id: string;
  kind: "post" | "story" | "media";
  refId: string;
  createdAt: string;
  previewUrl: string | null;
  isVideo: boolean;
  viewsCount: number;
  likesCount: number;
  text: string;
};

export type AddProfilePinItemPayload =
  | { kind: "post"; refId: string }
  | { kind: "story"; refId: string }
  | { kind: "media"; mediaUrl: string; mediaIsVideo: boolean };

export async function fetchProfilePinFolders(profileRouteId: string): Promise<ProfilePinFolderSummary[]> {
  const res = await apiFetch(
    `${API}/profile-pins/by-profile/${encodeURIComponent(profileRouteId)}`,
    { credentials: "include", cache: "no-store" }
  );
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(typeof j.message === "string" ? j.message : "Не удалось загрузить закреплённое");
  }
  const data = await res.json();
  return Array.isArray(data.folders) ? data.folders : [];
}

export async function fetchProfilePinFolderDetail(folderId: string): Promise<{
  folder: ProfilePinFolderRow;
  items: ProfilePinItemRow[];
}> {
  const res = await apiFetch(`${API}/profile-pins/folders/${encodeURIComponent(folderId)}`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(typeof j.message === "string" ? j.message : "Не удалось открыть папку");
  }
  return res.json();
}

export async function createProfilePinFolder(body: { name: string; description?: string | null }) {
  const res = await apiFetch(`${API}/profile-pins/folders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(typeof j.message === "string" ? j.message : "Не удалось создать папку");
  }
  return res.json();
}

export async function updateProfilePinFolder(
  folderId: string,
  body: Partial<{ name: string; description: string | null; coverUrl: string | null; coverIsVideo: boolean }>
) {
  const res = await apiFetch(`${API}/profile-pins/folders/${encodeURIComponent(folderId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(typeof j.message === "string" ? j.message : "Не удалось сохранить папку");
  }
  return res.json();
}

export async function deleteProfilePinFolder(folderId: string) {
  const res = await apiFetch(`${API}/profile-pins/folders/${encodeURIComponent(folderId)}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(typeof j.message === "string" ? j.message : "Не удалось удалить папку");
  }
}

export async function addProfilePinItem(folderId: string, payload: AddProfilePinItemPayload) {
  const body =
    payload.kind === "media"
      ? { kind: "media", mediaUrl: payload.mediaUrl, mediaIsVideo: payload.mediaIsVideo }
      : { kind: payload.kind, refId: payload.refId };
  const res = await apiFetch(`${API}/profile-pins/folders/${encodeURIComponent(folderId)}/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(typeof j.message === "string" ? j.message : "Не удалось добавить в закреплённое");
  }
  return res.json();
}

export async function deleteProfilePinItem(itemId: string) {
  const res = await apiFetch(`${API}/profile-pins/items/${encodeURIComponent(itemId)}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(typeof j.message === "string" ? j.message : "Не удалось удалить элемент");
  }
}
