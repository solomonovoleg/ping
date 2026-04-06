import { Skeleton } from "@/components/ui/skeleton";
import { adminSkeletonClass } from "@/features/admin-shell";
import { cn } from "@/lib/utils";

export function VkParserQueueSkeleton() {
  return (
    <ul className="space-y-4" aria-busy="true" aria-label="Загрузка очереди">
      {[0, 1, 2].map((i) => (
        <li key={i} className="rounded-lg border border-[hsl(var(--admin-border)/0.45)] p-3 space-y-3">
          <div className="flex justify-between gap-2">
            <Skeleton className={cn("h-3.5 w-32", adminSkeletonClass)} />
            <Skeleton className={cn("h-5 w-20 rounded-md", adminSkeletonClass)} />
          </div>
          <Skeleton className={cn("h-4 w-full", adminSkeletonClass)} />
          <Skeleton className={cn("h-4 w-4/5", adminSkeletonClass)} />
          <div className="flex gap-2">
            <Skeleton className={cn("h-20 w-20 rounded-md shrink-0", adminSkeletonClass)} />
            <Skeleton className={cn("h-20 w-20 rounded-md shrink-0", adminSkeletonClass)} />
          </div>
          <div className="flex gap-2 pt-1">
            <Skeleton className={cn("h-9 w-24 rounded-md", adminSkeletonClass)} />
            <Skeleton className={cn("h-9 w-28 rounded-md", adminSkeletonClass)} />
          </div>
        </li>
      ))}
    </ul>
  );
}
