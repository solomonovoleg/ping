import { API, apiFetch } from "@/lib/api-base";
import { mapCommentDto } from "../shared/map-comment-dto";
import type { CommentItem } from "../shared/types";

export async function fetchCommentsForPost(postId: string | number): Promise<CommentItem[]> {
  const res = await apiFetch(`${API}/posts/${encodeURIComponent(String(postId))}/comments`, {
    cache: "no-store",
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { message?: unknown };
    const msg = typeof data.message === "string" ? data.message : null;
    throw new Error(
      msg || (res.status === 503 ? "Комментарии временно недоступны" : "Не удалось загрузить комментарии"),
    );
  }
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data.map((c: Record<string, unknown>) => mapCommentDto(c, postId));
}
