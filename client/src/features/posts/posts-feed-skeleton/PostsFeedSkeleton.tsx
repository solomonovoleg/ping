import { Skeleton } from "@/components/ui/skeleton";

const DEFAULT_PLACEHOLDERS = 4;

/**
 * Скелетон первой загрузки ленты постов (как у строки поста: аватар, текст, медиа-блок).
 */
export function PostsFeedSkeleton({ count = DEFAULT_PLACEHOLDERS }: { count?: number }) {
  return (
    <div
      className="flex flex-col uix-content-x gap-0"
      aria-busy="true"
      aria-label="Загрузка ленты постов"
    >
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="border-b border-border/20 py-[var(--uix-space-4)] flex flex-col gap-[var(--uix-space-3)]"
        >
          <div className="flex items-start gap-[var(--uix-space-3)]">
            <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
            <div className="flex min-w-0 flex-1 flex-col gap-2 pt-0.5">
              <Skeleton className="h-4 w-[42%] max-w-[200px] rounded-md" />
              <Skeleton className="h-3 w-[28%] max-w-[120px] rounded-md" />
            </div>
          </div>
          <Skeleton className="h-48 w-full max-w-full rounded-lg" />
          <div className="flex gap-4 pt-1">
            <Skeleton className="h-4 w-14 rounded-md" />
            <Skeleton className="h-4 w-14 rounded-md" />
            <Skeleton className="h-4 w-10 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}
