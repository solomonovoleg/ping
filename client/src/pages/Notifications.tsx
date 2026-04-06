import { useEffect, useMemo, useRef, useState } from "react";
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
import { buildProfilePath, buildProfilePostPath, buildStoriesFeedDeepLink } from "@/lib/profile-route";

type NotificationCategory = "all" | "mentions" | "comments" | "reactions" | "social";

const CATEGORY_CHIPS: { id: NotificationCategory; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "mentions", label: "Упоминания" },
  { id: "comments", label: "Комментарии" },
  { id: "reactions", label: "Реакции" },
  { id: "social", label: "Подписки" },
];

function itemCategory(type: string): NotificationCategory | null {
  switch (type) {
    case "mention":
      return "mentions";
    case "comment":
    case "comment_reply":
    case "push_reply":
      return "comments";
    case "reaction":
      return "reactions";
    case "follow":
    case "push_post":
    case "push_subscribe":
    case "business_status_approved":
    case "business_status_rejected":
    case "business_status_revision":
      return "social";
    default:
      return null;
  }
}

function matchesCategory(item: NotificationItem, cat: NotificationCategory): boolean {
  if (cat === "all") return true;
  return itemCategory(item.type) === cat;
}

function excerptQuote(excerpt: string | null, max = 52): string {
  if (!excerpt?.trim()) return "";
  const t = excerpt.trim();
  if (t.length <= max) return `«${t}»`;
  return `«${t.slice(0, max)}…»`;
}

function notificationLabel(item: NotificationItem): string {
  const name = item.actorName;
  const quote = excerptQuote(item.excerpt);
  switch (item.type) {
    case "comment":
      return quote ? `${name} прокомментировал(а): ${quote}` : `${name} оставил(а) комментарий`;
    case "comment_reply":
      return quote
        ? `${name} ответил(а) на ваш комментарий: ${quote}`
        : `${name} ответил(а) на ваш комментарий`;
    case "push_reply":
      return quote ? `${name} ответил(а) на ваш Push: ${quote}` : `${name} ответил(а) на ваш Push`;
    case "reaction":
      return `${name} поставил(а) реакцию ${item.excerpt?.trim() || "❤️"} на ваш пост`;
    case "follow":
      return `${name} подписался(ась) на вас`;
    case "push_subscribe":
      return `${name} подписался(ась) на ваши Push`;
    case "push_post":
      return quote ? `${name} отправил(а) Push: ${quote}` : `${name} отправил(а) новый Push`;
    case "business_status_approved":
      return quote
        ? `Ваша заявка на бизнес-статус одобрена. ${quote}`
        : "Ваша заявка на бизнес-статус одобрена";
    case "business_status_rejected":
      return quote
        ? `Ваша заявка на бизнес-статус отклонена. ${quote}`
        : "Ваша заявка на бизнес-статус отклонена";
    case "business_status_revision":
      return quote
        ? `Заявка на бизнес-статус отправлена на доработку. ${quote}`
        : "Заявка на бизнес-статус отправлена на доработку";
    case "mention":
      /* Старые строки до перехода на ЛС для сторис */
      if (item.storyId) {
        return quote ? `${name} отметил(а) вас в истории: ${quote}` : `${name} отметил(а) вас в истории`;
      }
      if (item.commentId) {
        return quote ? `${name} упомянул(а) вас в комментарии: ${quote}` : `${name} упомянул(а) вас в комментарии`;
      }
      if (item.postId) {
        return quote ? `${name} упомянул(а) вас в посте: ${quote}` : `${name} упомянул(а) вас в посте`;
      }
      return quote ? `${name} упомянул(а) вас: ${quote}` : `${name} упомянул(а) вас`;
    default:
      return name;
  }
}

export default function Notifications() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const autoMarkedRef = useRef(false);
  const [category, setCategory] = useState<NotificationCategory>("all");

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

  const categoryCounts = useMemo(() => {
    const counts: Record<NotificationCategory, number> = {
      all: list.length,
      mentions: 0,
      comments: 0,
      reactions: 0,
      social: 0,
    };
    for (const item of list) {
      const c = itemCategory(item.type);
      if (c) counts[c] += 1;
    }
    return counts;
  }, [list]);

  const filteredList = useMemo(
    () => list.filter((item) => matchesCategory(item, category)),
    [list, category],
  );

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
    const wantCommentDeepLink =
      Boolean(item.postId) &&
      Boolean(item.commentId) &&
      (item.type === "mention" || item.type === "comment" || item.type === "comment_reply");

    if (item.type === "mention" && item.storyId && item.actorId) {
      setLocation(buildStoriesFeedDeepLink({ storyId: item.storyId, storyAuthorId: item.actorId }));
      return;
    }

    if (
      item.type === "business_status_approved" ||
      item.type === "business_status_rejected" ||
      item.type === "business_status_revision"
    ) {
      setLocation("/profile/edit?focus=business-status");
      return;
    }

    if (
      item.type === "follow" ||
      item.type === "push_subscribe" ||
      (item.type === "mention" && !item.postId && !item.storyId) ||
      (item.type === "push_post" && !item.postId)
    ) {
      setLocation(actorPath);
      return;
    }
    if (item.postId) {
      const postPath = buildProfilePostPath({
        postId: item.postId,
        linkCode: item.postLinkCode,
        publicId: item.postAuthorPublicId,
        userId: item.postAuthorId,
        fallbackPath: "/posts",
        commentId: wantCommentDeepLink ? item.commentId : undefined,
      });
      setLocation(postPath);
      return;
    }
    setLocation(actorPath);
  };

  const emptyCategoryDescription =
    category === "mentions"
      ? "Упоминания в постах и комментариях — здесь. Отметки в сторис приходят в личные сообщения."
      : category === "comments"
        ? "Комментарии к вашим постам и ответы на ваши комментарии — в этой вкладке."
        : category === "reactions"
          ? "Реакции на ваши посты будут отображаться здесь."
          : category === "social"
            ? "Подписки на вас и на ваши Push, решения по бизнес-заявкам — здесь."
            : "";

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

      {!isLoading && list.length > 0 ? (
        <div
          className="uix-content-x border-b border-border/40 pb-2 pt-0 shrink-0"
          role="tablist"
          aria-label="Категории уведомлений"
        >
          <div className="flex gap-2 overflow-x-auto overscroll-x-contain pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {CATEGORY_CHIPS.map((chip) => {
              const count = categoryCounts[chip.id];
              const active = category === chip.id;
              return (
                <TapScaleButton
                  key={chip.id}
                  type="button"
                  haptic
                  subtle
                  role="tab"
                  aria-selected={active}
                  onClick={() => setCategory(chip.id)}
                  className={cn(
                    "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors min-h-[var(--uix-touch-min)]",
                    active
                      ? "border-primary/40 bg-primary/12 text-primary"
                      : "border-border/50 bg-secondary/30 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {chip.label}
                  {chip.id !== "all" && count > 0 ? (
                    <span className="ml-1 tabular-nums opacity-80">({count})</span>
                  ) : null}
                </TapScaleButton>
              );
            })}
          </div>
        </div>
      ) : null}

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
            description="Упоминания в постах и комментариях, ответы на комментарии, реакции и подписки. Отметки в сторис — в чатах."
            className="py-12"
          />
        ) : filteredList.length === 0 ? (
          <ListEmptyState
            icon={Bell}
            title="В этой категории пусто"
            description={emptyCategoryDescription || "Выберите другую категорию или «Все»."}
            className="py-12"
          />
        ) : (
          <ul className="uix-content-x py-2 list-none">
            {filteredList.map((item) => (
              <li key={item.id}>
                <TapScaleDiv
                  onClick={() => handleItemTap(item)}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-2xl hover:bg-secondary/50 transition-colors cursor-pointer min-h-[var(--uix-touch-min)]",
                    !item.readAt && "bg-primary/5",
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
                    pointerEventsNone
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] text-foreground leading-snug">{notificationLabel(item)}</p>
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
