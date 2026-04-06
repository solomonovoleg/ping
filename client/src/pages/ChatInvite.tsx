import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { API, apiFetch } from "@/lib/api-base";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, MessageCircle, ArrowRight, Loader2 } from "lucide-react";
import { stashPendingAuthReturn } from "@/lib/auth-return-path";

type InviteInfo = {
  chat: {
    id: string;
    name: string | null;
    avatarUrl: string | null;
    type: string;
    memberCount: number;
  };
  isAuthenticated: boolean;
  alreadyMember: boolean;
};

type JoinResult = {
  ok: boolean;
  chatId: string;
  alreadyMember: boolean;
  isNewUser: boolean;
  token?: string;
  user?: { id: string; publicId: number; displayName: string | null };
};

/** Сохраняет `?joinCall=1` с инвайта → в чате автоподключение к активному групповому созвону. */
function buildInviteRedirectChatPath(chatId: string): string {
  const base = `/chat/${encodeURIComponent(chatId)}`;
  if (typeof window === "undefined") return base;
  const raw = new URLSearchParams(window.location.search).get("joinCall");
  if (raw === "1" || raw === "true") return `${base}?joinCall=1`;
  return base;
}

export default function ChatInvite() {
  const params = useParams<{ code: string }>();
  const code = params.code ?? "";
  const [, setLocation] = useLocation();

  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [guestName, setGuestName] = useState("");
  const [joining, setJoining] = useState(false);
  const autoJoinStartedRef = useRef(false);

  useEffect(() => {
    if (!code) {
      setError("Ссылка-приглашение недействительна");
      setLoading(false);
      return;
    }

    apiFetch(`${API}/chat-invite/${encodeURIComponent(code)}`, { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error((data as { message?: string }).message || "Приглашение не найдено");
        }
        const data: InviteInfo = await res.json();
        setInfo(data);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Не удалось загрузить приглашение");
      })
      .finally(() => setLoading(false));
  }, [code]);

  /** Уже участник — сразу в экран чата (после входа с той же ссылки). */
  useLayoutEffect(() => {
    if (loading || !info || !code || !info.isAuthenticated || !info.alreadyMember) return;
    setLocation(buildInviteRedirectChatPath(info.chat.id), { replace: true });
  }, [loading, info, code, setLocation]);

  /** Вошли под аккаунтом, ещё не в группе — автоматически join и редирект в чат. */
  useEffect(() => {
    if (loading || !info || !code) return;
    if (!info.isAuthenticated || info.alreadyMember) return;

    if (autoJoinStartedRef.current) return;
    autoJoinStartedRef.current = true;
    setJoining(true);

    void (async () => {
      try {
        const res = await apiFetch(`${API}/chat-invite/${encodeURIComponent(code)}/join`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error((data as { message?: string }).message || "Не удалось присоединиться");
        }
        const result: JoinResult = await res.json();
        if (result.token) {
          try {
            localStorage.setItem("auth_token", result.token);
          } catch {
            /* ignore */
          }
        }
        setLocation(buildInviteRedirectChatPath(result.chatId), { replace: true });
      } catch (e) {
        autoJoinStartedRef.current = false;
        setError(e instanceof Error ? e.message : "Ошибка");
        setJoining(false);
      }
    })();
  }, [loading, info, code, setLocation]);

  const handleJoin = async () => {
    setJoining(true);
    try {
      const res = await apiFetch(`${API}/chat-invite/${encodeURIComponent(code)}/join`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: guestName.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { message?: string }).message || "Не удалось присоединиться");
      }

      const result: JoinResult = await res.json();

      if (result.token) {
        try {
          localStorage.setItem("auth_token", result.token);
        } catch {}
      }

      setLocation(buildInviteRedirectChatPath(result.chatId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background p-4">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Загрузка…</p>
        </div>
      </div>
    );
  }

  if (error && !info) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm rounded-2xl border bg-card p-6 text-center shadow-lg">
          <MessageCircle className="mx-auto h-12 w-12 text-muted-foreground" />
          <h1 className="mt-4 text-lg font-semibold">Приглашение недействительно</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          <Button
            variant="outline"
            className="mt-6"
            onClick={() => setLocation("/")}
          >
            На главную
          </Button>
        </div>
      </div>
    );
  }

  if (!info) return null;

  if (info.isAuthenticated && (info.alreadyMember || joining)) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background p-4">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Переходим в чат…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-6 text-center shadow-lg">
        {info.chat.avatarUrl ? (
          <img
            src={info.chat.avatarUrl}
            alt={info.chat.name || "Чат"}
            className="mx-auto h-20 w-20 rounded-full object-cover ring-4 ring-primary/20"
          />
        ) : (
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Users className="h-10 w-10" />
          </div>
        )}

        <h1 className="mt-4 text-lg font-semibold">{info.chat.name || "Групповой чат"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {info.chat.memberCount}{" "}
          {info.chat.memberCount === 1
            ? "участник"
            : info.chat.memberCount < 5
              ? "участника"
              : "участников"}
        </p>

        {!info.isAuthenticated && (
          <div className="mt-5 space-y-2 text-left">
            <label htmlFor="guest-name" className="text-sm font-medium text-foreground">
              Ваше имя
            </label>
            <Input
              id="guest-name"
              placeholder="Как вас зовут?"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Для вас будет создан аккаунт автоматически
            </p>
          </div>
        )}

        {error && (
          <p className="mt-3 text-sm text-destructive">{error}</p>
        )}

        <Button
          className="mt-5 w-full gap-2"
          onClick={handleJoin}
          disabled={joining}
        >
          {joining ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Присоединение…
            </>
          ) : (
            <>
              Присоединиться к чату
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>

        {!info.isAuthenticated && (
          <p className="mt-4 text-xs text-muted-foreground">
            Уже есть аккаунт?{" "}
            <button
              type="button"
              onClick={() => {
                const back =
                  typeof window !== "undefined"
                    ? `${window.location.pathname}${window.location.search}`
                    : `/invite/${code}`;
                stashPendingAuthReturn(back);
                setLocation("/");
              }}
              className="text-primary hover:underline"
            >
              Войдите
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
