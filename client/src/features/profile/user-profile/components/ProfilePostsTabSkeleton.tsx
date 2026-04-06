import { Skeleton } from "@/components/ui/skeleton";

/** Сетка превью на вкладке «Посты» (режим сетки), первая загрузка. */
export function ProfilePostsGridSkeleton() {
  return (
    <div
      className="grid grid-cols-3 gap-px"
      aria-busy="true"
      aria-label="Загрузка постов"
    >
      {Array.from({ length: 9 }, (_, i) => (
        <Skeleton key={i} className="aspect-square w-full rounded-none bg-primary/12" />
      ))}
    </div>
  );
}

/** Пока неизвестен authorId профиля — компактный блок. */
export function ProfilePostsAuthorPendingSkeleton() {
  return (
    <div className="flex flex-col gap-3 px-1 py-2" aria-busy="true" aria-label="Загрузка профиля">
      <Skeleton className="h-4 w-[40%] max-w-[160px] rounded-md" />
      <Skeleton className="h-32 w-full rounded-lg" />
    </div>
  );
}
