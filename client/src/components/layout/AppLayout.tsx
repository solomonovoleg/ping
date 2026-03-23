import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { MessageCircle, LayoutDashboard, Settings as SettingsIcon, type LucideIcon } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  emitChatPendingUnread,
  onChatListUpdate,
  onIncomingChatMessageHint,
  onGroupCallInvite,
} from "@/features/chat/realtime-events";
import { useAuth } from "@/contexts/AuthContext";
import { useGroupCallContext } from "@/contexts/GroupCallContext";
import { isGroupCallModuleEnabled } from "@/features/group-call/flags";
import {
  startGroupCallInviteAlert,
  showNewChatMessageBrowserNotificationIfHidden,
} from "@/lib/incoming-call-alert";
import { markGroupCallInviteRingFromWebSocket } from "@/lib/group-call-invite-dedupe";
import { playIncomingChatMessageSound } from "@/lib/send-sound";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/lib/motion";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { triggerSelectionHaptic } from "@/lib/capacitor-native";
import { PlatformAnnouncementBar } from "@/features/admin-ops/PlatformAnnouncementBar";
import { usePreferPhoneChrome } from "@/hooks/use-prefer-phone-chrome";
import { usePingokRemindersPoll } from "@/hooks/usePingokRemindersPoll";
import { usePingokScheduledCallsPreEventPoll } from "@/hooks/usePingokScheduledCallsPreEventPoll";

import feedIcon from "@/assets/images/feed-icon.png";
import { NavPulseCenterLogoButton } from "@/components/layout/NavPulseCenterLogoButton";

/** Логотип в центре полосы — файл `client/public/F-PING.png` (замените PNG при необходимости) */
const PULSE_NAV_LOGO_SRC = "/F-PING.png?v=6";

/** Порядок вкладок для свайпа: Чаты → Лента → Борд */
const SWIPEABLE_PATHS = ["/", "/posts", "/board"] as const;
const SWIPE_THRESHOLD_PX = 56;
const SWIPE_EDGE_START_PX = 28;
const SWIPE_ANIMATION_MS = 320;

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
  const groupCallCtx = useGroupCallContext();
  /** Свежий id для глобальных событий (без опоры на замыкание `user` внутри long-lived listener). */
  const selfUserIdRef = useRef<string | undefined>(undefined);
  selfUserIdRef.current = user?.id ?? undefined;
  const activeGroupRoomIdRef = useRef<string | null>(null);
  activeGroupRoomIdRef.current = groupCallCtx.active?.roomId ?? null;
  const stopGroupInviteAlertRef = useRef<(() => void) | null>(null);
  const pendingGroupInviteRoomIdRef = useRef<string | null>(null);
  const queryClient = useQueryClient();
  const reducedMotion = usePrefersReducedMotion();
  const preferPhoneChrome = usePreferPhoneChrome();
  usePingokRemindersPoll(Boolean(user?.id));
  usePingokScheduledCallsPreEventPoll(Boolean(user?.id));

  // Мягкие свайпы между экранами: направление анимации (null = по тапу в навбаре)
  const [transitionDirection, setTransitionDirection] = useState<"left" | "right" | null>(null);
  const touchStartRef = useRef<{ x: number; y: number; edge: "left" | "right" | "none" } | null>(
    null
  );

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
      const w = window.innerWidth || document.documentElement.clientWidth || 0;
      const edge =
        t.clientX <= SWIPE_EDGE_START_PX
          ? "left"
          : t.clientX >= w - SWIPE_EDGE_START_PX
            ? "right"
            : "none";
      touchStartRef.current = { x: t.clientX, y: t.clientY, edge };
    },
    [isSwipeable]
  );

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!isSwipeable || !touchStartRef.current) return;
      if (touchStartRef.current.edge === "none") {
        touchStartRef.current = null;
        return;
      }
      const t = e.changedTouches[0];
      const deltaX = t.clientX - touchStartRef.current.x;
      const deltaY = t.clientY - touchStartRef.current.y;
      const edge = touchStartRef.current.edge;
      touchStartRef.current = null;
      // Global page swipe only from edge and only in matching direction:
      // left edge -> swipe right (back), right edge -> swipe left (next).
      if ((deltaX > 0 && edge !== "left") || (deltaX < 0 && edge !== "right")) return;
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
        showNewChatMessageBrowserNotificationIfHidden();
        emitChatPendingUnread({ chatId });
      }
    });
  }, [location]);

  // Групповой созвон: WS-приглашение — тот же рингтон и уведомление, что у личного звонка
  useEffect(() => {
    if (!isGroupCallModuleEnabled()) return () => {};
    return onGroupCallInvite((detail) => {
      const myId = selfUserIdRef.current;
      if (!myId || detail.hostUserId === myId) return;
      if (activeGroupRoomIdRef.current === detail.roomId) return;
      stopGroupInviteAlertRef.current?.();
      pendingGroupInviteRoomIdRef.current = detail.roomId;
      markGroupCallInviteRingFromWebSocket(detail.roomId);
      const label = detail.chatTitle?.trim() || "Групповой чат";
      stopGroupInviteAlertRef.current = startGroupCallInviteAlert({
        chatLabel: label,
        mediaType: detail.mediaType,
        onNotificationClick: () => setLocation(`/chat/${encodeURIComponent(detail.chatId)}`),
      });
    });
  }, [setLocation]);

  useEffect(() => {
    const rid = groupCallCtx.active?.roomId ?? null;
    if (!rid || pendingGroupInviteRoomIdRef.current !== rid) return;
    stopGroupInviteAlertRef.current?.();
    stopGroupInviteAlertRef.current = null;
    pendingGroupInviteRoomIdRef.current = null;
  }, [groupCallCtx.active?.roomId]);

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
        className="flex flex-col items-center justify-center flex-1 min-h-[var(--uix-touch-min)] pt-0 pb-1 gap-1 relative transition-colors duration-75"
        data-testid={`mobile-nav-${item.id}`}
        data-pingok-flight-target={item.id === "chats" ? "chats" : item.id === "board" ? "board" : undefined}
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
            "fixed bottom-0 z-50 overflow-visible border-t border-border/50 bg-background/95 backdrop-blur-md pb-[env(safe-area-inset-bottom,0px)] [padding-left:env(safe-area-inset-left,0px)] [padding-right:env(safe-area-inset-right,0px)]",
            preferPhoneChrome
              ? "left-1/2 w-[min(100vw,480px)] max-w-full -translate-x-1/2"
              : "left-0 right-0",
            isChatPage && "hidden"
          )}
        >
          <div
            className={cn(
              "mx-auto grid min-h-[var(--uix-nav-height)] w-full min-w-0 grid-cols-[1fr_minmax(5.5rem,7rem)_1fr] items-stretch gap-x-0.5 px-1.5 pt-[5px] pb-1.5 sm:px-3",
              preferPhoneChrome ? "max-w-[480px]" : "max-w-none",
            )}
          >
            <div className="flex min-w-0 items-start justify-start gap-0.5">
              {navItemsLeft.map(renderNavButton)}
            </div>
            <div className="pointer-events-none relative z-10 flex min-h-0 min-w-0 justify-center self-stretch overflow-visible">
              <div className="pointer-events-auto absolute bottom-0 left-1/2 -translate-x-1/2">
                <NavPulseCenterLogoButton
                  isActive={basePath.replace(/\/$/, "") === "/profile/me"}
                  logoSrc={PULSE_NAV_LOGO_SRC}
                  onShortPress={() => setLocation("/profile/me")}
                />
              </div>
            </div>
            <div className="flex min-w-0 items-start justify-end gap-0.5">
              {navItemsRight.map(renderNavButton)}
            </div>
          </div>
        </nav>
      </div>
    </div>
  );
}