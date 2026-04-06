import { useEffect, useRef } from "react";
import { API, apiFetch } from "@/lib/api-base";
import { getUserFacingApiErrorMessage, getUserFacingMessageFromResponse } from "@/lib/api-user-facing-error";
import { toast } from "@/hooks/use-toast";
import { ToastAction, type ToastActionElement } from "@/components/ui/toast";
import { playIncomingChatMessageSound } from "@/lib/send-sound";

type DueRow = { id: string; title: string; fireAt: string };

const POLL_MS = 25_000;

async function dismissReminder(id: string): Promise<void> {
  const res = await apiFetch(`${API}/reminders/${encodeURIComponent(id)}/dismiss`, {
    method: "POST",
    suppressSessionExpireOn401: true,
  });
  if (!res.ok) {
    const msg = await getUserFacingMessageFromResponse(res);
    throw new Error(msg);
  }
}

function formatFireAtLabel(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" });
}

/**
 * In-app напоминания ПИНГОК: опрос просроченных, тост + звук, кнопка «Ок» снимает с сервера.
 */
export function usePingokRemindersPoll(enabled: boolean): void {
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
        const res = await apiFetch(`${API}/reminders/due`, { suppressSessionExpireOn401: true });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { reminders?: DueRow[] };
        const list = Array.isArray(data.reminders) ? data.reminders : [];
        for (const r of list) {
          if (shownRef.current.has(r.id)) continue;
          shownRef.current.add(r.id);
          playIncomingChatMessageSound();
          const fireLabel = formatFireAtLabel(r.fireAt);
          const action = (
            <ToastAction
              altText="Снять напоминание"
              onClick={() => {
                void dismissReminder(r.id).catch((err) => {
                  toast({
                    title: "Не удалось снять напоминание",
                    description: getUserFacingApiErrorMessage(err),
                    variant: "destructive",
                  });
                });
              }}
            >
              Ок
            </ToastAction>
          ) as ToastActionElement;
          toast({
            title: "Напоминание",
            description: `${r.title}${fireLabel ? ` · ${fireLabel}` : ""}`,
            duration: 12000,
            onOpenChange: (open) => {
              if (!open) {
                void dismissReminder(r.id).catch((err) => {
                  toast({
                    title: "Не удалось снять напоминание",
                    description: getUserFacingApiErrorMessage(err),
                    variant: "destructive",
                  });
                });
              }
            },
            action,
          });
        }
      } catch {
        /* тихо: фоновый опрос */
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
