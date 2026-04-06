import { PageTitle } from "@/components/PageTitle";
import { Skeleton } from "@/components/ui/skeleton";

/** Первая загрузка iSee (`/reels`): тёмный каркас вертикальной ленты + тонкий оверлей как в основном экране. */
export function ReelsFeedSkeleton() {
  return (
    <div className="relative flex flex-1 min-h-0 flex-col bg-black text-white" aria-busy="true" aria-label="Загрузка iSee">
      <PageTitle title="iSee" />
      <div className="relative min-h-0 flex-1 w-full overflow-hidden bg-black">
        <Skeleton className="absolute inset-0 rounded-none bg-white/[0.07]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 z-40 flex flex-col bg-gradient-to-b from-black/75 via-black/35 to-transparent pb-1">
          <div className="flex h-11 min-h-[var(--uix-touch-min)] items-center gap-1 px-1.5 pt-[env(safe-area-inset-top,0px)]">
            <Skeleton className="h-10 w-10 shrink-0 rounded-full bg-white/12" />
            <div className="min-w-0 flex-1 flex justify-center pr-10">
              <Skeleton className="h-3.5 w-14 rounded-md bg-white/12" />
            </div>
          </div>
          <div className="px-3">
            <Skeleton className="h-0.5 w-full rounded-full bg-white/15" />
          </div>
        </div>
        <div className="absolute bottom-6 left-3 right-[4.5rem] flex flex-col gap-2">
          <Skeleton className="h-10 w-10 shrink-0 rounded-full bg-white/10" />
          <Skeleton className="h-4 w-[55%] max-w-[220px] rounded-md bg-white/10" />
          <Skeleton className="h-3 w-[40%] max-w-[160px] rounded-md bg-white/10" />
        </div>
        <div className="absolute right-2 bottom-28 flex flex-col items-center gap-5">
          {[0, 1, 2, 3].map((k) => (
            <div key={k} className="flex flex-col items-center gap-1">
              <Skeleton className="h-11 w-11 shrink-0 rounded-full bg-white/12" />
              <Skeleton className="h-3 w-6 rounded bg-white/10" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
