import { API, apiFetch } from "@/lib/api-base";

export async function toggleCommentLike(
  postId: string | number,
  commentId: string,
): Promise<{ liked: boolean; likes: number }> {
  const res = await apiFetch(
    `${API}/posts/${encodeURIComponent(String(postId))}/comments/${encodeURIComponent(commentId)}/like`,
    { method: "POST" },
  );
  const data = (await res.json().catch(() => ({}))) as {
    message?: string;
    liked?: boolean;
    likes?: number;
  };
  if (!res.ok) {
    throw new Error(data.message || "Не удалось обновить лайк");
  }
  if (typeof data.liked !== "boolean" || typeof data.likes !== "number") {
    throw new Error("Некорректный ответ сервера");
  }
  return { liked: data.liked, likes: data.likes };
}
