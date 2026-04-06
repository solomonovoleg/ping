import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { FeedQuickActionsAside, type FeedQuickActionsAsideContext } from "./FeedQuickActionsAside";

type FeedDesktopColumnShellProps = {
  children: ReactNode;
  /** Если не передан — показывается панель быстрых действий (как в ленте) */
  aside?: ReactNode;
  quickActionsContext?: FeedQuickActionsAsideContext;
} & Omit<ComponentPropsWithoutRef<"div">, "children">;

/**
 * Десктоп: центральная колонка до 760px (от 1024px), справа панель 280px от 1500px — как у ленты.
 */
export function FeedDesktopColumnShell({
  children,
  aside,
  quickActionsContext = "feed",
  className,
  ...rootProps
}: FeedDesktopColumnShellProps) {
  return (
    <div
      className={cn(
        "flex flex-1 min-h-0 h-full w-full max-w-full min-w-0 overflow-x-hidden justify-center bg-background",
        className,
      )}
      {...rootProps}
    >
      <div className="flex w-full min-h-0 min-w-0 flex-1 justify-center gap-6 px-0 min-[1500px]:max-w-[1120px] min-[1500px]:px-4">
        <div className="relative w-full max-w-full min-w-0 flex-1 min-h-0 flex flex-col bg-background min-[1024px]:max-w-[760px]">
          {children}
        </div>
        {aside ?? <FeedQuickActionsAside context={quickActionsContext} />}
      </div>
    </div>
  );
}
