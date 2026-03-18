import { lazy, Suspense } from "react";
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
import Login from "@/pages/Login";
import Onboarding from "@/pages/Onboarding";
import Privacy from "@/pages/Privacy";
import Chats from "@/pages/Chats";
import Posts from "@/pages/Posts";
import NotFound from "@/pages/not-found";

// Тяжёлые страницы — подгружаются по мере перехода (уменьшает начальный бандл)
const ChatDetail = lazy(() => import("@/pages/ChatDetail"));
const UserProfile = lazy(() => import("@/pages/UserProfile"));
const PostDetail = lazy(() => import("@/pages/PostDetail"));
const EditProfile = lazy(() => import("@/pages/EditProfile"));
const CreatePost = lazy(() => import("@/pages/CreatePost"));
const Board = lazy(() => import("@/pages/Board"));
const Settings = lazy(() => import("@/pages/Settings"));
const SavedMessages = lazy(() => import("@/pages/SavedMessages"));
const Subscribers = lazy(() => import("@/pages/Subscribers"));
const Notifications = lazy(() => import("@/pages/Notifications"));
const AdminApp = lazy(() => import("@/admin/AdminApp").then((m) => ({ default: m.AdminApp })));

const PageFallback = () => (
  <div className="flex flex-1 items-center justify-center min-h-[200px]">
    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

function Router() {
  return (
    <AppLayout>
      <Suspense fallback={<PageFallback />}>
        <Switch>
          <Route path="/" component={Chats} />
          <Route path="/chat/:id" component={ChatDetail} />
          <Route path="/posts" component={Posts} />
          <Route path="/create-post" component={CreatePost} />
          <Route path="/profile/edit" component={EditProfile} />
          <Route path="/profile/:id/post/:postId" component={PostDetail} />
          <Route path="/profile/:id" component={UserProfile} />
          <Route path="/id/:id" component={UserProfile} />
          <Route path="/subscribers" component={Subscribers} />
          <Route path="/notifications" component={Notifications} />
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
    <CallProvider>
      <Router />
    </CallProvider>
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
            <Route path="/admin/admins" component={AdminApp} />
            <Route path="/admin/audit" component={AdminApp} />
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
