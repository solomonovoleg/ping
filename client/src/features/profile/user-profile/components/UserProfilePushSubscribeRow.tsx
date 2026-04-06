import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BellOff, RefreshCw, Sparkles } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { useToast } from "@/hooks/use-toast";
import { usePulseProfileTheme } from "@/features/profile/pulse-profile";
import {
  loadPushSubscriptionForProfilePage,
  subscribePushAuthor,
  unsubscribePushAuthor,
  updatePushAuthorHidden,
  updatePushAuthorSettings,
} from "@/lib/push-feed";
import { userProfileRu } from "../i18n.ru";

const t = userProfileRu.pushAuthor;

type Props = {
  authorId: string;
  viewerUserId: string;
  isBlockedByMe: boolean;
};

export function UserProfilePushSubscribeRow({ authorId, viewerUserId, isBlockedByMe }: Props) {
  const { th } = usePulseProfileTheme();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const skip = viewerUserId === authorId || isBlockedByMe;

  const q = useQuery({
    queryKey: ["push", "subscription", authorId],
    queryFn: () => loadPushSubscriptionForProfilePage(authorId),
    staleTime: 30_000,
    enabled: !skip,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["push", "subscription", authorId] });
    void queryClient.invalidateQueries({ queryKey: ["push", "feed"] });
  };

  const subscribeMut = useMutation({
    mutationFn: () => subscribePushAuthor(authorId),
    onSuccess: () => {
      invalidate();
      toast({ title: t.toastSubscribed });
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "Не удалось подписаться";
      toast({ title: msg, variant: "destructive" });
    },
  });

  const unsubscribeMut = useMutation({
    mutationFn: () => unsubscribePushAuthor(authorId),
    onSuccess: () => {
      invalidate();
      toast({ title: t.toastUnsubscribed });
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "Не удалось отписаться";
      toast({ title: msg, variant: "destructive" });
    },
  });

  const notifyMut = useMutation({
    mutationFn: (enabled: boolean) => updatePushAuthorSettings(authorId, enabled),
    onSuccess: () => invalidate(),
    onError: () => {
      toast({ title: t.toastNotifyError, variant: "destructive" });
    },
  });

  const unhideMut = useMutation({
    mutationFn: () => updatePushAuthorHidden(authorId, false),
    onSuccess: () => invalidate(),
    onError: () => {
      toast({ title: t.toastUnhideError, variant: "destructive" });
    },
  });

  if (skip) return null;

  const busy = subscribeMut.isPending || unsubscribeMut.isPending || notifyMut.isPending || unhideMut.isPending;

  if (q.data?.module === "off") return null;

  if (q.isPending) {
    return <Skeleton className="h-11 w-11 shrink-0 rounded-2xl opacity-80" />;
  }

  if (q.isError || q.data?.module === "error") {
    return (
      <TapScaleButton
        type="button"
        subtle
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border"
        style={{ borderColor: th.borderStrong, background: th.surface, color: th.text }}
        aria-label={t.retry}
        onClick={() => void q.refetch()}
      >
        <RefreshCw className="h-5 w-5 opacity-90" strokeWidth={2} />
      </TapScaleButton>
    );
  }

  const s = q.data;
  if (s.module !== "on") return null;

  const bellBtnBase =
    "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border transition-all duration-150 active:scale-[0.98] disabled:opacity-60 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

  if (!s.subscribed) {
    return (
      <TapScaleButton
        type="button"
        className={bellBtnBase}
        style={{
          background: `${th.accent}22`,
          borderColor: th.accent,
          color: th.accent,
        }}
        aria-label={t.subscribeAria}
        disabled={busy}
        onClick={() => subscribeMut.mutate()}
      >
        <Sparkles className="h-5 w-5" strokeWidth={2.2} aria-hidden />
      </TapScaleButton>
    );
  }

  const notifOn = s.notificationsEnabled !== false;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={busy}
          className={bellBtnBase}
          style={{
            background: s.hidden ? `${th.textSub}12` : notifOn ? `${th.accent}22` : th.surface,
            borderColor: s.hidden ? th.borderStrong : notifOn ? th.accent : th.border,
            color: s.hidden ? th.textSub : notifOn ? th.accent : th.text,
          }}
          aria-label={t.menuTriggerAria}
        >
          {s.hidden ? (
            <BellOff className="h-5 w-5 shrink-0 opacity-90" strokeWidth={2.2} aria-hidden />
          ) : (
            <Bell
              className="h-5 w-5 shrink-0"
              strokeWidth={2.2}
              aria-hidden
              fill={notifOn ? "currentColor" : "none"}
              style={{ opacity: notifOn ? 0.95 : 0.85 }}
            />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="center"
        sideOffset={6}
        className="min-w-[240px] border p-1.5 shadow-lg"
        style={{
          background: th.surface,
          borderColor: th.borderStrong,
          color: th.text,
        }}
      >
        <DropdownMenuLabel className="px-2 py-1.5 text-[13px] font-semibold" style={{ color: th.text }}>
          {t.title}
        </DropdownMenuLabel>
        <p className="px-2 pb-2 text-[11px] leading-snug opacity-80" style={{ color: th.textSub }}>
          {t.hint}
        </p>
        {s.hidden ? (
          <DropdownMenuItem
            className="cursor-pointer text-[13px]"
            style={{ color: th.accent }}
            disabled={busy}
            onSelect={() => unhideMut.mutate()}
          >
            {t.unhide}
          </DropdownMenuItem>
        ) : (
          <DropdownMenuCheckboxItem
            className="cursor-pointer text-[13px] pl-8"
            checked={notifOn}
            disabled={busy}
            onCheckedChange={(checked) => notifyMut.mutate(checked)}
          >
            {t.notificationsLabel}
          </DropdownMenuCheckboxItem>
        )}
        <DropdownMenuSeparator className="opacity-40" />
        <DropdownMenuItem
          className="cursor-pointer text-[13px]"
          style={{ color: th.textSub }}
          disabled={busy}
          onSelect={() => unsubscribeMut.mutate()}
        >
          {t.unsubscribe}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
