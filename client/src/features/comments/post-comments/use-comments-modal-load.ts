import { useState, useEffect } from "react";
import { recordPostViewBestEffort } from "@/lib/posts";
import type { CommentItem } from "../shared/types";
import { fetchCommentsForPost } from "./fetch-comments-for-post";

export function useCommentsModalLoad(isOpen: boolean, postId: number | string | null) {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || postId == null) {
      setComments([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    recordPostViewBestEffort(String(postId));
    fetchCommentsForPost(postId)
      .then((list) => {
        if (!cancelled) setComments(list);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Не удалось загрузить комментарии");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, postId]);

  return { comments, setComments, loading, setLoading, error, setError };
}
