import { Skeleton } from "@/components/ui/skeleton";

/** Скелетон при переключении «Входящие / Исходящие» или коротком refetch. */
export function PushFeedScopeSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-2xl border border-border/40 bg-card/50 p-3"
        >
          <div className="flex gap-2.5">
            <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-3.5 w-[40%] rounded-md" />
              <Skeleton className="h-3 w-[55%] rounded-md opacity-80" />
              <Skeleton className="mt-2 h-20 w-full rounded-xl opacity-70" />
              <Skeleton className="h-8 w-full rounded-xl opacity-60" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
