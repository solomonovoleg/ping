import { fetchCommentsForPost } from "./fetch-comments-for-post";
import type { CommentItem } from "../shared/types";

export function CommentsModalErrorBanner({
  error,
  postId,
  setComments,
  setLoading,
  setError,
}: {
  error: string;
  postId: string | number | null;
  setComments: (list: CommentItem[]) => void;
  setLoading: (v: boolean) => void;
  setError: (v: string | null) => void;
}) {
  const canRetry = postId != null;
  return (
    <div className="px-4 py-2 bg-destructive/10 text-destructive text-sm shrink-0 flex items-center justify-between gap-2 flex-wrap">
      <span>{error}</span>
      {canRetry ? (
        <button
          type="button"
          onClick={() => {
            setError(null);
            setLoading(true);
            void fetchCommentsForPost(postId)
              .then((list) => setComments(list))
              .catch((e) =>
                setError(e instanceof Error ? e.message : "Не удалось загрузить комментарии"),
              )
              .finally(() => setLoading(false));
          }}
          className="text-[13px] font-medium underline underline-offset-2 hover:no-underline"
        >
          Повторить
        </button>
      ) : null}
    </div>
  );
}
