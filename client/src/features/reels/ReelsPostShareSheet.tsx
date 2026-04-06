import { AnimatePresence, motion } from "framer-motion";
import { Link2, Share2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { UserAvatar } from "@/components/UserAvatar";
import { MotionBottomSheetPanel, MotionBottomSheetScrollArea } from "@/components/ui/motion-bottom-sheet";
import { DURATION_NORMAL_S, EASING_OUT_BEZIER, usePrefersReducedMotion } from "@/lib/motion";
import { isNavigatorShareCancelled } from "@/lib/navigator-share";
import { sharePostToUser, type FeedPost } from "@/lib/posts";
import { buildReelsPostPath } from "@/lib/profile-route";
import { listContactsWithProfiles } from "@/lib/users";
import { useToast } from "@/hooks/use-toast";

type ReelsPostShareSheetProps = {
  post: FeedPost | null;
  selfUserId: string | undefined;
  onClose: () => void;
};

/** Нижний sheet шаринга поста — паритет с лентой (системное меню, ссылка, контакты). */
export function ReelsPostShareSheet({ post, selfUserId, onClose }: ReelsPostShareSheetProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const reducedMotion = usePrefersReducedMotion();
  const open = post != null;

  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts", "list"],
    queryFn: listContactsWithProfiles,
    enabled: open,
  });

  const shareMutation = useMutation({
    mutationFn: ({ postId, toUserId }: { postId: string; toUserId: string }) => sharePostToUser(postId, toUserId),
    onSuccess: (data) => {
      onClose();
      toast({ title: "Пост отправлен в чат" });
      void queryClient.invalidateQueries({ queryKey: ["posts", "feed"] });
      void queryClient.invalidateQueries({ queryKey: ["posts", "reels-feed"] });
      const chatId = typeof data?.chatId === "string" ? data.chatId : "";
      if (chatId) setLocation(`/chat/${encodeURIComponent(chatId)}`);
    },
    onError: (e) =>
      toast({ title: e instanceof Error ? e.message : "Не удалось отправить", variant: "destructive" }),
  });

  const shareUrl =
    typeof window !== "undefined" && post
      ? `${window.location.origin}${buildReelsPostPath({
          postId: post.id,
          linkCode: post.linkCode,
          isMe: post.authorId === selfUserId,
          publicId: post.author?.publicId,
          userId: post.authorId,
        })}`
      : "";

  const shareTitle = post
    ? [post.author?.displayName, post.author?.surname].filter(Boolean).join(" ") ||
      post.channelName ||
      "Пост"
    : "";

  const runNativeShare = async () => {
    if (!post) return;
    try {
      if (navigator.share) {
        await navigator.share({ title: shareTitle, text: shareTitle, url: shareUrl });
        onClose();
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        toast({ title: "Ссылка скопирована" });
        onClose();
      }
    } catch (e) {
      if (isNavigatorShareCancelled(e)) return;
      toast({ title: "Не удалось поделиться", variant: "destructive" });
    }
  };

  const copyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({ title: "Ссылка скопирована" });
      onClose();
    } catch {
      toast({ title: "Не удалось скопировать", variant: "destructive" });
    }
  };

  return (
    <AnimatePresence>
      {open && post ? (
        <motion.div
          className="fixed inset-0 z-[400] flex items-end bg-black/50 backdrop-blur-sm"
          initial={reducedMotion ? { opacity: 1 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{
            duration: reducedMotion ? 0 : DURATION_NORMAL_S * 0.85,
            ease: EASING_OUT_BEZIER,
          }}
          onClick={() => !shareMutation.isPending && onClose()}
        >
          <MotionBottomSheetPanel
            className="flex max-h-[min(72vh,640px)] w-full min-h-0 flex-col overflow-hidden rounded-t-[24px] border border-border/60 bg-background text-foreground shadow-2xl uix-responsive-max-w"
            initial={reducedMotion ? { y: 0 } : { y: "100%" }}
            animate={{ y: 0 }}
            exit={reducedMotion ? { y: 0 } : { y: "100%" }}
            transition={{
              duration: reducedMotion ? 0 : DURATION_NORMAL_S,
              ease: EASING_OUT_BEZIER,
            }}
            onClick={(e) => e.stopPropagation()}
            disableSwipeDismiss={reducedMotion}
            onDismiss={() => !shareMutation.isPending && onClose()}
            dragHandle={
              <div className="flex w-full shrink-0 justify-center pt-3 pb-2" aria-hidden>
                <div className="h-1 w-10 rounded-full bg-border" />
              </div>
            }
          >
            <div className="flex items-center justify-between border-b border-border/40 px-4 pb-3 pt-1">
              <p className="text-base font-bold">Поделиться</p>
              <button
                type="button"
                className="flex min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"
                aria-label="Закрыть"
                disabled={shareMutation.isPending}
                onClick={() => onClose()}
              >
                <span className="text-lg leading-none">×</span>
              </button>
            </div>
            <MotionBottomSheetScrollArea className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 pb-[max(12px,calc(env(safe-area-inset-bottom,0px)+12px))]">
              <div className="flex flex-col gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => void runNativeShare()}
                  className="flex min-h-[var(--uix-touch-min)] w-full items-center gap-3 rounded-xl border border-border/50 bg-secondary/40 px-4 py-3 text-left text-sm font-medium hover:bg-secondary/60"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <Share2 className="h-5 w-5" />
                  </span>
                  <span>Системное меню (соцсети, приложения…)</span>
                </button>
                <button
                  type="button"
                  onClick={() => void copyLink()}
                  className="flex min-h-[var(--uix-touch-min)] w-full items-center gap-3 rounded-xl border border-border/50 bg-secondary/25 px-4 py-3 text-left text-sm font-medium hover:bg-secondary/45"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                    <Link2 className="h-5 w-5" />
                  </span>
                  <span>Копировать ссылку на пост</span>
                </button>
                <p className="pt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Отправить в Ping
                </p>
                {contacts.filter((c) => c.id !== selfUserId).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Нет контактов — добавьте людей в разделе «Контакты».</p>
                ) : (
                  <ul className="flex flex-col gap-1 pb-2">
                    {contacts
                      .filter((c) => c.id !== selfUserId)
                      .map((c) => (
                        <li key={c.id}>
                          <button
                            type="button"
                            disabled={shareMutation.isPending}
                            className="flex min-h-[var(--uix-touch-min)] w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-secondary/60"
                            onClick={() => shareMutation.mutate({ postId: post.id, toUserId: c.id })}
                          >
                            <UserAvatar
                              avatarUrl={c.avatarUrl ?? undefined}
                              displayName={
                                [c.displayName, c.surname].filter(Boolean).join(" ") || `ID ${c.publicId}`
                              }
                              seed={c.id}
                              size={40}
                              className="h-10 w-10 rounded-xl"
                              pointerEventsNone
                            />
                            <span className="min-w-0 flex-1 truncate text-sm font-medium">
                              {[c.displayName, c.surname].filter(Boolean).join(" ") || `ID ${c.publicId}`}
                            </span>
                          </button>
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            </MotionBottomSheetScrollArea>
          </MotionBottomSheetPanel>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
