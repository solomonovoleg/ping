import { API, apiFetch } from "@/lib/api-base";
import { mapCreatedCommentDto } from "../shared/map-comment-dto";
import type { CommentItem } from "../shared/types";

/** Корневой комментарий к посту (без parentCommentId). */
export async function createCommentOnPost(postId: string | number, text: string): Promise<CommentItem | null> {
  const res = await apiFetch(`${API}/posts/${encodeURIComponent(String(postId))}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: text.trim() }),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(
      (typeof data.message === "string" ? data.message : null) || "Не удалось отправить комментарий",
    );
  }
  return mapCreatedCommentDto(data, postId);
}
