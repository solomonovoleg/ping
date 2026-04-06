import { API, apiFetch } from "@/lib/api-base";

export async function deletePostComment(postId: string | number, commentId: string): Promise<void> {
  const res = await apiFetch(
    `${API}/posts/${encodeURIComponent(String(postId))}/comments/${encodeURIComponent(commentId)}`,
    { method: "DELETE" },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (data && typeof data.message === "string" ? data.message : null) || "Не удалось удалить комментарий",
    );
  }
}
