import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import type { AuthUser } from "@/lib/auth";
import { fetchMe } from "@/lib/auth";
import { API, apiFetch, setAuthToken } from "@/lib/api-base";
import { isNative, requestPushAndGetToken } from "@/lib/capacitor-native";
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

  const refetch = useCallback(async (): Promise<AuthUser | null> => {
    const isInitialLoad = !initialLoadDoneRef.current;
    const start = isInitialLoad ? Date.now() : 0;
    try {
      const u = await fetchMe();
      setUser((prev) => {
        if (!u && prev) {
          setAuthToken(null);
          // Не шлём auth:session-expired при refetch: 401/пустой ответ может быть из-за гонки после входа (куки ещё не подхвачены). Тост «Сессия истекла» показывается только при 401 из apiFetch (защищённый запрос).
          return null;
        }
        if (!u) return null;
        return u;
      });
      return u ?? null;
    } catch {
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
    setUser(u);
    if (u && (u as { token?: string }).token) setAuthToken((u as { token: string }).token);
    else if (!u) setAuthToken(null);
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    const handler = () => setUser(null);
    window.addEventListener("auth:session-expired", handler);
    return () => window.removeEventListener("auth:session-expired", handler);
  }, []);

  useEffect(() => {
    if (!user || !isNative()) return;
    const showPushError = () => toast({ title: "Не удалось включить уведомления", variant: "destructive" });
    requestPushAndGetToken()
      .then((token) => {
        if (!token) return;
        return apiFetch(`${API}/users/me/push-token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        }).catch(showPushError);
      })
      .catch(showPushError);
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
