import { useQuery } from "@tanstack/react-query";
import { fetchMyProfileAnalytics, type MyProfileAnalytics } from "@/lib/users";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { userProfileRu } from "../i18n.ru";

const a = userProfileRu.analyticsSheet;

function fmt(n: number): string {
  return Number(n).toLocaleString("ru-RU");
}

function StatLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-[var(--uix-touch-min)] items-center justify-between gap-3 border-b border-border/40 py-2.5 text-sm last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums font-semibold text-foreground">{value}</span>
    </div>
  );
}

function AnalyticsBody({ data }: { data: MyProfileAnalytics }) {
  return (
    <div className="space-y-5 pb-2 pt-1">
      <section>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{a.sectionProfile}</p>
        <StatLine label={a.profileTotal} value={fmt(data.profileVisits.total)} />
        <StatLine label={a.profileUnique} value={fmt(data.profileVisits.uniqueVisitors)} />
        <StatLine label={a.profileTodayTotal} value={fmt(data.profileVisits.todayTotal)} />
        <StatLine label={a.profileTodayUnique} value={fmt(data.profileVisits.todayUnique)} />
      </section>
      <section>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{a.sectionPosts}</p>
        <StatLine label={a.postTotal} value={fmt(data.postViews.totalRecords)} />
        <StatLine label={a.postUnique} value={fmt(data.postViews.uniqueViewers)} />
      </section>
      <section>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{a.sectionStories}</p>
        <StatLine label={a.storyTotal} value={fmt(data.storyViews.totalRecords)} />
        <StatLine label={a.storyUnique} value={fmt(data.storyViews.uniqueViewers)} />
      </section>
      <section>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{a.sectionFollowers}</p>
        <StatLine label={a.followersToday} value={fmt(data.newFollowers.today)} />
        <StatLine label={a.followers7d} value={fmt(data.newFollowers.last7Days)} />
      </section>
      <section>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{a.sectionActivity}</p>
        <StatLine label={a.activityReactions} value={fmt(data.activityOnMyPosts.reactionsLast7Days)} />
        <StatLine label={a.activityComments} value={fmt(data.activityOnMyPosts.commentsLast7Days)} />
        <StatLine label={a.activityShares} value={fmt(data.activityOnMyPosts.sharesLast7Days)} />
      </section>
      <p className="text-[11px] leading-relaxed text-muted-foreground">{a.footnotePostStory}</p>
      <p className="text-[11px] leading-relaxed text-muted-foreground">{a.footnoteProfile}</p>
    </div>
  );
}

export function ProfileAnalyticsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["profile", "me", "analytics", user?.id],
    queryFn: fetchMyProfileAnalytics,
    enabled: open && !!user?.id,
    staleTime: 60_000,
  });

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <SheetContent
        side="bottom"
        className="max-h-[min(88vh,640px)] overflow-y-auto rounded-t-2xl px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2"
        aria-describedby={undefined}
      >
        <SheetHeader className="space-y-1 pb-2 text-left">
          <SheetTitle>{a.title}</SheetTitle>
          <SheetDescription>{a.subtitle}</SheetDescription>
        </SheetHeader>
        {isLoading ? (
          <div className="space-y-3 py-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : isError ? (
          <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground">
              {a.loadError}: {error instanceof Error ? error.message : ""}
            </p>
            <button
              type="button"
              className="mt-4 min-h-[var(--uix-touch-min)] rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              onClick={() => void refetch()}
              disabled={isFetching}
            >
              {isFetching ? "…" : a.retry}
            </button>
          </div>
        ) : data ? (
          <AnalyticsBody data={data} />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
