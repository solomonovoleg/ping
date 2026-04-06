import { ChevronLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type Props = {
  onBack: () => void;
};

/** Загрузка экрана одного поста: шапка как у PostDetail + каркас карточки. */
export function PostDetailSkeleton({ onBack }: Props) {
  return (
    <div className="flex flex-col h-full min-h-[200px] bg-background" aria-busy="true" aria-label="Загрузка поста">
      <div className="uix-content-x py-[var(--uix-space-3)] flex items-center border-b border-border/40 bg-background/95 backdrop-blur">
        <button
          type="button"
          onClick={onBack}
          className="p-2 -ml-2 rounded-full hover:bg-secondary/80 text-foreground min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] flex items-center justify-center transition-colors"
          aria-label="Назад к профилю"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      </div>
      <div className="flex-1 uix-content-x py-[var(--uix-space-4)] flex flex-col gap-[var(--uix-space-4)]">
        <div className="flex items-start gap-[var(--uix-space-3)]">
          <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
          <div className="flex min-w-0 flex-1 flex-col gap-2 pt-0.5">
            <Skeleton className="h-4 w-[38%] max-w-[180px] rounded-md" />
            <Skeleton className="h-3 w-[22%] max-w-[100px] rounded-md" />
          </div>
        </div>
        <Skeleton className="h-52 w-full max-w-full rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-3.5 w-full rounded-md" />
          <Skeleton className="h-3.5 w-[92%] rounded-md" />
          <Skeleton className="h-3.5 w-[70%] rounded-md" />
        </div>
        <div className="flex gap-4 pt-1">
          <Skeleton className="h-4 w-16 rounded-md" />
          <Skeleton className="h-4 w-16 rounded-md" />
          <Skeleton className="h-4 w-12 rounded-md" />
        </div>
      </div>
    </div>
  );
}
