import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { MessageCircle, LayoutDashboard, Settings as SettingsIcon } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { DURATION_FAST_MS, DURATION_NORMAL_MS, EASING_OUT } from "@/lib/motion";
import { usePrefersReducedMotion } from "@/lib/motion";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { triggerSelectionHaptic } from "@/lib/capacitor-native";

import feedIcon from "@/assets/images/feed-icon.png";
const centerLogo = "/F-PING.png?v=5";

/** Порядок вкладок для свайпа: Чаты → Лента → Борд */
const SWIPEABLE_PATHS = ["/", "/posts", "/board"] as const;
const SWIPE_THRESHOLD_PX = 56;
const SWIPE_ANIMATION_MS = 320;

/** Кнопка-логотип: профиль (стена), крупная иконка по центру с лёгкой анимацией */
function NavLogoButton({ onClick }: { onClick: () => void }) {
  return (
    <TapScaleButton
      type="button"
      onClick={onClick}
      haptic
      subtle
      className={cn(
        "flex items-center justify-center flex-1 min-h-[var(--uix-touch-min)] relative min-w-0 max-w-[80px]",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 rounded-full",
        "transition-transform ease-out"
      )}
      style={{ transitionDuration: `${DURATION_FAST_MS}ms`, transitionTimingFunction: EASING_OUT }}
      aria-label="Моя страница (профиль)"
      title="Моя страница"
    >
      <div className="relative flex items-center justify-center w-14 h-14">
        <img
          src={centerLogo}
          alt=""
          className="w-12 h-12 object-contain select-none pointer-events-none relative z-10 animate-ping-logo"
        />
      </div>
    </TapScaleButton>
  );
}

interface AppLayoutProps {
  children: React.ReactNode;
}

const navItemsLeft = [
  { id: "chats", path: "/", icon: MessageCircle, label: "Чаты" },
  { id: "posts", path: "/posts", customIcon: feedIcon, label: "Лента" },
];
const navItemsRight = [
  { id: "board", path: "/board", icon: LayoutDashboard, label: "Борд" },
  { id: "settings", path: "/settings", icon: SettingsIcon, label: "Настройки" },
];

export default function AppLayout({ children }: AppLayoutProps) {
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const reducedMotion = usePrefersReducedMotion();

  // Мягкие свайпы между экранами: направление анимации (null = по тапу в навбаре)
  const [transitionDirection, setTransitionDirection] = useState<"left" | "right" | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const basePath = location.split("?")[0];
  const contentKey = basePath;
  const isProfilePage = /^\/(profile|id)(\/|$)/.test(basePath);

  const swipeableIndex = SWIPEABLE_PATHS.indexOf(basePath as (typeof SWIPEABLE_PATHS)[number]);
  const isSwipeable = swipeableIndex >= 0;

  const handleSwipeEnd = useCallback(
    (deltaX: number, deltaY: number) => {
      if (!isSwipeable || reducedMotion) return;
      if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX || Math.abs(deltaX) < Math.abs(deltaY)) return;

      if (deltaX < 0 && swipeableIndex < SWIPEABLE_PATHS.length - 1) {
        triggerSelectionHaptic();
        setTransitionDirection("right");
        setLocation(SWIPEABLE_PATHS[swipeableIndex + 1]);
      } else if (deltaX > 0 && swipeableIndex > 0) {
        triggerSelectionHaptic();
        setTransitionDirection("left");
        setLocation(SWIPEABLE_PATHS[swipeableIndex - 1]);
      }
    },
    [isSwipeable, reducedMotion, swipeableIndex, setLocation]
  );

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!isSwipeable) return;
      const t = e.touches[0];
      touchStartRef.current = { x: t.clientX, y: t.clientY };
    },
    [isSwipeable]
  );

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!isSwipeable || !touchStartRef.current) return;
      const t = e.changedTouches[0];
      const deltaX = t.clientX - touchStartRef.current.x;
      const deltaY = t.clientY - touchStartRef.current.y;
      touchStartRef.current = null;
      handleSwipeEnd(deltaX, deltaY);
    },
    [isSwipeable, handleSwipeEnd]
  );

  // Сброс направления после анимации перехода (чтобы следующий переход по тапу был с дефолтной анимацией)
  useEffect(() => {
    if (transitionDirection === null) return;
    const t = setTimeout(() => setTransitionDirection(null), SWIPE_ANIMATION_MS);
    return () => clearTimeout(t);
  }, [basePath, transitionDirection]);

  // Список чатов обновляется в реальном времени (новые сообщения, отметка прочитанным)
  useEffect(() => {
    const handler = () => {
      queryClient.invalidateQueries({ queryKey: ["chats"] });
      queryClient.refetchQueries({ queryKey: ["chats"] });
    };
    window.addEventListener("ping:chat-list-update", handler);
    return () => window.removeEventListener("ping:chat-list-update", handler);
  }, [queryClient]);

  const renderNavButton = (item: (typeof navItemsLeft)[number]) => {
    const isActive =
      location === item.path ||
      (item.path === "/" && location.startsWith("/chat/")) ||
      (item.path === "/posts" && location.startsWith("/posts"));
    const Icon = item.icon;
    return (
      <TapScaleButton
        key={item.id}
        type="button"
        haptic
        subtle
        onClick={() => setLocation(item.path)}
        className="flex flex-col items-center justify-center flex-1 min-h-[var(--uix-touch-min)] pt-1 pb-1 gap-1 relative transition-colors duration-75"
        data-testid={`mobile-nav-${item.id}`}
        aria-label={item.label}
      >
        <div className="relative flex items-center justify-center w-8 h-8">
          <div className={cn(
            "absolute inset-0 bg-primary/10 rounded-full scale-0 transition-transform duration-150",
            isActive && "scale-100"
          )} />
          {item.customIcon ? (
            <img
              src={item.customIcon}
              alt={item.label}
              className={cn(
                "w-5 h-5 object-contain transition-all duration-150 relative z-10",
                !isActive && "opacity-60 grayscale"
              )}
            />
          ) : Icon && (
            <Icon className={cn(
              "w-5 h-5 transition-colors duration-150 relative z-10",
              isActive ? "text-primary" : "text-muted-foreground"
            )} />
          )}
        </div>
        <span className={cn(
          "text-[10px] font-medium transition-colors duration-150",
          isActive ? "text-primary" : "text-muted-foreground"
        )}>
          {item.label}
        </span>
      </TapScaleButton>
    );
  };

  return (
    <div className="flex h-full min-h-[100dvh] w-full min-w-0 bg-background overflow-x-visible overflow-y-hidden items-center justify-center">
      <div
        className={cn(
          "relative w-full h-full max-w-[480px] mx-auto flex flex-col bg-background shadow-2xl overflow-x-visible overflow-y-hidden min-h-0 min-w-0 shrink-0"
        )}
        style={{
          paddingLeft: "env(safe-area-inset-left, 0px)",
          paddingRight: "env(safe-area-inset-right, 0px)",
        }}
      >
        {/* Контент: единственная скроллируемая область; при смене маршрута — плавное появление; свайп влево/вправо между Чаты↔Лента↔Борд */}
        <main
          className="flex-1 min-h-0 min-w-0 relative flex flex-col overflow-y-auto overflow-x-visible w-full max-w-full bg-background pt-[env(safe-area-inset-top,0px)] pb-[var(--uix-nav-bottom)]"
          style={{ WebkitOverflowScrolling: "touch" }}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <div
            key={contentKey}
            className={cn(
              "flex flex-col min-h-full min-w-0 w-full",
              !reducedMotion && "animate-in fade-in duration-300",
              !reducedMotion && transitionDirection === "right" && "slide-in-from-right",
              !reducedMotion && transitionDirection === "left" && "slide-in-from-left",
              !reducedMotion && transitionDirection === null && "slide-in-from-bottom-2"
            )}
            style={
              !reducedMotion && (transitionDirection === "left" || transitionDirection === "right")
                ? { animationDuration: `${SWIPE_ANIMATION_MS}ms` }
                : undefined
            }
          >
            {children}
          </div>
        </main>

        {/* Нижнее меню: всегда на экране, логотип по центру (пока неактивная кнопка) */}
        <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/50 bg-background/95 backdrop-blur-md pb-[env(safe-area-inset-bottom,0px)] [padding-left:env(safe-area-inset-left,0px)] [padding-right:env(safe-area-inset-right,0px)]">
          <div className="max-w-[480px] mx-auto flex justify-around items-center min-h-[var(--uix-nav-height)] h-14 px-2 min-w-0 sm:px-4 sm:h-16 w-full">
            <div className="flex flex-1 justify-around items-stretch">
              {navItemsLeft.map(renderNavButton)}
            </div>
            <div className="flex flex-1 justify-center items-stretch min-w-0">
              <NavLogoButton onClick={() => setLocation("/profile/me")} />
            </div>
            <div className="flex flex-1 justify-around items-stretch">
              {navItemsRight.map(renderNavButton)}
            </div>
          </div>
        </nav>
      </div>
    </div>
  );
}