import { useCallback, useEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { onIncomingChatMessageHint } from "@/features/chat/realtime-events";
import {
  dismissPingokScheduledCall,
  fetchPingokScheduledCall,
  type PingokScheduledCallActive,
} from "@/lib/pingok-scheduled-call";
import { useToast } from "@/hooks/use-toast";

/** Пингок шлёт chat-list-update при создании dm_scheduled_call — без мгновенного refetch баннер ждёт до POLL_MS. */
const POLL_MS = 12_000;
const PRE_EVENT_MS = 5 * 60_000;

function sessionPreToastKey(callId: string): string {
  return `pingok:sched-pre:${callId}`;
}

type Props = { chatId: string };

/**
 * Баннер «запланирован звонок» в личке (Пингок): виден обоим до времени звонка + 5 минут, можно скрыть.
 */
export function PingokDmScheduledCallBanner({ chatId }: Props) {
  const { toast } = useToast();
  const [active, setActive] = useState<PingokScheduledCallActive | null>(null);
  const [busy, setBusy] = useState(false);
  const activeRef = useRef<PingokScheduledCallActive | null>(null);
  activeRef.current = active;

  const load = useCallback(async () => {
    try {
      const row = await fetchPingokScheduledCall(chatId);
      setActive(row);
    } catch {
      /* тихо */
    }
  }, [chatId]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  useEffect(() => {
    return onIncomingChatMessageHint((detail) => {
      if (detail.chatId !== chatId) return;
      void load();
    });
  }, [chatId, load]);

  useEffect(() => {
    if (!active) return;
    const tick = () => {
      const fire = new Date(active.fireAt).getTime();
      if (!Number.isFinite(fire)) return;
      const now = Date.now();
      if (now < fire - PRE_EVENT_MS || now >= fire) return;
      try {
        const k = sessionPreToastKey(active.id);
        if (sessionStorage.getItem(k)) return;
        sessionStorage.setItem(k, "1");
        toast({
          title: "Запланированный звонок",
          description: `${active.title} · ${new Date(active.fireAt).toLocaleString("ru-RU", {
            dateStyle: "short",
            timeStyle: "short",
          })}`,
          duration: 12_000,
        });
      } catch {
        /* sessionStorage */
      }
    };
    tick();
    const id = window.setInterval(tick, 45_000);
    return () => window.clearInterval(id);
  }, [active, toast]);

  const onDismiss = async (forBoth: boolean) => {
    const row = activeRef.current;
    if (!row || busy) return;
    setBusy(true);
    try {
      const ok = await dismissPingokScheduledCall(chatId, row.id, forBoth);
      if (!ok) {
        toast({ title: "Не удалось скрыть", variant: "destructive" });
        return;
      }
      setActive(null);
    } finally {
      setBusy(false);
    }
  };

  if (!active) return null;

  const when = new Date(active.fireAt);
  const whenLabel = Number.isFinite(when.getTime())
    ? when.toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" })
    : "";

  return (
    <div
      className="mx-2 mb-2 flex flex-col gap-2 rounded-xl border border-cyan-500/35 bg-cyan-500/10 px-3 py-2.5 text-[13px] text-cyan-950 dark:text-cyan-50"
      role="status"
    >
      <div className="flex items-start gap-2">
        <Clock className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600 dark:text-cyan-300" aria-hidden />
        <div className="min-w-0 flex-1 leading-snug">
          <div className="font-semibold text-cyan-900 dark:text-cyan-100">Запланирован звонок</div>
          <div className="text-cyan-800/90 dark:text-cyan-100/85">
            {whenLabel ? `${active.title} · ${whenLabel}` : active.title}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <TapScaleButton
          type="button"
          haptic
          subtle
          disabled={busy}
          className="min-h-[var(--uix-touch-min)] rounded-lg border border-cyan-600/30 bg-cyan-500/15 px-3 py-1.5 text-[12px] font-medium text-cyan-900 dark:text-cyan-100"
          onClick={() => void onDismiss(false)}
        >
          Скрыть у меня
        </TapScaleButton>
        <TapScaleButton
          type="button"
          haptic
          subtle
          disabled={busy}
          className="min-h-[var(--uix-touch-min)] rounded-lg border border-white/20 bg-black/5 px-3 py-1.5 text-[12px] font-medium dark:bg-white/10"
          onClick={() => void onDismiss(true)}
        >
          Скрыть у обоих
        </TapScaleButton>
      </div>
    </div>
  );
}
