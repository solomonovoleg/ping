import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addReaction, removeReaction, deletePost, savePost, unsavePost } from "@/lib/posts";
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

  const savePostMutation = useMutation({
    mutationFn: async ({ postId, save }: { postId: string; save: boolean }) => {
      if (save) await savePost(postId);
      else await unsavePost(postId);
    },
    onSuccess: (_data, { save }) => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      toast({ title: save ? t.postSaved : t.postUnsaved });
    },
    onError: (e) =>
      toast({ title: e instanceof Error ? e.message : t.postSaveError, variant: "destructive" }),
  });

  return { reactionMutation, deletePostMutation, savePostMutation };
}
