import { lazy, Suspense, useEffect, useState, type ComponentType, type ReactNode } from "react";
import { useNativeRootWideLayoutAttribute } from "@/hooks/use-native-root-wide-layout";
import { ensureChatOutboxOnlineFlush, flushChatOutbox } from "@/lib/chat-outbox";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { stashPendingAuthReturnFromWindow } from "@/lib/auth-return-path";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { OfflineBanner } from "@/components/OfflineBanner";
import { AddToHomeScreenHint } from "@/components/AddToHomeScreenHint";

import AppLayout from "@/components/layout/AppLayout";
import { PageRouteFallback } from "@/components/PageRouteFallback";
import { CallProvider } from "@/contexts/CallContext";
import { GroupCallProvider } from "@/contexts/GroupCallContext";
import { RealtimeProvider } from "@/contexts/RealtimeContext";
import Login from "@/pages/Login";
import Onboarding from "@/pages/Onboarding";
import Privacy from "@/pages/Privacy";
import Terms from "@/pages/Terms";
import Chats from "@/pages/Chats";
import Posts from "@/pages/Posts";
import NotFound from "@/pages/not-found";

const CHUNK_CACHE_MISMATCH_RE =
  /(Loading chunk|ChunkLoadError|Failed to fetch dynamically imported module|Importing a module script failed|not a valid JavaScript MIME type)/i;
const TRANSIENT_IMPORT_RE = /(Failed to fetch|NetworkError|Load failed|timeout)/i;
const IMPORT_RETRY_ATTEMPTS = 2;
const IMPORT_RETRY_DELAY_MS = 450;
const BUILD_RELOAD_ONCE_KEY = "build-reload-once:v1";

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function hardReloadWithCacheBuster(reason: string): never {
  if (typeof window === "undefined") {
    throw new Error(reason);
  }
  const next = new URL(window.location.href);
  next.searchParams.set("__reload", String(Date.now()));
  window.location.replace(next.toString());
  // Keep suspense unresolved while browser navigates.
  throw new Promise<never>(() => {});
}

/**
 * Защита от битых lazy-чанков после деплоя:
 * если импорт упал из-за mismatch старого HTML/кэша и новых хешей,
 * пробуем один авто-reload страницы, затем отдаём исходную ошибку.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function lazyWithRetry<T extends { default: ComponentType<any> }>(
  importer: () => Promise<T>,
  chunkKey: string
) {
  return lazy(async () => {
    const retryKey = `lazy-retry:${chunkKey}`;
    for (let attempt = 0; attempt <= IMPORT_RETRY_ATTEMPTS; attempt += 1) {
      try {
        const mod = await importer();
        if (typeof window !== "undefined") {
          try {
            window.sessionStorage.removeItem(retryKey);
          } catch {}
        }
        return mod;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error ?? "");
        const canSoftRetry = TRANSIENT_IMPORT_RE.test(message) && attempt < IMPORT_RETRY_ATTEMPTS;
        if (canSoftRetry) {
          await wait(IMPORT_RETRY_DELAY_MS * (attempt + 1));
          continue;
        }

        const shouldHardReload = CHUNK_CACHE_MISMATCH_RE.test(message);
        if (typeof window !== "undefined" && shouldHardReload) {
          let alreadyRetried = false;
          try {
            alreadyRetried = window.sessionStorage.getItem(retryKey) === "1";
          } catch {}
          if (!alreadyRetried) {
            try {
              window.sessionStorage.setItem(retryKey, "1");
            } catch {}
            hardReloadWithCacheBuster(message || "chunk_mismatch");
          }
        }
        throw error;
      }
    }
    throw new Error("Не удалось загрузить страницу");
  });
}

// Тяжёлые страницы — подгружаются по мере перехода (уменьшает начальный бандл)
const ChatDetail = lazyWithRetry(() => import("@/pages/ChatDetail"), "chat-detail");
const UserProfile = lazyWithRetry(() => import("@/pages/UserProfile"), "user-profile");
const PostDetail = lazyWithRetry(() => import("@/pages/PostDetail"), "post-detail");
const EditProfile = lazyWithRetry(() => import("@/pages/EditProfile"), "edit-profile");
const CreatePost = lazyWithRetry(() => import("@/pages/CreatePost"), "create-post");
const Board = lazyWithRetry(() => import("@/pages/Board"), "board");
const BoardCallHistory = lazyWithRetry(() => import("@/pages/BoardCallHistory"), "board-calls");
const BoardCallHistoryDetail = lazyWithRetry(() => import("@/pages/BoardCallHistoryDetail"), "board-calls-detail");
const BoardTracksList = lazyWithRetry(() => import("@/features/board/tracks/TracksListPage").then((m) => ({ default: m.TracksListPage })), "board-tracks");
const BoardTracksDetail = lazyWithRetry(() => import("@/pages/BoardTracksDetail"), "board-tracks-detail");
const BoardEdgeHub = lazyWithRetry(() => import("@/pages/BoardEdgeHub"), "board-edge-hub");
const BoardEdgeManage = lazyWithRetry(() => import("@/pages/BoardEdgeManage"), "board-edge-manage");
const BoardEdgePrizeDraw = lazyWithRetry(() => import("@/pages/BoardEdgePrizeDraw"), "board-edge-prize-draw");
const BoardEdgeNew = lazyWithRetry(() => import("@/pages/BoardEdgeNew"), "board-edge-new");
const BoardEdgeMoneyNew = lazyWithRetry(() => import("@/pages/BoardEdgeMoneyNew"), "board-edge-money-new");
const BoardSender = lazyWithRetry(() => import("@/pages/BoardSender"), "board-sender");
const BoardBusiness = lazyWithRetry(() => import("@/pages/BoardBusiness"), "board-business");
const BoardApiHub = lazyWithRetry(() => import("@/pages/BoardApiHub"), "board-api-hub");
const Settings = lazyWithRetry(() => import("@/pages/Settings"), "settings");
const SettingsInvites = lazyWithRetry(() => import("@/pages/SettingsInvites"), "settings-invites");
const SettingsNotifications = lazyWithRetry(() => import("@/pages/SettingsNotifications"), "settings-notifications");
const SettingsChatPrefs = lazyWithRetry(() => import("@/pages/SettingsChatPrefs"), "settings-chat");
const SettingsMedia = lazyWithRetry(() => import("@/pages/SettingsMedia"), "settings-media");
const SettingsPrivacy = lazyWithRetry(() => import("@/pages/SettingsPrivacy"), "settings-privacy");
const SettingsMore = lazyWithRetry(() => import("@/pages/SettingsMore"), "settings-more");
const SettingsData = lazyWithRetry(() => import("@/pages/SettingsData"), "settings-data");
const SettingsStickers = lazyWithRetry(() => import("@/pages/SettingsStickers"), "settings-stickers");
const HelpArticle = lazyWithRetry(() => import("@/pages/HelpArticle"), "help-article");
const SavedMessages = lazyWithRetry(() => import("@/pages/SavedMessages"), "saved-messages");
const EdgeCompanion = lazyWithRetry(() => import("@/pages/EdgeCompanion"), "edge-companion");
const Subscribers = lazyWithRetry(() => import("@/pages/Subscribers"), "subscribers");
const FollowersList = lazyWithRetry(() => import("@/pages/FollowersList"), "followers-list");
const Notifications = lazyWithRetry(() => import("@/pages/Notifications"), "notifications");
const AdminApp = lazyWithRetry(() => import("@/admin/AdminApp").then((m) => ({ default: m.AdminApp })), "admin-app");
const PulseTemplatePreview = lazyWithRetry(() => import("@/pages/PulseTemplatePreview"), "pulse-template");
const PulseProfileDevPreview = lazyWithRetry(() => import("@/pages/PulseProfileDevPreview"), "pulse-profile-dev");
const ReelsFeed = lazyWithRetry(() => import("@/pages/ReelsFeed"), "reels-feed");
const ChatInvite = lazyWithRetry(() => import("@/pages/ChatInvite"), "chat-invite");

const PageFallback = PageRouteFallback;

function LegacyProfileRedirect({ params }: { params?: { id?: string } }) {
  const [, setLocation] = useLocation();

  useEffect(() => {
    const rawId = params?.id?.trim() ?? "";
    if (!rawId) {
      setLocation("/posts");
      return;
    }
    const normalizedId = encodeURIComponent(rawId.replace(/^@+/, ""));
    const search = typeof window !== "undefined" ? window.location.search : "";
    setLocation(`/profile/${normalizedId}${search}`);
  }, [params?.id, setLocation]);

  return null;
}

function LegacyProfilePathRedirect({
  params,
}: {
  params?: { id?: string; postId?: string };
}) {
  const [, setLocation] = useLocation();

  useEffect(() => {
    const rawId = params?.id?.trim() ?? "";
    if (!rawId) {
      setLocation("/posts");
      return;
    }
    const id = encodeURIComponent(rawId.replace(/^@+/, ""));
    const postId = params?.postId?.trim();
    const pathname = typeof window !== "undefined" ? window.location.pathname : "";
    const search = typeof window !== "undefined" ? window.location.search : "";
    if (postId) {
      setLocation(`/u/${id}/p/${encodeURIComponent(postId)}${search}`, { replace: true } as { replace?: boolean });
      return;
    }
    if (pathname.endsWith("/followers")) {
      setLocation(`/u/${id}/followers${search}`, { replace: true } as { replace?: boolean });
      return;
    }
    if (pathname.endsWith("/following")) {
      setLocation(`/u/${id}/following${search}`, { replace: true } as { replace?: boolean });
      return;
    }
    setLocation(`/u/${id}${search}`, { replace: true } as { replace?: boolean });
  }, [params?.id, params?.postId, setLocation]);

  return null;
}

function BusinessOnlyEdgeRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      setLocation("/");
      return;
    }
    if (user.businessStatus !== "approved") {
      setLocation("/board");
    }
  }, [isLoading, user, setLocation]);

  if (isLoading || !user || user.businessStatus !== "approved") {
    return <PageFallback />;
  }
  return <>{children}</>;
}

function Router() {
  return (
    <AppLayout>
      <Suspense fallback={<PageFallback />}>
        <Switch>
          <Route path="/">{() => <Chats />}</Route>
          {import.meta.env.DEV ? (
            <>
              <Route path="/dev/pulse-template/desktop-light" component={PulseTemplatePreview} />
              <Route path="/dev/pulse-template/desktop" component={PulseTemplatePreview} />
              <Route path="/dev/pulse-template/stories-other" component={PulseTemplatePreview} />
              <Route path="/dev/pulse-template/stories" component={PulseTemplatePreview} />
              <Route path="/dev/pulse-template/profile" component={PulseProfileDevPreview} />
              <Route path="/dev/pulse-template" component={PulseTemplatePreview} />
            </>
          ) : null}
          <Route path="/chat/:id" component={ChatDetail} />
          <Route path="/posts" component={Posts} />
          <Route path="/reels/u/:id/p/:postId" component={ReelsFeed} />
          <Route path="/reels" component={ReelsFeed} />
          <Route path="/create-post" component={CreatePost} />
          <Route path="/profile/edit" component={EditProfile} />
          <Route path="/u/:id/p/:postId" component={PostDetail} />
          <Route path="/u/:id/followers" component={FollowersList} />
          <Route path="/u/:id/following" component={FollowersList} />
          <Route path="/u/:id" component={UserProfile} />
          <Route path="/profile/:id/post/:postId" component={LegacyProfilePathRedirect} />
          <Route path="/profile/:id/followers" component={LegacyProfilePathRedirect} />
          <Route path="/profile/:id/following" component={LegacyProfilePathRedirect} />
          <Route path="/profile/:id" component={LegacyProfilePathRedirect} />
          <Route path="/id/:id" component={LegacyProfileRedirect} />
          <Route path="/subscribers" component={Subscribers} />
          <Route path="/notifications" component={Notifications} />
          <Route path="/board/calls/:callId" component={BoardCallHistoryDetail} />
          <Route path="/board/calls" component={BoardCallHistory} />
          <Route path="/board/tracks/:trackId" component={BoardTracksDetail} />
          <Route path="/board/tracks" component={BoardTracksList} />
          <Route path="/board/edge/new-money">
            {() => (
              <BusinessOnlyEdgeRoute>
                <BoardEdgeMoneyNew />
              </BusinessOnlyEdgeRoute>
            )}
          </Route>
          <Route path="/board/edge/new">
            {() => (
              <BusinessOnlyEdgeRoute>
                <BoardEdgeNew />
              </BusinessOnlyEdgeRoute>
            )}
          </Route>
          <Route path="/board/edge/manage">
            {() => (
              <BusinessOnlyEdgeRoute>
                <BoardEdgeManage />
              </BusinessOnlyEdgeRoute>
            )}
          </Route>
          <Route path="/board/edge/draw">
            {() => (
              <BusinessOnlyEdgeRoute>
                <BoardEdgePrizeDraw />
              </BusinessOnlyEdgeRoute>
            )}
          </Route>
          <Route path="/board/edge">
            {() => (
              <BusinessOnlyEdgeRoute>
                <BoardEdgeHub />
              </BusinessOnlyEdgeRoute>
            )}
          </Route>
          <Route path="/board/sender" component={BoardSender} />
          <Route path="/board/business" component={BoardBusiness} />
          <Route path="/board/api-hub" component={BoardApiHub} />
          <Route path="/board" component={Board} />
          <Route path="/settings/invites" component={SettingsInvites} />
          <Route path="/settings/notifications" component={SettingsNotifications} />
          <Route path="/settings/chat" component={SettingsChatPrefs} />
          <Route path="/settings/media" component={SettingsMedia} />
          <Route path="/settings/privacy" component={SettingsPrivacy} />
          <Route path="/settings/more" component={SettingsMore} />
          <Route path="/settings/data" component={SettingsData} />
          <Route path="/settings/stickers" component={SettingsStickers} />
          <Route path="/help/:slug" component={HelpArticle} />
          <Route path="/settings" component={Settings} />
          <Route path="/saved" component={SavedMessages} />
          <Route path="/edge/companion" component={EdgeCompanion} />
          <Route path="/edge/:edgeId" component={EdgeCompanion} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </AppLayout>
  );
}

/** Общий контейнер для экранов входа — один и тот же layout, без скачков при переключении */
/** Экраны без AppLayout: один слой safe-area, без дубля с uix-content-x внутри основного приложения */
/** h-full + overflow-y-auto: html/body/#root с overflow:hidden — скролл только здесь (логин, онбординг, сброс пароля). */
const authShellClass =
  "h-full max-h-full min-h-0 w-full max-w-full min-w-0 overflow-x-hidden overflow-y-auto overscroll-y-contain bg-background uix-screen pt-safe pb-safe pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))]";

function AppBody() {
  const [location, setLocation] = useLocation();
  const { user, isLoading } = useAuth();
  const [bootTimeoutExceeded, setBootTimeoutExceeded] = useState(false);

  useEffect(() => {
    if (isLoading || !user) return;
    const profileIncomplete = !user.displayName?.trim() || !user.surname?.trim();
    if (profileIncomplete || location === "/onboarding") return;
    ensureChatOutboxOnlineFlush();
    void flushChatOutbox();
  }, [isLoading, user?.id, user?.displayName, user?.surname, location]);

  /** Глубокая ссылка (профиль и т.д.): запоминаем сразу после проверки сессии, до/вместе с экраном входа */
  useEffect(() => {
    if (isLoading || user) return;
    stashPendingAuthReturnFromWindow();
  }, [isLoading, user]);

  useEffect(() => {
    if (!isLoading) {
      setBootTimeoutExceeded(false);
      return;
    }
    const t = window.setTimeout(() => {
      setBootTimeoutExceeded(true);
    }, 9000);
    return () => window.clearTimeout(t);
  }, [isLoading]);

  if (isLoading) {
    if (bootTimeoutExceeded) {
      return (
        <div className={`${authShellClass} flex flex-col items-center justify-center gap-4 py-8 min-h-[100dvh]`}>
          <div className="w-full max-w-[22rem] rounded-2xl border border-border/70 bg-card/85 p-4 text-center shadow-sm">
            <p className="text-sm font-semibold text-foreground">Загрузка затянулась</p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              Возможно, обновился бандл или подвисла сеть. Попробуйте перезагрузить страницу.
            </p>
            <div className="mt-3 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="min-h-[var(--uix-touch-min)] rounded-xl bg-primary px-3 text-sm font-medium text-primary-foreground"
              >
                Обновить страницу
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = new URL(window.location.href);
                  next.searchParams.set("__reload", String(Date.now()));
                  window.location.replace(next.toString());
                }}
                className="min-h-[var(--uix-touch-min)] rounded-xl border border-border/70 bg-background px-3 text-sm font-medium text-foreground"
              >
                Обновить без кэша
              </button>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className={`${authShellClass} flex flex-col items-center justify-center gap-6 py-8 min-h-[100dvh]`}>
        <div className="relative">
          <img src="/logo.png" alt="PING" className="w-16 h-16 object-contain opacity-90" />
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" role="status" aria-label="Загрузка" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={authShellClass}>
        <Login />
      </div>
    );
  }

  // Онбординг только если не заполены имя или фамилия (пол можно указать позже в настройках)
  const profileIncomplete =
    !user.displayName?.trim() ||
    !user.surname?.trim();
  if (location === "/onboarding" || profileIncomplete) {
    return (
      <div className={authShellClass}>
        <Onboarding />
      </div>
    );
  }

  return (
    <RealtimeProvider>
      <CallProvider>
        <GroupCallProvider>
          <Router />
        </GroupCallProvider>
      </CallProvider>
    </RealtimeProvider>
  );
}

function App() {
  useNativeRootWideLayoutAttribute();
  useEffect(() => {
    let cancelled = false;
    const selfHealStaleBundle = async () => {
      const buildVersion = typeof __BUILD_VERSION__ === "string" ? __BUILD_VERSION__.trim() : "";
      if (!buildVersion) return;
      try {
        const resp = await fetch("/api/build-info", { cache: "no-store", credentials: "same-origin" });
        if (!resp.ok) return;
        const payload = (await resp.json()) as { version?: unknown };
        const serverVersion =
          payload && typeof payload.version === "string" ? payload.version.trim() : "";
        if (!serverVersion || cancelled || serverVersion === buildVersion) return;
        let reloaded = false;
        try {
          reloaded = window.sessionStorage.getItem(BUILD_RELOAD_ONCE_KEY) === serverVersion;
        } catch {}
        if (reloaded) return;
        try {
          window.sessionStorage.setItem(BUILD_RELOAD_ONCE_KEY, serverVersion);
        } catch {}
        hardReloadWithCacheBuster("build_version_mismatch");
      } catch {
        // Network hiccup: ignore, app continues with existing bundle.
      }
    };
    void selfHealStaleBundle();
    return () => {
      cancelled = true;
    };
  }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <OfflineBanner />
        <AddToHomeScreenHint />
        <Suspense fallback={<PageFallback />}>
          <Switch>
            <Route path="/privacy" component={Privacy} />
            <Route path="/terms" component={Terms} />
            <Route path="/invite/:code" component={ChatInvite} />
            {/* Все подпути /admin/… в одном месте (wouter иначе даёт 404). Экран выбирает AdminApp по location. */}
            <Route path="/admin/*" component={AdminApp} />
            <Route path="/admin" component={AdminApp} />
            <Route>
              <ErrorBoundary>
                <AuthProvider>
                  <AppBody />
                </AuthProvider>
              </ErrorBoundary>
            </Route>
          </Switch>
        </Suspense>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
