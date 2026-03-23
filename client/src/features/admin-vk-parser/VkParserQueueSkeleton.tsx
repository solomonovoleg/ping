import { Skeleton } from "@/components/ui/skeleton";

export function VkParserQueueSkeleton() {
  return (
    <ul className="space-y-4" aria-busy="true" aria-label="Загрузка очереди">
      {[0, 1, 2].map((i) => (
        <li key={i} className="rounded-lg border border-border/80 p-3 space-y-3">
          <div className="flex justify-between gap-2">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-5 w-20 rounded-md" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <div className="flex gap-2">
            <Skeleton className="h-20 w-20 rounded-md shrink-0" />
            <Skeleton className="h-20 w-20 rounded-md shrink-0" />
          </div>
          <div className="flex gap-2 pt-1">
            <Skeleton className="h-9 w-24 rounded-md" />
            <Skeleton className="h-9 w-28 rounded-md" />
          </div>
        </li>
      ))}
    </ul>
  );
}
