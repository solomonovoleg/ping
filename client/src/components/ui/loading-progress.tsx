/**
 * Кружок прогресса поверх контента — как в Telegram/VK.
 * Показывается поверх области загрузки, не заменяет контент скелетонами.
 */
import { usePrefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

type LoadingProgressProps = {
  /** Показывать оверлей с кружком */
  loading: boolean;
  /** 0–100 для детерминированного прогресса (например загрузка файла); без value — индетерминант (крутится) */
  value?: number;
  /** Контент, поверх которого показывается прогресс */
  children: React.ReactNode;
  className?: string;
  /** Минимальная высота области (чтобы кружок не сжимался) */
  minHeight?: string;
};

export function LoadingProgress({
  loading,
  value,
  children,
  className,
  minHeight = "120px",
}: LoadingProgressProps) {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <div className={cn("relative min-w-0", className)} style={{ minHeight: loading ? minHeight : undefined }}>
      {children}
      {loading && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-[1px] rounded-lg z-10"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="flex flex-col items-center gap-2">
            {value != null && value >= 0 && value <= 100 ? (
              <>
                <div
                  className={cn(
                    "w-10 h-10 rounded-full border-2 border-primary/30 border-t-primary flex-shrink-0",
                    !reducedMotion && "animate-spin"
                  )}
                  style={reducedMotion ? { opacity: 0.8 } : { animationDuration: "0.7s" }}
                  role="progressbar"
                  aria-valuenow={Math.round(value)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Загрузка"
                />
                <span className="text-xs font-medium text-muted-foreground">{Math.round(value)}%</span>
              </>
            ) : (
              <div
                className={cn(
                  "w-10 h-10 rounded-full border-2 border-primary/30 border-t-primary flex-shrink-0",
                  !reducedMotion && "animate-spin"
                )}
                style={reducedMotion ? { opacity: 0.8 } : { animationDuration: "0.7s" }}
                role="status"
                aria-label="Загрузка"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
