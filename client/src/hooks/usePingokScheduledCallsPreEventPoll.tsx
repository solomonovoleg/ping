import { useEffect, useRef } from "react";
import { API, apiFetch } from "@/lib/api-base";
import { toast } from "@/hooks/use-toast";
import { playIncomingChatMessageSound } from "@/lib/send-sound";

const POLL_MS = 40_000;
/** С `PingokDmScheduledCallBanner`: один тост на id везде */
const SESSION_KEY_PREFIX = "pingok:sched-pre:";

type Row = { id: string; chatId: string; title: string; fireAt: string };

/**
 * Глобально (как у Алисы): за 5 минут до запланированного звонка — один тост на событие, даже вне чата.
 */
export function usePingokScheduledCallsPreEventPoll(enabled: boolean): void {
  const shownRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled) {
      shownRef.current.clear();
      return;
    }

    let cancelled = false;
    const isVisible = () => typeof document === "undefined" || document.visibilityState === "visible";

    const tick = async () => {
      if (!isVisible()) return;
      try {
        const res = await apiFetch(`${API}/pingok-micro/v1/scheduled-calls-pre-window`, {
          suppressSessionExpireOn401: true,
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { calls?: Row[] };
        const list = Array.isArray(data.calls) ? data.calls : [];
        for (const c of list) {
          if (shownRef.current.has(c.id)) continue;
          try {
            const k = SESSION_KEY_PREFIX + c.id;
            if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(k)) {
              shownRef.current.add(c.id);
              continue;
            }
          } catch {
            /* sessionStorage */
          }
          shownRef.current.add(c.id);
          try {
            sessionStorage.setItem(SESSION_KEY_PREFIX + c.id, "1");
          } catch {
            /* ignore */
          }
          playIncomingChatMessageSound();
          const when = new Date(c.fireAt);
          const whenLabel = Number.isFinite(when.getTime())
            ? when.toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" })
            : "";
          toast({
            title: "Запланированный звонок",
            description: `${c.title}${whenLabel ? ` · ${whenLabel}` : ""}`,
            duration: 14_000,
          });
        }
      } catch {
        /* фоновый опрос */
      }
    };

    const onVisibilityChange = () => {
      if (isVisible()) void tick();
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibilityChange);
    }
    void tick();
    const id = window.setInterval(() => void tick(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibilityChange);
      }
    };
  }, [enabled]);
}
