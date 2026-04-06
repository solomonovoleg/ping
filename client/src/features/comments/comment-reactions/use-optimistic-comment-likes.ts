import { useCallback, useMemo, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { CommentItem, DisplayComment } from "../shared/types";
import { formatCommentTime } from "../shared/format-comment-time";
import { toggleCommentLike } from "./toggle-comment-like";

export type CommentSortMode = "interesting" | "newest" | "oldest";

export function useOptimisticCommentLikes(
  comments: CommentItem[],
  postId: string | number | null,
  setComments: Dispatch<SetStateAction<CommentItem[]>>,
  setError?: Dispatch<SetStateAction<string | null>>,
  sortMode: CommentSortMode = "interesting",
) {
  const inflight = useRef(new Set<string>());

  const sortByCreatedDesc = useCallback((a: CommentItem, b: CommentItem) => {
    const ta = Number.isFinite(new Date(a.createdAt).getTime()) ? new Date(a.createdAt).getTime() : 0;
    const tb = Number.isFinite(new Date(b.createdAt).getTime()) ? new Date(b.createdAt).getTime() : 0;
    return tb - ta;
  }, []);
  const sortByCreatedAsc = useCallback((a: CommentItem, b: CommentItem) => {
    const ta = Number.isFinite(new Date(a.createdAt).getTime()) ? new Date(a.createdAt).getTime() : 0;
    const tb = Number.isFinite(new Date(b.createdAt).getTime()) ? new Date(b.createdAt).getTime() : 0;
    return ta - tb;
  }, []);

  const displayComments = useMemo<DisplayComment[]>(
    () => {
      const byParent = new Map<string, CommentItem[]>();
      const topLevel: CommentItem[] = [];
      for (const c of comments) {
        const parentId = c.parentCommentId ?? null;
        if (!parentId) {
          topLevel.push(c);
          continue;
        }
        const list = byParent.get(parentId) ?? [];
        list.push(c);
        byParent.set(parentId, list);
      }
      const directReplyCount = (commentId: string) => (byParent.get(commentId) ?? []).length;
      const sortTopLevel = (list: CommentItem[]) => {
        if (sortMode === "newest") {
          list.sort(sortByCreatedDesc);
          return;
        }
        if (sortMode === "oldest") {
          list.sort(sortByCreatedAsc);
          return;
        }
        // «Интересные»: активность = лайки + число прямых ответов; при равенстве — новее выше.
        list.sort((a, b) => {
          const scoreA = (a.likes ?? 0) + directReplyCount(a.id);
          const scoreB = (b.likes ?? 0) + directReplyCount(b.id);
          const delta = scoreB - scoreA;
          if (delta !== 0) return delta;
          return sortByCreatedDesc(a, b);
        });
      };

      sortTopLevel(topLevel);
      for (const list of byParent.values()) list.sort(sortByCreatedAsc);

      const ordered: CommentItem[] = [];
      const appended = new Set<string>();
      const pushThread = (root: CommentItem) => {
        if (appended.has(root.id)) return;
        ordered.push(root);
        appended.add(root.id);
        const direct = byParent.get(root.id) ?? [];
        for (const child of direct) {
          pushThread(child);
        }
      };
      for (const root of topLevel) pushThread(root);
      // orphan replies (если родитель удалён) — в конец.
      const orphans = comments.filter((c) => !appended.has(c.id));
      if (sortMode === "oldest") orphans.sort(sortByCreatedAsc);
      else orphans.sort(sortByCreatedDesc);
      for (const c of orphans) {
        if (!appended.has(c.id)) {
          ordered.push(c);
          appended.add(c.id);
        }
      }

      return ordered.map((c) => ({
        ...c,
        time: formatCommentTime(c.createdAt),
        isLiked: !!c.likedByMe,
        displayLikes: Math.max(0, c.likes ?? 0),
      }));
    },
    [comments, sortByCreatedAsc, sortByCreatedDesc, sortMode],
  );

  const toggleLike = useCallback(
    async (id: string) => {
      if (postId == null) return;
      if (inflight.current.has(id)) return;
      inflight.current.add(id);
      let snapshot: CommentItem | undefined;
      setComments((cs) => {
        const cur = cs.find((c) => c.id === id);
        if (!cur) return cs;
        snapshot = { ...cur };
        const nextLiked = !cur.likedByMe;
        const nextLikes = Math.max(0, (cur.likes ?? 0) + (nextLiked ? 1 : -1));
        return cs.map((c) => (c.id === id ? { ...c, likedByMe: nextLiked, likes: nextLikes } : c));
      });
      if (snapshot === undefined) {
        inflight.current.delete(id);
        return;
      }
      try {
        const r = await toggleCommentLike(postId, id);
        setComments((cs) =>
          cs.map((c) => (c.id === id ? { ...c, likedByMe: r.liked, likes: r.likes } : c)),
        );
      } catch (e) {
        setComments((cs) => cs.map((c) => (c.id === id ? snapshot! : c)));
        setError?.(e instanceof Error ? e.message : "Не удалось обновить лайк");
      } finally {
        inflight.current.delete(id);
      }
    },
    [postId, setComments, setError],
  );

  return { displayComments, toggleLike };
}
