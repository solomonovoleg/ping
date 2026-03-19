import { API, apiFetch } from "@/lib/api-base";

export type CommentItem = {
  id: string;
  postId: string;
  userId?: string;
  text: string;
  createdAt: string;
  user: string;
  avatar: string | null;
  likes: number;
};

export async function fetchComments(postId: string | number): Promise<CommentItem[]> {
  const res = await apiFetch(`${API}/posts/${encodeURIComponent(String(postId))}/comments`, {
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data.map((c: Record<string, unknown>) => ({
    id: String(c.id ?? ""),
    postId: String(c.postId ?? postId),
    userId: typeof c.userId === "string" ? c.userId : undefined,
    text: String(c.text ?? ""),
    createdAt: String(c.createdAt ?? ""),
    user: String(c.user ?? "Пользователь"),
    avatar: typeof c.avatar === "string" ? c.avatar : null,
    likes: typeof c.likes === "number" ? c.likes : 0,
  }));
}

export async function createComment(
  postId: string | number,
  text: string
): Promise<CommentItem | null> {
  const res = await apiFetch(`${API}/posts/${encodeURIComponent(String(postId))}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: text.trim() }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (data && typeof data.message === "string" ? data.message : null) ||
        "Не удалось отправить комментарий"
    );
  }
  return {
    id: String(data.id ?? ""),
    postId: String(data.postId ?? postId),
    userId: typeof data.userId === "string" ? data.userId : undefined,
    text: String(data.text ?? ""),
    createdAt: String(data.createdAt ?? ""),
    user: String(data.user ?? "Пользователь"),
    avatar: typeof data.avatar === "string" ? data.avatar : null,
    likes: 0,
  };
}

import { formatDateShortLocal } from "@/lib/timezone";

/** Форматирует ISO дату в короткий вид "только что" / "5 мин" / "1 ч" (локальное время) */
export function formatCommentTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const sec = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (sec < 60) return "Только что";
  if (sec < 3600) return `${Math.floor(sec / 60)} мин`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} ч`;
  if (sec < 604800) return `${Math.floor(sec / 86400)} д`;
  return formatDateShortLocal(d);
}
