import { Skeleton } from "@/components/ui/skeleton";

/**
 * Каркас вместо голого спиннера при lazy-загрузке тяжёлых страниц (чат, профиль, лента).
 * Универсальный: шапка + полосы контента — снижает ощущение «пустого ожидания».
 */
export function PageRouteFallback() {
  return (
    <div className="flex min-h-[200px] flex-1 flex-col bg-background" aria-busy="true" aria-label="Загрузка экрана">
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border/60 px-3">
        <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <Skeleton className="h-4 w-[40%] max-w-[200px]" />
          <Skeleton className="h-3 w-[28%] max-w-[120px]" />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-3">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-[88%] self-end rounded-2xl rounded-br-md" />
        <Skeleton className="h-14 w-[75%] rounded-2xl rounded-bl-md" />
        <Skeleton className="h-16 w-[82%] self-end rounded-2xl rounded-br-md" />
        <Skeleton className="h-12 w-[55%] rounded-2xl rounded-bl-md" />
      </div>
    </div>
  );
}
