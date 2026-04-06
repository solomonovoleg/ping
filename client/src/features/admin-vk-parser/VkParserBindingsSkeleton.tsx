import { Skeleton } from "@/components/ui/skeleton";
import { adminSkeletonClass } from "@/features/admin-shell";
import { cn } from "@/lib/utils";

export function VkParserBindingsSkeleton() {
  return (
    <ul className="space-y-3" aria-busy="true" aria-label="Загрузка привязок">
      {[0, 1, 2].map((i) => (
        <li
          key={i}
          className="rounded-lg border border-[hsl(var(--admin-border)/0.45)] p-3 flex flex-col sm:flex-row gap-3 justify-between"
        >
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className={cn("h-5 w-3/5 max-w-xs", adminSkeletonClass)} />
            <Skeleton className={cn("h-3.5 w-full max-w-md", adminSkeletonClass)} />
            <Skeleton className={cn("h-3.5 w-2/3 max-w-sm", adminSkeletonClass)} />
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Skeleton className={cn("h-9 w-28 rounded-md", adminSkeletonClass)} />
            <Skeleton className={cn("h-9 w-24 rounded-md", adminSkeletonClass)} />
            <Skeleton className={cn("h-9 w-9 rounded-md", adminSkeletonClass)} />
          </div>
        </li>
      ))}
    </ul>
  );
}
