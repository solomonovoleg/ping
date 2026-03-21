import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addReaction, removeReaction, deletePost } from "@/lib/posts";
import { userProfileRu } from "../i18n.ru";

type ProfileToast = (args: { title: string; variant?: "destructive" }) => void;

export function useUserProfilePostMutations(toast: ProfileToast) {
  const queryClient = useQueryClient();
  const t = userProfileRu.toast;

  const reactionMutation = useMutation({
    mutationFn: async ({ postId, emoji }: { postId: string; emoji: string | null }) => {
      if (emoji) await addReaction(postId, emoji);
      else await removeReaction(postId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
  });

  const deletePostMutation = useMutation({
    mutationFn: (postId: string) => deletePost(postId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      toast({ title: t.postDeleted });
    },
    onError: (e) =>
      toast({ title: e instanceof Error ? e.message : t.postDeleteError, variant: "destructive" }),
  });

  return { reactionMutation, deletePostMutation };
}
