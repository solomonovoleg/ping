import { Skeleton } from "@/components/ui/skeleton";

export function VkParserBindingsSkeleton() {
  return (
    <ul className="space-y-3" aria-busy="true" aria-label="Загрузка привязок">
      {[0, 1, 2].map((i) => (
        <li key={i} className="rounded-lg border border-border/80 p-3 flex flex-col sm:flex-row gap-3 justify-between">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-5 w-3/5 max-w-xs" />
            <Skeleton className="h-3.5 w-full max-w-md" />
            <Skeleton className="h-3.5 w-2/3 max-w-sm" />
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Skeleton className="h-9 w-28 rounded-md" />
            <Skeleton className="h-9 w-24 rounded-md" />
            <Skeleton className="h-9 w-9 rounded-md" />
          </div>
        </li>
      ))}
    </ul>
  );
}
