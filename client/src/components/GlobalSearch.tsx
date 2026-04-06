import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, X, MessageCircle, UserPlus, AlertCircle, UserCircle, BriefcaseBusiness } from "lucide-react";
import { searchUsers, startDm, formatUserDisplayName, formatSearchUserSubtitle, type SearchUser } from "@/lib/search";
import { buildChatPath } from "@/lib/chat-route";
import { followUser } from "@/lib/users";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/UserAvatar";
import { BusinessBadge } from "@/components/ui/business-badge";

const DEBOUNCE_MS = 300;
const SEARCH_STALE_MS = 30_000;

type GlobalSearchProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  onClear?: () => void;
  businessOnly?: boolean;
  onBusinessOnlyChange?: (value: boolean) => void;
  showBusinessToggle?: boolean;
};

export function GlobalSearch({
  value: query,
  onChange: setQuery,
  placeholder = "Имя, @ник, ID или полный номер…",
  className,
  onClear,
  businessOnly,
  onBusinessOnlyChange,
  showBusinessToggle = true,
}: GlobalSearchProps) {
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [internalBusinessOnly, setInternalBusinessOnly] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isBusinessOnly = businessOnly ?? internalBusinessOnly;
  const setBusinessOnly = onBusinessOnlyChange ?? setInternalBusinessOnly;

  useEffect(() => {
    if (!query.trim()) {
      setDebouncedQuery("");
      return;
    }
    const t = setTimeout(() => setDebouncedQuery(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  const {
    data: results = [],
    isFetching,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["search", "users", debouncedQuery, isBusinessOnly],
    queryFn: ({ signal }) => searchUsers(debouncedQuery, signal, { businessOnly: isBusinessOnly }),
    enabled: debouncedQuery.length > 0,
    staleTime: SEARCH_STALE_MS,
  });

  useEffect(() => {
    if (!query.trim()) {
      setOpen(false);
      return;
    }
    if (debouncedQuery) setOpen(true);
  }, [query, debouncedQuery]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const loading = Boolean(debouncedQuery) && isFetching;

  const handleStartChat = async (user: SearchUser) => {
    try {
      const chat = await startDm(user.id);
      setOpen(false);
      setQuery("");
      onClear?.();
      setLocation(buildChatPath(chat, chat.id));
    } catch (e) {
      toast({
        title: e instanceof Error ? e.message : "Не удалось начать диалог",
        variant: "destructive",
      });
    }
  };

  const handleFollow = async (user: SearchUser) => {
    try {
      await followUser(user.id);
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      toast({ title: "Вы подписались" });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Ошибка", variant: "destructive" });
    }
  };

  const handleOpenProfile = (user: SearchUser) => {
    setOpen(false);
    setQuery("");
    onClear?.();
    setLocation(`/profile/${user.publicId}`);
  };

  return (
    <div ref={containerRef} className={cn("relative flex-1", className)}>
      <div className="relative group">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary"
          aria-hidden
        />
        <input
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.trim() && setOpen(true)}
          aria-label="Поиск пользователей"
          className="w-full bg-secondary/50 border-none rounded-xl py-2.5 pl-10 pr-10 text-[15px] focus:ring-2 focus:ring-primary/30 transition-all placeholder:text-muted-foreground/70 outline-none"
        />
        {(query || loading) && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setOpen(false);
              onClear?.();
            }}
            aria-label="Очистить"
            className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-muted-foreground/20 flex items-center justify-center text-muted-foreground hover:bg-muted-foreground/30 transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {showBusinessToggle ? (
      <div className="mt-1 flex items-center">
        <button
          type="button"
          className={cn(
            "inline-flex min-h-[var(--uix-touch-min)] items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors",
            isBusinessOnly
              ? "border-amber-400/50 bg-amber-500/15 text-amber-700 dark:text-amber-300"
              : "border-border text-muted-foreground hover:bg-muted/60",
          )}
          onClick={() => setBusinessOnly(!isBusinessOnly)}
          aria-label="Только бизнес-профили"
        >
          <BriefcaseBusiness className="h-3.5 w-3.5" aria-hidden />
          Бизнес-профили
        </button>
      </div>
      ) : null}

      {open && query.trim() && (
        <div className="absolute top-full left-0 right-0 mt-1 z-[100] rounded-xl border border-border bg-popover text-popover-foreground shadow-xl ring-1 ring-black/5 dark:ring-white/10 overflow-hidden max-h-[min(60vh,320px)] overflow-y-auto">
          {loading ? (
            <div className="p-6 flex items-center justify-center min-h-[100px]">
              <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" role="status" aria-label="Поиск" />
            </div>
          ) : isError ? (
            <div className="p-4 flex flex-col items-center gap-3">
              <div className="flex items-center gap-2 text-destructive text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>Ошибка поиска. Проверьте интернет.</span>
              </div>
              <button
                type="button"
                onClick={() => void refetch()}
                className="min-h-[var(--uix-touch-min)] px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.98] transition-transform duration-100"
              >
                Повторить
              </button>
            </div>
          ) : results.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">Никого не найдено</div>
          ) : (
            <ul className="py-1">
              {results.map((user) => (
                <li key={user.id} className="flex items-center gap-1 px-2 py-1 sm:gap-2 sm:px-3 sm:py-2">
                  <button
                    type="button"
                    onClick={() => handleOpenProfile(user)}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-lg py-1.5 pl-1 pr-2 text-left transition-colors hover:bg-muted/80 active:bg-muted/60"
                    aria-label={`Профиль: ${formatUserDisplayName(user)}`}
                  >
                    <UserAvatar
                      avatarUrl={user.avatarUrl}
                      displayName={formatUserDisplayName(user)}
                      seed={user.id}
                      size={40}
                      className="h-10 w-10 shrink-0"
                      pointerEventsNone
                    />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 truncate text-[15px] font-medium">
                        <span className="truncate">{formatUserDisplayName(user)}</span>
                        {user.businessStatus === "approved" ? <BusinessBadge compact className="shrink-0" /> : null}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatSearchUserSubtitle(user)}</p>
                    </div>
                  </button>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => handleOpenProfile(user)}
                      className="flex min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                      title="Профиль"
                      aria-label={`Открыть профиль ${formatUserDisplayName(user)}`}
                    >
                      <UserCircle className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStartChat(user)}
                      className="flex min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] items-center justify-center rounded-full text-primary transition-colors hover:bg-primary/10"
                      title="Написать"
                      aria-label={`Написать ${formatUserDisplayName(user)}`}
                    >
                      <MessageCircle className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFollow(user)}
                      className="flex min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                      title="Подписаться"
                      aria-label={`Подписаться на ${formatUserDisplayName(user)}`}
                    >
                      <UserPlus className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
