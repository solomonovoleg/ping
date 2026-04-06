import { API, apiFetch } from "@/lib/api-base";

export type PatchPinnedPostResult = { pinnedPostId: string | null };

/** Закрепить пост в шапке профиля или снять закрепление (`postId: null`). */
export async function patchMyProfilePinnedPost(postId: string | null): Promise<PatchPinnedPostResult> {
  const res = await apiFetch(`${API}/users/me/pinned-post`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ postId }),
  });
  const data = (await res.json().catch(() => ({}))) as PatchPinnedPostResult & { message?: string };
  if (!res.ok) throw new Error(data.message || "Не удалось обновить закрепление");
  return { pinnedPostId: data.pinnedPostId ?? null };
}
