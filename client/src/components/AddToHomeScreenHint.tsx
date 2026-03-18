/**
 * Одноразовая подсказка «Добавить на экран Домой» — только на мобильных,
 * пока пользователь не закроет или не добавит (standalone). Не мешает, один раз.
 */
import { useState, useEffect } from "react";
import { Share2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "ping_add_to_home_dismissed";

function isMobile(): boolean {
  if (typeof window === "undefined") return false;
  return (
    /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints > 0 && window.matchMedia("(max-width: 768px)").matches)
  );
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches
  );
}

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function setDismissed(): void {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {}
}

export function AddToHomeScreenHint() {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!isMobile() || isStandalone() || wasDismissed()) return;
    // Небольшая задержка, чтобы не показывать поверх загрузки
    const t = setTimeout(() => setVisible(true), 1200);
    return () => clearTimeout(t);
  }, [mounted]);

  const handleDismiss = () => {
    setDismissed();
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className={cn(
        "fixed left-1/2 z-[90] w-[calc(100%-2rem)] max-w-[22rem] -translate-x-1/2",
        "bottom-[max(0.75rem,env(safe-area-inset-bottom))+0.5rem]",
        "flex flex-col gap-3 rounded-2xl border border-border/80 bg-background/95 px-4 py-3.5 shadow-lg backdrop-blur-sm",
        "animate-in slide-in-from-bottom-4 fade-in-0 duration-300"
      )}
      role="dialog"
      aria-label="Подсказка: добавьте PING на главный экран"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Share2 className="h-4 w-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-sm font-medium text-foreground">
            Добавьте PING на главный экран
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground leading-snug">
            Так удобнее открывать, и вход сохранится надолго. В Safari: «Поделиться» → «На экран Домой».
          </p>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors touch-manipulation min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)]"
          aria-label="Закрыть"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <Button
        type="button"
        variant="default"
        size="sm"
        className="w-full"
        onClick={handleDismiss}
      >
        Понятно
      </Button>
    </div>
  );
}
