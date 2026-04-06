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
import { useRealtimeContext } from "@/contexts/RealtimeContext";
import { useGroupCallContext } from "@/contexts/GroupCallContext";
import { isGroupCallModuleEnabled } from "@/features/group-call/flags";
import {
  startGroupCallInviteAlert,
  showNewChatMessageBrowserNotificationIfHidden,
} from "@/lib/incoming-call-alert";
import { markGroupCallInviteRingFromWebSocket } from "@/lib/group-call-invite-dedupe";
import { playIncomingChatMessageSound } from "@/lib/send-sound";
import { cn } from "@/lib/utils";
import { DURATION_FAST_MS, DURATION_NORMAL_MS, usePrefersReducedMotion } from "@/lib/motion";
import {
  EDGE_SWIPE,
  MAIN_TAB_PAGER_SWIPE,
  edgeNavSwipeShouldCancelAsVerticalScroll,
  mainTabPagerEdgeZonePx,
  mainTabPagerShouldCommitSwipeLeft,
  mainTabPagerShouldCommitSwipeRight,
} from "@/lib/touch-edge-swipe-physics";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { triggerSelectionHaptic } from "@/lib/capacitor-native";
import { PlatformAnnouncementBar } from "@/features/admin-ops/PlatformAnnouncementBar";
import { usePreferPhoneChrome } from "@/hooks/use-prefer-phone-chrome";
import { usePingokRemindersPoll } from "@/hooks/usePingokRemindersPoll";
import { usePingokScheduledCallsPreEventPoll } from "@/hooks/usePingokScheduledCallsPreEventPoll";
import Chats from "@/pages/Chats";
import { DesktopMainPlaceholder } from "@/components/layout/DesktopMainPlaceholder";
import { DesktopMainSurface } from "@/components/layout/DesktopMainSurface";
import { FeedDesktopColumnShell } from "@/components/layout/FeedDesktopColumnShell";

import feedIcon from "@/assets/images/feed-icon.png";
import { NavPulseCenterLogoButton } from "@/components/layout/NavPulseCenterLogoButton";
import { GlobalPullToRefresh } from "@/components/layout/GlobalPullToRefresh";

/** Логотип в центре полосы — файл `client/public/F-PING.png` (замените PNG при необходимости) */
const PULSE_NAV_LOGO_SRC = "/F-PING.png?v=6";

/** Порядок вкладок для свайпа: Чаты → Лента → Борд */
const SWIPEABLE_PATHS = ["/", "/posts", "/board"] as const;
const SWIPE_ANIMATION_MS = 320;
const DESKTOP_CHAT_PANEL_WIDTH_KEY = "desktop:chat-panel-width";
const DESKTOP_CHAT_PANEL_MIN = 320;
const DESKTOP_CHAT_PANEL_MAX = 520;
const DESKTOP_CHAT_PANEL_DEFAULT = 380;
const DESKTOP_LAYOUT_MIN_PX = 1024;

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
  const { realtimeLinkState } = useRealtimeContext();
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
  const [viewportWidth, setViewportWidth] = useState<number>(() =>
    typeof window !== "undefined" ? window.innerWidth : DESKTOP_LAYOUT_MIN_PX
  );
  const [desktopChatPanelWidth, setDesktopChatPanelWidth] = useState<number>(DESKTOP_CHAT_PANEL_DEFAULT);
  const desktopResizeStateRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const mainScrollRef = useRef<HTMLElement | null>(null);
  const swipeableIndexRef = useRef(0);
  const basePathRef = useRef("");
  const isSwipeableRef = useRef(false);
  const reducedMotionRef = useRef(false);
  const setLocationRef = useRef(setLocation);
  /** Последний успешный свайп между Чаты/Лента/Борд — для cooldown (см. MAIN_TAB_PAGER_SWIPE). */
  const lastMainTabSwipeCommitAtRef = useRef(0);

  const basePath = location.split("?")[0];
  const contentKey = basePath;
  /** В экране чата нижняя полоса скрыта (полноэкранный чат) */
  const isChatPage = /^\/chat\//.test(basePath);
  /** Вертикальная лента только видео — без нижней навигации, скролл внутри экрана */
  const isReelsPage = basePath === "/reels" || basePath.startsWith("/reels/");
  const isDesktopLayout = !preferPhoneChrome && viewportWidth >= DESKTOP_LAYOUT_MIN_PX;
  const isRootChatsPage = basePath === "/";
  const isFeedPage = basePath.startsWith("/posts");
  const hideBottomNav = (isChatPage || isReelsPage) && !isDesktopLayout;
  const desktopMainChildren = isDesktopLayout && isRootChatsPage
    ? (
      <DesktopMainPlaceholder
        onOpenFeed={() => setLocation("/posts")}
        onOpenBoard={() => setLocation("/board")}
      />
    )
    : children;
  const shouldConstrainDesktopMain =
    isDesktopLayout && !isRootChatsPage && !isChatPage && !isReelsPage && !isFeedPage;
  /** Лента и Reels: колонка ~760px + справа «Быстрые действия»; dev-превью — без панели */
  const isDevAppPreviewPath = basePath.startsWith("/dev/");
  const useDesktopQuickAsideShell = isDesktopLayout && !isDevAppPreviewPath;

  const swipeableIndex = SWIPEABLE_PATHS.indexOf(basePath as (typeof SWIPEABLE_PATHS)[number]);
  const isSwipeable = swipeableIndex >= 0;

  swipeableIndexRef.current = swipeableIndex;
  basePathRef.current = basePath;
  isSwipeableRef.current = isSwipeable;
  reducedMotionRef.current = reducedMotion;
  setLocationRef.current = setLocation;

  // Свайп между Чаты / Лента / Борд: отдельные (жёсткие) пороги + cooldown — одна вкладка за жест; лента→чаты только здесь (не дублировать хуком на Posts).
  useEffect(() => {
    if (!isSwipeable || reducedMotion || isDesktopLayout) return;
    const el = mainScrollRef.current;
    if (!el) return;

    const tabSwipeExclude = (target: EventTarget | null): boolean => {
      if (!(target instanceof Element)) return true;
      if (target.closest("[data-app-tab-swipe-exclude]")) return true;
      if (target.closest("input, textarea, select, [contenteditable='true']")) return true;
      return false;
    };

    let tracking = false;
    let edge: "left" | "right" | null = null;
    let startX = 0;
    let startY = 0;
    let startTime = 0;
    let lastX = 0;
    let lastT = 0;
    let pointerId: number | null = null;

    const reset = () => {
      tracking = false;
      edge = null;
      pointerId = null;
    };

    const onPointerDown = (e: PointerEvent) => {
      if (!isSwipeableRef.current || reducedMotionRef.current) return;
      if (e.pointerType === "mouse" || e.button !== 0) return;
      if (tabSwipeExclude(e.target)) return;
      if (e.clientY < EDGE_SWIPE.topExcludePx) return;
      if (performance.now() - lastMainTabSwipeCommitAtRef.current < MAIN_TAB_PAGER_SWIPE.postNavigateCooldownMs) {
        return;
      }

      const w = window.innerWidth || document.documentElement.clientWidth || 0;
      if (w <= 0) return;
      const zone = mainTabPagerEdgeZonePx();
      let ed: "left" | "right" | null = null;
      if (e.clientX <= zone) ed = "left";
      else if (e.clientX >= w - zone) ed = "right";
      else return;

      // С ленты правый край — переход в рилсы (хук на странице Posts), не на борд.
      if (ed === "right" && basePathRef.current.startsWith("/posts")) return;

      tracking = true;
      edge = ed;
      pointerId = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      const now = performance.now();
      startTime = now;
      lastX = startX;
      lastT = now;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!tracking || e.pointerId !== pointerId) return;
      if (edgeNavSwipeShouldCancelAsVerticalScroll(startX, startY, e.clientX, e.clientY)) {
        reset();
        return;
      }
      lastX = e.clientX;
      lastT = performance.now();
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!tracking || e.pointerId !== pointerId) return;
      const endX = e.clientX;
      const endT = performance.now();
      const ed = edge;
      const t0 = startTime;
      reset();

      const idx = swipeableIndexRef.current;
      if (idx < 0 || idx >= SWIPEABLE_PATHS.length) return;
      const now = performance.now();
      if (now - lastMainTabSwipeCommitAtRef.current < MAIN_TAB_PAGER_SWIPE.postNavigateCooldownMs) return;

      if (ed === "left") {
        if (!mainTabPagerShouldCommitSwipeRight(startX, endX, lastX, lastT, endT, t0)) return;
        if (idx <= 0) return;
        lastMainTabSwipeCommitAtRef.current = now;
        triggerSelectionHaptic();
        setTransitionDirection("left");
        setLocationRef.current(SWIPEABLE_PATHS[idx - 1]);
        return;
      }
      if (ed === "right") {
        if (!mainTabPagerShouldCommitSwipeLeft(startX, endX, lastX, lastT, endT, t0)) return;
        if (idx >= SWIPEABLE_PATHS.length - 1) return;
        lastMainTabSwipeCommitAtRef.current = now;
        triggerSelectionHaptic();
        setTransitionDirection("right");
        setLocationRef.current(SWIPEABLE_PATHS[idx + 1]);
      }
    };

    const onPointerCancel = (e: PointerEvent) => {
      if (e.pointerId === pointerId) reset();
    };

    el.addEventListener("pointerdown", onPointerDown, { capture: true });
    el.addEventListener("pointermove", onPointerMove, { capture: true });
    el.addEventListener("pointerup", onPointerUp, { capture: true });
    el.addEventListener("pointercancel", onPointerCancel, { capture: true });

    return () => {
      el.removeEventListener("pointerdown", onPointerDown, { capture: true });
      el.removeEventListener("pointermove", onPointerMove, { capture: true });
      el.removeEventListener("pointerup", onPointerUp, { capture: true });
      el.removeEventListener("pointercancel", onPointerCancel, { capture: true });
      reset();
    };
  }, [isSwipeable, reducedMotion, isDesktopLayout]);

  // Сброс направления после анимации перехода (чтобы следующий переход по тапу был с дефолтной анимацией)
  useEffect(() => {
    if (transitionDirection === null) return;
    const t = setTimeout(() => setTransitionDirection(null), SWIPE_ANIMATION_MS);
    return () => clearTimeout(t);
  }, [basePath, transitionDirection]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const updateWidth = () => {
      setViewportWidth(window.innerWidth || document.documentElement?.clientWidth || DESKTOP_LAYOUT_MIN_PX);
    };
    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(DESKTOP_CHAT_PANEL_WIDTH_KEY);
      if (!raw) return;
      const parsed = Number(raw);
      if (!Number.isFinite(parsed)) return;
      setDesktopChatPanelWidth(
        Math.min(DESKTOP_CHAT_PANEL_MAX, Math.max(DESKTOP_CHAT_PANEL_MIN, Math.round(parsed)))
      );
    } catch {
      // ignore storage read errors
    }
  }, []);

  const onDesktopResizeStart = useCallback((clientX: number) => {
    desktopResizeStateRef.current = {
      startX: clientX,
      startWidth: desktopChatPanelWidth,
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [desktopChatPanelWidth]);

  const resetDesktopChatPanelWidth = useCallback(() => {
    setDesktopChatPanelWidth(DESKTOP_CHAT_PANEL_DEFAULT);
    try {
      window.localStorage.setItem(DESKTOP_CHAT_PANEL_WIDTH_KEY, String(DESKTOP_CHAT_PANEL_DEFAULT));
    } catch {
      // ignore storage write errors
    }
  }, []);

  const adjustDesktopChatPanelWidth = useCallback((delta: number) => {
    setDesktopChatPanelWidth((prev) => {
      const next = Math.min(DESKTOP_CHAT_PANEL_MAX, Math.max(DESKTOP_CHAT_PANEL_MIN, prev + delta));
      try {
        window.localStorage.setItem(DESKTOP_CHAT_PANEL_WIDTH_KEY, String(next));
      } catch {
        // ignore storage write errors
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      const state = desktopResizeStateRef.current;
      if (!state) return;
      const delta = state.startX - event.clientX;
      const next = Math.min(
        DESKTOP_CHAT_PANEL_MAX,
        Math.max(DESKTOP_CHAT_PANEL_MIN, Math.round(state.startWidth + delta))
      );
      setDesktopChatPanelWidth(next);
    };
    const onUp = () => {
      if (!desktopResizeStateRef.current) return;
      desktopResizeStateRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      try {
        window.localStorage.setItem(DESKTOP_CHAT_PANEL_WIDTH_KEY, String(desktopChatPanelWidth));
      } catch {
        // ignore storage write errors
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [desktopChatPanelWidth]);

  // Список чатов по WS: один debounce на пачку событий (иначе каждое сообщение = полный GET /chats ×2 → лаги на iOS).
  useEffect(() => {
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const handler = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        debounce = null;
        void queryClient.invalidateQueries({ queryKey: ["chats"] });
      }, 320);
    };
    const unsub = onChatListUpdate(handler);
    return () => {
      if (debounce) clearTimeout(debounce);
      unsub();
    };
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
          ? basePath.startsWith("/posts") || basePath === "/reels" || basePath.startsWith("/reels/")
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
        haptic={false}
        subtle
        onClick={() => {
          triggerSelectionHaptic();
          setLocation(item.path);
        }}
        className="relative flex min-h-[var(--uix-touch-min)] flex-1 flex-col items-center justify-center gap-0.5 pb-1 pt-0 transition-colors duration-75"
        data-testid={`mobile-nav-${item.id}`}
        data-pingok-flight-target={item.id === "chats" ? "chats" : item.id === "board" ? "board" : undefined}
        aria-label={item.label}
        aria-current={isActive ? "page" : undefined}
      >
        <span
          className={cn(
            "pointer-events-none absolute bottom-1 left-1/2 h-[3px] w-7 -translate-x-1/2 rounded-full bg-primary ease-out",
            isActive ? "opacity-100 scale-x-100" : "opacity-0 scale-x-50"
          )}
          style={{
            transitionProperty: "opacity, transform",
            transitionDuration: `${DURATION_FAST_MS}ms`,
          }}
          aria-hidden
        />
        <div
          className={cn(
            "relative flex flex-col items-center gap-1 ease-out",
            isActive && !reducedMotion && "-translate-y-0.5"
          )}
          style={{
            transitionProperty: "transform",
            transitionDuration: reducedMotion ? "0ms" : `${DURATION_FAST_MS}ms`,
          }}
        >
          <div className="relative flex h-8 w-8 items-center justify-center">
            <div
              className={cn(
                "absolute inset-0 scale-0 rounded-full bg-primary/10 transition-transform ease-out",
                isActive && "scale-100"
              )}
              style={{ transitionDuration: `${DURATION_FAST_MS}ms` }}
            />
            {item.customIcon ? (
              <img
                src={item.customIcon}
                alt=""
                aria-hidden
                className={cn(
                  "relative z-10 h-5 w-5 object-contain transition-[opacity,filter] ease-out",
                  !isActive && "opacity-60 grayscale"
                )}
                style={{ transitionDuration: `${DURATION_FAST_MS}ms` }}
              />
            ) : (
              Icon && (
                <Icon
                  className={cn(
                    "relative z-10 h-5 w-5 transition-colors ease-out",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}
                  style={{ transitionDuration: `${DURATION_FAST_MS}ms` }}
                />
              )
            )}
          </div>
          <span
            className={cn(
              "text-[9px] font-medium transition-colors ease-out",
              isActive ? "text-primary" : "text-muted-foreground"
            )}
            style={{ transitionDuration: `${DURATION_FAST_MS}ms` }}
          >
            {item.label}
          </span>
        </div>
      </TapScaleButton>
    );
  };

  return (
    <div
      className={cn(
        "flex h-full min-h-[100dvh] w-full min-w-0 bg-background overflow-x-visible overflow-y-hidden",
        "pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)]",
        preferPhoneChrome ? "items-center justify-center" : "items-stretch justify-stretch",
      )}
    >
      <div
        className={cn(
          "relative flex h-full min-h-0 min-w-0 w-full shrink-0 flex-col overflow-x-visible overflow-y-hidden bg-background",
          preferPhoneChrome ? "mx-auto max-w-[480px] shadow-2xl" : "max-w-none shadow-none",
        )}
      >
        {/* Контент: единственная скроллируемая область; при смене маршрута — плавное появление; свайп влево/вправо между Чаты↔Лента↔Борд */}
        <div className={cn("flex min-h-0 flex-1", isDesktopLayout && "flex-row")}>
          {isDesktopLayout ? (
            <>
              <aside
                className="flex h-full shrink-0 border-r border-border/60 bg-card/15"
                style={{ width: `${desktopChatPanelWidth}px` }}
              >
                <Chats embedded />
              </aside>
              <div
                role="separator"
                aria-orientation="vertical"
                aria-label="Изменить ширину панели чатов"
                aria-valuemin={DESKTOP_CHAT_PANEL_MIN}
                aria-valuemax={DESKTOP_CHAT_PANEL_MAX}
                aria-valuenow={desktopChatPanelWidth}
                tabIndex={0}
                className="relative hidden w-1.5 shrink-0 cursor-col-resize bg-transparent transition-colors hover:bg-border/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 md:block"
                onMouseDown={(e) => onDesktopResizeStart(e.clientX)}
                onDoubleClick={resetDesktopChatPanelWidth}
                onKeyDown={(e) => {
                  if (e.key === "ArrowLeft") {
                    e.preventDefault();
                    adjustDesktopChatPanelWidth(16);
                  } else if (e.key === "ArrowRight") {
                    e.preventDefault();
                    adjustDesktopChatPanelWidth(-16);
                  } else if (e.key === "Home") {
                    e.preventDefault();
                    adjustDesktopChatPanelWidth(10_000);
                  } else if (e.key === "End") {
                    e.preventDefault();
                    adjustDesktopChatPanelWidth(-10_000);
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    resetDesktopChatPanelWidth();
                  }
                }}
                title="Перетащите, чтобы изменить ширину. Двойной клик - сброс."
              >
                <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border/60" />
              </div>
            </>
          ) : null}
          <main
            ref={mainScrollRef}
            className={cn(
              "flex-1 min-h-0 min-w-0 relative flex flex-col overflow-x-visible w-full max-w-full bg-background",
              isReelsPage ? "pt-0" : "pt-[env(safe-area-inset-top,0px)]",
              isReelsPage ? "overflow-hidden pb-0" : "overflow-y-auto",
              hideBottomNav ? "pb-0" : "pb-[var(--uix-nav-bottom)]",
            )}
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {user && realtimeLinkState === "connecting" ? (
              <div
                role="status"
                aria-live="polite"
                aria-label="Подключение к серверу"
                className="sticky top-0 z-40 flex h-1 w-full shrink-0 items-center justify-center gap-1 border-b border-primary/15 bg-primary/10 px-3 py-0.5 text-[10px] font-medium text-primary"
              >
                <span
                  className={cn("inline-block size-1.5 rounded-full bg-primary", !reducedMotion && "animate-pulse")}
                  style={!reducedMotion ? { animationDuration: `${DURATION_NORMAL_MS}ms` } : undefined}
                />
                Подключение…
              </div>
            ) : null}
            <GlobalPullToRefresh mainRef={mainScrollRef} disabled={isReelsPage} />
            <div
              key={contentKey}
              className={cn(
                "flex min-h-full min-w-0 w-full flex-col",
                isReelsPage && "min-h-0 flex-1",
                !reducedMotion && "animate-in fade-in",
                !reducedMotion && transitionDirection === "right" && "slide-in-from-right",
                !reducedMotion && transitionDirection === "left" && "slide-in-from-left"
              )}
              style={
                !reducedMotion
                  ? {
                      animationDuration:
                        transitionDirection === "left" || transitionDirection === "right"
                          ? `${SWIPE_ANIMATION_MS}ms`
                          : `${DURATION_NORMAL_MS}ms`,
                    }
                  : undefined
              }
            >
              <PlatformAnnouncementBar />
              {useDesktopQuickAsideShell ? (
                <FeedDesktopColumnShell
                  quickActionsContext={
                    isReelsPage ? "reels" : isChatPage ? "chat" : "feed"
                  }
                  {...(isFeedPage ? { "data-pull-refresh-scope": true } : {})}
                >
                  {shouldConstrainDesktopMain ? (
                    <DesktopMainSurface>{desktopMainChildren}</DesktopMainSurface>
                  ) : (
                    desktopMainChildren
                  )}
                </FeedDesktopColumnShell>
              ) : shouldConstrainDesktopMain ? (
                <DesktopMainSurface>{desktopMainChildren}</DesktopMainSurface>
              ) : (
                desktopMainChildren
              )}
            </div>
          </main>
        </div>

        {/* Нижнее меню PULSE: 5 пунктов, в чате скрыто */}
        <nav
          className={cn(
            "fixed bottom-0 z-50 overflow-visible border-t border-border/50 bg-background/95 backdrop-blur-md pb-[env(safe-area-inset-bottom,0px)] [padding-left:env(safe-area-inset-left,0px)] [padding-right:env(safe-area-inset-right,0px)]",
            preferPhoneChrome
              ? "left-1/2 w-[min(100vw,480px)] max-w-full -translate-x-1/2"
              : "left-0 right-0",
            hideBottomNav && "hidden"
          )}
        >
          <div
            className={cn(
              "mx-auto grid min-h-[var(--uix-nav-height)] w-full min-w-0 grid-cols-[1fr_minmax(6rem,7.5rem)_1fr] items-end gap-x-0.5 px-1.5 py-1 sm:px-3",
              preferPhoneChrome ? "max-w-[480px]" : "max-w-none",
            )}
          >
            <div className="flex min-w-0 items-end justify-start gap-0.5">
              {navItemsLeft.map(renderNavButton)}
            </div>
            {/* h-0 + absolute: не раздуваем высоту строки под hit-box; без сдвига вверх — слот по центру полосы, как у соседних иконок */}
            <div className="pointer-events-none relative z-10 h-0 min-h-0 w-full min-w-0 shrink-0 self-end overflow-visible">
              <div className="pointer-events-auto absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-0">
                <NavPulseCenterLogoButton
                  logoSrc={PULSE_NAV_LOGO_SRC}
                  onShortPress={() => setLocation("/u/me")}
                />
              </div>
            </div>
            <div className="flex min-w-0 items-end justify-end gap-0.5">
              {navItemsRight.map(renderNavButton)}
            </div>
          </div>
        </nav>
      </div>
    </div>
  );
}