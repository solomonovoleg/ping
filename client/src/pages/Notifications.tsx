import { useEffect, useRef } from "react";
import { ChevronLeft, Bell } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchNotifications, markNotificationRead, markAllNotificationsRead, type NotificationItem } from "@/lib/notifications";
import { formatPostTime } from "@/lib/posts";
import { PageTitle } from "@/components/PageTitle";
import { ListEmptyState, ErrorWithRetry } from "@/components/ui/empty";
import { UserAvatar } from "@/components/UserAvatar";
import { TapScaleButton, TapScaleDiv } from "@/components/ui/tap-scale";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { buildProfilePath, buildProfilePostPath } from "@/lib/profile-route";

function notificationLabel(item: NotificationItem): string {
  const name = item.actorName;
  switch (item.type) {
    case "comment":
      return item.excerpt ? `${name} прокомментировал(а): «${item.excerpt.slice(0, 50)}${item.excerpt.length > 50 ? "…" : ""}»` : `${name} оставил(а) комментарий`;
    case "reaction":
      return `${name} поставил(а) реакцию ${item.excerpt || "❤️"} на ваш пост`;
    case "follow":
      return `${name} подписался(ась) на вас`;
    case "mention":
      return item.excerpt ? `${name} упомянул(а) вас: «${item.excerpt.slice(0, 50)}…»` : `${name} упомянул(а) вас`;
    default:
      return `${name}`;
  }
}

export default function Notifications() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const autoMarkedRef = useRef(false);

  const { data: list = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => fetchNotifications(50, 0),
  });

  const markReadMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
    onError: (e) => toast({ title: e instanceof Error ? e.message : "Ошибка", variant: "destructive" }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
    onError: (e) => toast({ title: e instanceof Error ? e.message : "Ошибка", variant: "destructive" }),
  });

  const unreadCount = list.filter((n) => !n.readAt).length;

  useEffect(() => {
    if (isLoading || markAllReadMutation.isPending) return;
    if (autoMarkedRef.current) return;
    if (unreadCount <= 0) return;
    autoMarkedRef.current = true;
    markAllReadMutation.mutate();
  }, [isLoading, unreadCount, markAllReadMutation]);

  const handleItemTap = (item: NotificationItem) => {
    if (!item.readAt) markReadMutation.mutate(item.id);
    const actorPath = buildProfilePath({
      publicId: item.actorPublicId,
      userId: item.actorId,
      fallbackPath: "/posts",
    });
    const postPath = buildProfilePostPath({
      postId: item.postId,
      publicId: item.postAuthorPublicId,
      userId: item.postAuthorId,
      fallbackPath: "/posts",
    });
    if (item.type === "follow" || (item.type === "mention" && !item.postId)) {
      setLocation(actorPath);
      return;
    }
    if (item.postId) {
      setLocation(postPath);
    } else {
      setLocation(actorPath);
    }
  };

  if (isError) {
    return (
      <div className="flex h-full w-full max-w-full min-w-0 flex-col bg-background">
        <div className="uix-content-x py-4 glass z-10 sticky top-0 flex items-center gap-2">
          <TapScaleButton
            type="button"
            onClick={() => window.history.back()}
            haptic
            subtle
            className="p-2 -ml-2 rounded-full hover:bg-secondary min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] flex items-center justify-center"
            aria-label="Назад"
          >
            <ChevronLeft className="w-6 h-6" />
          </TapScaleButton>
          <PageTitle title="Уведомления" />
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <ErrorWithRetry onRetry={() => refetch()} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full max-w-full min-w-0 flex-col bg-background">
      <div className="uix-content-x py-4 glass z-10 sticky top-0 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <TapScaleButton
            type="button"
            onClick={() => window.history.back()}
            haptic
            subtle
            className="p-2 -ml-2 rounded-full hover:bg-secondary min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] flex items-center justify-center shrink-0"
            aria-label="Назад"
          >
            <ChevronLeft className="w-6 h-6" />
          </TapScaleButton>
          <PageTitle title="Уведомления" />
        </div>
        {unreadCount > 0 && (
          <TapScaleButton
            type="button"
            onClick={() => markAllReadMutation.mutate()}
            disabled={markAllReadMutation.isPending}
            haptic
            subtle
            className="text-sm text-primary font-medium min-h-[var(--uix-touch-min)] px-3 rounded-lg hover:bg-secondary/50"
            aria-label="Прочитать все"
          >
            Прочитать все
          </TapScaleButton>
        )}
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden min-w-0">
        {isLoading ? (
          <div className="uix-content-x py-2 space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-2xl">
                <Skeleton className="w-12 h-12 rounded-full shrink-0" />
                <div className="flex-1 min-w-0 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : list.length === 0 ? (
          <ListEmptyState
            icon={Bell}
            title="Нет уведомлений"
            description="Здесь появятся лайки, комментарии, подписки и упоминания."
            className="py-12"
          />
        ) : (
          <ul className="uix-content-x py-2 list-none">
            {list.map((item) => (
              <li key={item.id}>
                <TapScaleDiv
                  onClick={() => handleItemTap(item)}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-2xl hover:bg-secondary/50 transition-colors cursor-pointer min-h-[var(--uix-touch-min)]",
                    !item.readAt && "bg-primary/5"
                  )}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleItemTap(item);
                    }
                  }}
                  aria-label={notificationLabel(item)}
                >
                  <UserAvatar
                    avatarUrl={item.actorAvatarUrl}
                    displayName={item.actorName}
                    seed={item.actorId}
                    size={48}
                    className="w-12 h-12 rounded-full shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] text-foreground leading-snug">
                      {notificationLabel(item)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {item.createdAt ? formatPostTime(item.createdAt) : ""}
                    </p>
                  </div>
                  {!item.readAt && (
                    <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2" aria-hidden />
                  )}
                </TapScaleDiv>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
