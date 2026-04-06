import { TapScaleButton } from "@/components/ui/tap-scale";
import { cn } from "@/lib/utils";
import type { CompanionSurfaceId } from "./types";
import { COMPANION_SURFACE_LABEL } from "./surface-labels";

type Props = {
  visible: CompanionSurfaceId[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  className?: string;
};

/**
 * Горизонтальная «рейка» разделов: без вложенных плашек и фонов у каждого пункта —
 * только типографика, тонкие разделители и одна линия снизу (премиум-минимализм).
 */
export function CompanionSurfaceDots({ visible, selectedIndex, onSelect, className }: Props) {
  return (
    <div className={cn("bg-transparent", className)} role="tablist" aria-label="Вкладки кампании">
      <div
        className={cn(
          "flex min-h-10 items-stretch overflow-x-auto overscroll-x-contain",
          "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        )}
      >
        {visible.map((id, i) => {
          const active = i === selectedIndex;
          return (
            <TapScaleButton
              key={id}
              type="button"
              haptic
              subtle
              role="tab"
              aria-selected={active}
              aria-label={COMPANION_SURFACE_LABEL[id]}
              onClick={() => onSelect(i)}
              className={cn(
                "relative shrink-0 rounded-none border-0 bg-transparent px-2.5 py-2.5 text-[11px] font-light tracking-wide shadow-none ring-0 transition-colors first:pl-1 sm:px-3 sm:first:pl-2",
                "hover:bg-transparent focus-visible:ring-2 focus-visible:ring-primary/40",
                active
                  ? "text-primary"
                  : "text-primary/55 hover:text-primary/90 dark:text-primary/50 dark:hover:text-primary/85",
              )}
            >
              <span className="inline-flex items-center gap-2">
                <span
                  className={cn(
                    "shrink-0 rounded-full transition-all duration-300",
                    active
                      ? "h-1.5 w-1.5 bg-primary shadow-[0_0_10px_hsl(var(--primary)/0.65)]"
                      : "h-1 w-1 bg-primary/30",
                  )}
                  aria-hidden
                />
                <span className="whitespace-nowrap">{COMPANION_SURFACE_LABEL[id]}</span>
              </span>
              {active ? (
                <span
                  className="pointer-events-none absolute bottom-0 left-1/2 h-0.5 w-9 max-w-[calc(100%-12px)] -translate-x-1/2 rounded-full bg-primary"
                  aria-hidden
                />
              ) : null}
            </TapScaleButton>
          );
        })}
      </div>
    </div>
  );
}
