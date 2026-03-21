import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { MessageCircle, LayoutDashboard, Settings as SettingsIcon, type LucideIcon } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { onChatListUpdate, onIncomingChatMessageHint } from "@/features/chat/realtime-events";
import { useAuth } from "@/contexts/AuthContext";
import { playIncomingChatMessageSound } from "@/lib/send-sound";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/lib/motion";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { triggerSelectionHaptic } from "@/lib/capacitor-native";
import { PlatformAnnouncementBar } from "@/features/admin-ops/PlatformAnnouncementBar";
import { usePreferPhoneChrome } from "@/hooks/use-prefer-phone-chrome";

import feedIcon from "@/assets/images/feed-icon.png";

/** Логотип в центре полосы — файл `client/public/F-PING.png` (замените PNG при необходимости) */
const PULSE_NAV_LOGO_SRC = "/F-PING.png?v=6";

/** Порядок вкладок для свайпа: Чаты → Лента → Борд */
const SWIPEABLE_PATHS = ["/", "/posts", "/board"] as const;
const SWIPE_THRESHOLD_PX = 56;
const SWIPE_ANIMATION_MS = 320;

/** Центр навбара: только логотип, крупно + мягкая анимация (`animate-ping-logo` в index.css). */
function NavPulseCenterButton({ isActive, onClick }: { isActive: boolean; onClick: () => void }) {
  return (
    <TapScaleButton
      type="button"
      onClick={onClick}
      haptic
      subtle
      data-testid="mobile-nav-pulse"
      aria-label="Моя страница"
      title="Моя страница"
      className={cn(
        "relative flex min-h-[var(--uix-touch-min)] min-w-0 max-w-[100px] flex-1 items-end justify-center pb-1 pt-1",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-2xl"
      )}
    >
      <div className="relative flex h-[52px] w-[52px] shrink-0 items-center justify-center">
        <div
          className={cn(
            "absolute inset-0 scale-0 rounded-full bg-primary/12 transition-transform duration-150",
            isActive && "scale-100"
          )}
        />
        <img
          src={PULSE_NAV_LOGO_SRC}
          alt=""
          className="relative z-10 h-[38px] w-[38px] object-contain select-none pointer-events-none animate-ping-logo"
        />
      </div>
    </TapScaleButton>
  );
}

interface AppLayoutProps {
  children: React.ReactNode;
}

type AppNavItem = {
  id: string;
  path: string;
  label: string;
  icon?: LucideIcon;
  customIcon?: string;
};

const navItemsLeft: AppNavItem[] = [
  { id: "chats", path: "/", icon: MessageCircle, label: "Чаты" },
  { id: "posts", path: "/posts", customIcon: feedIcon, label: "Лента" },
];
const navItemsRight: AppNavItem[] = [
  { id: "board", path: "/board", icon: LayoutDashboard, label: "Борд" },
  /** Как в макете: подпись «Профиль», иконка шестерёнки → настройки аккаунта */
  { id: "profile", path: "/settings", icon: SettingsIcon, label: "Профиль" },
];

export default function AppLayout({ children }: AppLayoutProps) {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  /** Свежий id для глобальных событий (без опоры на замыкание `user` внутри long-lived listener). */
  const selfUserIdRef = useRef<string | undefined>(undefined);
  selfUserIdRef.current = user?.id ?? undefined;
  const queryClient = useQueryClient();
  const reducedMotion = usePrefersReducedMotion();
  const preferPhoneChrome = usePreferPhoneChrome();

  // Мягкие свайпы между экранами: направление анимации (null = по тапу в навбаре)
  const [transitionDirection, setTransitionDirection] = useState<"left" | "right" | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const basePath = location.split("?")[0];
  const contentKey = basePath;
  /** В экране чата нижняя полоса скрыта (полноэкранный чат) */
  const isChatPage = /^\/chat\//.test(basePath);

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
    return onChatListUpdate(handler);
  }, [queryClient]);

  // Звук входящего по событию с сервера (в т.ч. новая группа до подписки на chat-message)
  useEffect(() => {
    return onIncomingChatMessageHint(({ chatId, senderId }) => {
      const myId = selfUserIdRef.current;
      if (!myId || senderId === myId) return;
      const path = location.split("?")[0];
      const openMatch = path.match(/^\/chat\/([^/]+)/);
      const openChatId = openMatch?.[1] ? decodeURIComponent(openMatch[1]) : null;
      const viewingThisChat =
        openChatId === chatId && typeof document !== "undefined" && document.visibilityState === "visible";
      if (!viewingThisChat) {
        playIncomingChatMessageSound();
      }
    });
  }, [location]);

  const renderNavButton = (item: AppNavItem) => {
    const isActive =
      item.path === "/"
        ? basePath === "/"
        : item.path === "/posts"
          ? basePath.startsWith("/posts")
          : item.path === "/board"
            ? basePath.startsWith("/board")
            : item.path === "/settings"
              ? basePath.startsWith("/settings")
              : location === item.path;
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
          "text-[9px] font-medium transition-colors duration-150",
          isActive ? "text-primary" : "text-muted-foreground"
        )}>
          {item.label}
        </span>
      </TapScaleButton>
    );
  };

  return (
    <div
      className={cn(
        "flex h-full min-h-[100dvh] w-full min-w-0 bg-background overflow-x-visible overflow-y-hidden",
        preferPhoneChrome ? "items-center justify-center" : "items-stretch justify-stretch",
      )}
    >
      <div
        className={cn(
          "relative flex h-full min-h-0 min-w-0 w-full shrink-0 flex-col overflow-x-visible overflow-y-hidden bg-background",
          preferPhoneChrome ? "mx-auto max-w-[480px] shadow-2xl" : "max-w-none shadow-none",
        )}
        style={{
          paddingLeft: "env(safe-area-inset-left, 0px)",
          paddingRight: "env(safe-area-inset-right, 0px)",
        }}
      >
        {/* Контент: единственная скроллируемая область; при смене маршрута — плавное появление; свайп влево/вправо между Чаты↔Лента↔Борд */}
        <main
          className={cn(
            "flex-1 min-h-0 min-w-0 relative flex flex-col overflow-y-auto overflow-x-visible w-full max-w-full bg-background pt-[env(safe-area-inset-top,0px)]",
            isChatPage ? "pb-0" : "pb-[var(--uix-nav-bottom)]"
          )}
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
            <PlatformAnnouncementBar />
            {children}
          </div>
        </main>

        {/* Нижнее меню PULSE: 5 пунктов, в чате скрыто */}
        <nav
          className={cn(
            "fixed bottom-0 left-0 right-0 z-50 overflow-visible border-t border-border/50 bg-background/95 backdrop-blur-md pb-[env(safe-area-inset-bottom,0px)] [padding-left:env(safe-area-inset-left,0px)] [padding-right:env(safe-area-inset-right,0px)]",
            isChatPage && "hidden"
          )}
        >
          <div
            className={cn(
              "mx-auto flex min-h-[var(--uix-nav-height)] w-full min-w-0 items-end justify-between gap-0.5 px-1.5 pt-1 sm:px-3",
              preferPhoneChrome ? "max-w-[480px]" : "max-w-none",
            )}
          >
            {navItemsLeft.map(renderNavButton)}
            <NavPulseCenterButton
              isActive={basePath.replace(/\/$/, "") === "/profile/me"}
              onClick={() => setLocation("/profile/me")}
            />
            {navItemsRight.map(renderNavButton)}
          </div>
        </nav>
      </div>
    </div>
  );
}