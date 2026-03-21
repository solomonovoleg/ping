import { lazy, Suspense, useEffect, type ComponentType } from "react";
import { ensureChatOutboxOnlineFlush, flushChatOutbox } from "@/lib/chat-outbox";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { OfflineBanner } from "@/components/OfflineBanner";
import { AddToHomeScreenHint } from "@/components/AddToHomeScreenHint";

import AppLayout from "@/components/layout/AppLayout";
import { CallProvider } from "@/contexts/CallContext";
import { GroupCallProvider } from "@/contexts/GroupCallContext";
import { RealtimeProvider } from "@/contexts/RealtimeContext";
import Login from "@/pages/Login";
import Onboarding from "@/pages/Onboarding";
import Privacy from "@/pages/Privacy";
import Chats from "@/pages/Chats";
import Posts from "@/pages/Posts";
import NotFound from "@/pages/not-found";

const CHUNK_CACHE_MISMATCH_RE = /(Loading chunk|ChunkLoadError|Failed to fetch dynamically imported module|Importing a module script failed)/i;
const TRANSIENT_IMPORT_RE = /(Failed to fetch|NetworkError|Load failed|timeout)/i;
const IMPORT_RETRY_ATTEMPTS = 2;
const IMPORT_RETRY_DELAY_MS = 450;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
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
            window.location.reload();
            await new Promise<never>(() => {});
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
const Settings = lazyWithRetry(() => import("@/pages/Settings"), "settings");
const SavedMessages = lazyWithRetry(() => import("@/pages/SavedMessages"), "saved-messages");
const Subscribers = lazyWithRetry(() => import("@/pages/Subscribers"), "subscribers");
const FollowersList = lazyWithRetry(() => import("@/pages/FollowersList"), "followers-list");
const Notifications = lazyWithRetry(() => import("@/pages/Notifications"), "notifications");
const AdminApp = lazyWithRetry(() => import("@/admin/AdminApp").then((m) => ({ default: m.AdminApp })), "admin-app");
const PulseTemplatePreview = lazyWithRetry(() => import("@/pages/PulseTemplatePreview"), "pulse-template");
const PulseProfileDevPreview = lazyWithRetry(() => import("@/pages/PulseProfileDevPreview"), "pulse-profile-dev");

const PageFallback = () => (
  <div className="flex flex-1 items-center justify-center min-h-[200px]">
    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

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

function Router() {
  return (
    <AppLayout>
      <Suspense fallback={<PageFallback />}>
        <Switch>
          <Route path="/" component={Chats} />
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
          <Route path="/create-post" component={CreatePost} />
          <Route path="/profile/edit" component={EditProfile} />
          <Route path="/profile/:id/post/:postId" component={PostDetail} />
          <Route path="/profile/:id/followers" component={FollowersList} />
          <Route path="/profile/:id/following" component={FollowersList} />
          <Route path="/profile/:id" component={UserProfile} />
          <Route path="/id/:id" component={LegacyProfileRedirect} />
          <Route path="/subscribers" component={Subscribers} />
          <Route path="/notifications" component={Notifications} />
          <Route path="/board/calls/:callId" component={BoardCallHistoryDetail} />
          <Route path="/board/calls" component={BoardCallHistory} />
          <Route path="/board/tracks/:trackId" component={BoardTracksDetail} />
          <Route path="/board/tracks" component={BoardTracksList} />
          <Route path="/board" component={Board} />
          <Route path="/settings" component={Settings} />
          <Route path="/saved" component={SavedMessages} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </AppLayout>
  );
}

/** Общий контейнер для экранов входа — один и тот же layout, без скачков при переключении */
const authShellClass = "min-h-[100dvh] w-full max-w-full min-w-0 overflow-x-hidden bg-background uix-screen";

function AppBody() {
  const [location, setLocation] = useLocation();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading || !user) return;
    const profileIncomplete = !user.displayName?.trim() || !user.surname?.trim();
    if (profileIncomplete || location === "/onboarding") return;
    ensureChatOutboxOnlineFlush();
    void flushChatOutbox();
  }, [isLoading, user?.id, user?.displayName, user?.surname, location]);

  if (isLoading) {
    return (
      <div className={`${authShellClass} flex flex-col items-center justify-center gap-6 p-4`}>
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
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <OfflineBanner />
        <AddToHomeScreenHint />
        <Suspense fallback={<PageFallback />}>
          <Switch>
            <Route path="/privacy" component={Privacy} />
            <Route path="/admin/users" component={AdminApp} />
            <Route path="/admin/referrals" component={AdminApp} />
            <Route path="/admin/admins" component={AdminApp} />
            <Route path="/admin/settings" component={AdminApp} />
            <Route path="/admin/audit" component={AdminApp} />
            <Route path="/admin/ops" component={AdminApp} />
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
