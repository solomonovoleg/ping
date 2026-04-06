import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import type { AuthUser } from "@/lib/auth";
import { fetchMe, hydrateNativeAuthMeCache } from "@/lib/auth";
import {
  API,
  apiFetch,
  getAuthToken,
  hydrateNativeAuthToken,
  setAuthToken,
  syncAuthTokenFromStorage,
  warnNativeAuth,
} from "@/lib/api-base";
import { Capacitor } from "@capacitor/core";
import { isNative, requestPushAndGetToken } from "@/lib/capacitor-native";
import {
  requestWebPushAndGetToken,
  subscribeWebPushForeground,
} from "@/lib/web-push-firebase";
import { getForegroundPushToastEnabled } from "@/lib/foreground-push-prefs";
import { toast } from "@/hooks/use-toast";

/** Минимальное время показа экрана «Загрузка...», чтобы не было мигания и ощущения нестабильности при входе */
const INITIAL_LOAD_MIN_MS = 400;

type AuthState = {
  user: AuthUser | null;
  isLoading: boolean;
  refetch: () => Promise<AuthUser | null>;
  /** Установить пользователя из ответа login/register (для нативного приложения, где cookie могут не успеть сохраниться) */
  setUserFromLogin: (user: AuthUser) => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const initialLoadDoneRef = useRef(false);
  /** Увеличивается при успешном login/register: отбрасываем устаревший /auth/me, запущенный ещё без Bearer (типично iOS/Capacitor). */
  const authFetchGenRef = useRef(0);
  /** Натив: не дёргать /auth/me на каждый visibilitychange подряд (переключение приложений). */
  const lastNativeResumeMeRefetchAtRef = useRef(0);

  const refetch = useCallback(async (): Promise<AuthUser | null> => {
    const refetchGenAtStart = authFetchGenRef.current;
    const isInitialLoad = !initialLoadDoneRef.current;
    const start = isInitialLoad ? Date.now() : 0;
    try {
      let u = await fetchMe();
      if (refetchGenAtStart !== authFetchGenRef.current) {
        return null;
      }
      syncAuthTokenFromStorage();
      setUser((prev) => {
        if (!u && prev) {
          // Android/WebView: /auth/me иногда приходит 200 {} до того, как Bearer подтянулся из Preferences или после гонки с login — не выкидывать из сессии, пока токен в памяти/хранилище есть.
          if (isNative() && getAuthToken()) {
            warnNativeAuth("refetch_me_empty_keep_session", {});
            return prev;
          }
          warnNativeAuth("refetch_me_empty_logout", {});
          setAuthToken(null);
          return null;
        }
        if (!u) return null;
        return u;
      });
      return u ?? null;
    } catch {
      if (refetchGenAtStart !== authFetchGenRef.current) {
        return null;
      }
      setUser((prev) => (prev ? prev : null));
      return null;
    } finally {
      if (isInitialLoad) {
        initialLoadDoneRef.current = true;
        const elapsed = Date.now() - start;
        const remaining = Math.max(0, INITIAL_LOAD_MIN_MS - elapsed);
        if (remaining > 0) {
          setTimeout(() => setIsLoading(false), remaining);
        } else {
          setIsLoading(false);
        }
      } else {
        setIsLoading(false);
      }
    }
  }, []);

  const setUserFromLogin = useCallback((u: AuthUser & { token?: string }) => {
    const tok = typeof (u as { token?: string })?.token === "string" ? (u as { token: string }).token.trim() : "";
    if (u?.id || tok) {
      authFetchGenRef.current += 1;
    }
    setUser(u);
    if (u && (u as { token?: string }).token) setAuthToken((u as { token: string }).token);
    else if (!u) setAuthToken(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await hydrateNativeAuthToken();
      } finally {
        if (!cancelled) void refetch();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refetch]);

  /** После сворачивания: подтянуть токен всегда; полный /me — не чаще раз в N мс (частые переключения приложений не должны забивать сеть и главный поток). */
  useEffect(() => {
    if (!isNative()) return;
    let t: ReturnType<typeof setTimeout> | null = null;
    const ME_REFETCH_MIN_INTERVAL_MS = 8000;
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      if (t) clearTimeout(t);
      t = setTimeout(() => {
        void (async () => {
          await hydrateNativeAuthToken();
          await hydrateNativeAuthMeCache();
          syncAuthTokenFromStorage();
          const now = Date.now();
          if (now - lastNativeResumeMeRefetchAtRef.current < ME_REFETCH_MIN_INTERVAL_MS) return;
          lastNativeResumeMeRefetchAtRef.current = now;
          await refetch();
        })();
      }, 350);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      if (t) clearTimeout(t);
    };
  }, [refetch]);

  useEffect(() => {
    const handler = () => setUser(null);
    window.addEventListener("auth:session-expired", handler);
    return () => window.removeEventListener("auth:session-expired", handler);
  }, []);

  /** Android/Web: пуш только после онбординга (имя + фамилия) — иначе ранний register() без FCM может ронять WebView. iOS: достаточно сессии (FCM через AppDelegate + plist). */
  const shouldDeferPushUntilProfileComplete = useCallback((u: NonNullable<typeof user>) => {
    if (!isNative()) {
      return !u.displayName?.trim() || !u.surname?.trim();
    }
    try {
      return Capacitor.getPlatform() === "android" && (!u.displayName?.trim() || !u.surname?.trim());
    } catch {
      return !u.displayName?.trim() || !u.surname?.trim();
    }
  }, []);

  const postPushToken = useCallback(async (token: string) => {
    await apiFetch(`${API}/users/me/push-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    if (shouldDeferPushUntilProfileComplete(user)) return;
    const showPushError = () =>
      toast({ title: "Не удалось включить уведомления", variant: "destructive" });
    const tokenPromise = isNative()
      ? requestPushAndGetToken()
      : requestWebPushAndGetToken();
    tokenPromise
      .then((token) => {
        if (!token) return;
        return postPushToken(token).catch(showPushError);
      })
      .catch(showPushError);
  }, [user?.id, user?.displayName, user?.surname, shouldDeferPushUntilProfileComplete, postPushToken]);

  /** Натив: после возврата в приложение обновить токен на сервере (ротация FCM, смена APNs). Не чаще раза в 2 мин. */
  const userRef = useRef(user);
  userRef.current = user;
  /** Чтобы не дублировать register сразу после входа при первом же visibility. */
  const lastNativePushResyncRef = useRef(Date.now());
  useEffect(() => {
    if (!isNative()) return;
    const PUSH_RESYNC_MIN_MS = 120_000;
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      const u = userRef.current;
      if (!u || shouldDeferPushUntilProfileComplete(u)) return;
      const now = Date.now();
      if (now - lastNativePushResyncRef.current < PUSH_RESYNC_MIN_MS) return;
      lastNativePushResyncRef.current = now;
      void requestPushAndGetToken()
        .then((token) => {
          if (!token) return;
          return postPushToken(token);
        })
        .catch(() => {});
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [shouldDeferPushUntilProfileComplete, postPushToken]);

  /** Веб: в фокусе вкладки системный push часто не показывается — дублируем тостом (можно выключить в Настройки → Уведомления). */
  useEffect(() => {
    if (!user || isNative()) return;
    return subscribeWebPushForeground((payload) => {
      if (userRef.current?.pushEnabled === false) return;
      if (!getForegroundPushToastEnabled()) return;
      const n = payload.notification;
      const title = n?.title;
      const body = n?.body;
      if (!title && !body) return;
      toast({
        title: title || "Уведомление",
        description: body || undefined,
      });
    });
  }, [user?.id]);

  /** Android: в foreground FCM не рисует шторку — дублируем тостом (та же настройка, что и на сайте). iOS: системный баннер уже есть. */
  useEffect(() => {
    if (!user || !isNative()) return;
    let removeListener: (() => Promise<void>) | undefined;
    let cancelled = false;
    void (async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (Capacitor.getPlatform() !== "android") return;
        const { PushNotifications } = await import("@capacitor/push-notifications");
        const handle = await PushNotifications.addListener("pushNotificationReceived", (n) => {
          if (userRef.current?.pushEnabled === false) return;
          if (!getForegroundPushToastEnabled()) return;
          const title = typeof n.title === "string" ? n.title.trim() : "";
          const body = typeof n.body === "string" ? n.body.trim() : "";
          if (!title && !body) return;
          toast({
            title: title || "Уведомление",
            description: body || undefined,
          });
        });
        if (cancelled) {
          void handle.remove();
          return;
        }
        removeListener = () => handle.remove();
      } catch {
        /* плагин недоступен */
      }
    })();
    return () => {
      cancelled = true;
      void removeListener?.();
    };
  }, [user?.id]);

  return (
    <AuthContext.Provider value={{ user, isLoading, refetch, setUserFromLogin }}>
      {children}
      <SessionExpiredListener />
    </AuthContext.Provider>
  );
}

function SessionExpiredListener() {
  useEffect(() => {
    const handler = () => {
      warnNativeAuth("toast_session_expired", {});
      toast({ title: "Сессия истекла. Войдите снова.", variant: "destructive" });
    };
    window.addEventListener("auth:session-expired", handler);
    return () => window.removeEventListener("auth:session-expired", handler);
  }, []);
  return null;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth used outside AuthProvider");
  return ctx;
}
