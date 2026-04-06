import { useCallback, useEffect, useRef, useState } from "react";
import { API, apiFetch } from "@/lib/api-base";
import { triggerLightHaptic } from "@/lib/capacitor-native";
import { emitComposerPulsePendingResolved } from "@/features/chat/realtime-events";

/** Длительность пульса на кнопке микрофона (сердце), мс. */
export const COMPOSER_TRANSFER_PULSE_WINDOW_MS = 3400;
/** Плавное снятие сердца после окна (CSS halo / иконка). */
export const COMPOSER_TRANSFER_PULSE_EXIT_MS = Math.round(0.38 * 1000);

const OUTGOING_SEND_THROTTLE_MS = 2200;

/** 6 исходящих подряд с паузой между соседними < 3 с → локальный пульс + WS собеседнику. */
export const COMPOSER_PULSE_STREAK_MESSAGES = 6;
/** Строго меньше 3 с между соседними учитываемыми отправками. */
export const COMPOSER_PULSE_STREAK_MAX_GAP_MS = 3000;

type Options = {
  chatId: string;
  enabled: boolean;
  userId: string | undefined;
  /** Для WS composer-pulse */
  displayName: string | null | undefined;
  sendComposerPulse: (chatId: string, displayName?: string | null) => void;
  subscribeComposerPulse: (
    chatId: string,
    onPulse: (userId: string, displayName: string | null, at: number) => void,
  ) => () => void;
};

type BumpOpts = {
  /** Локальная активность печати — шлём WS с троттлингом. */
  isLocalTyping?: boolean;
};

/**
 * Пульс передачи в личке: ~3.4 с пик, затем плавное затухание.
 * Локальный пик — только после 6 успешных исходящих сообщений подряд с интервалом < 3 с между соседними;
 * первое сообщение после срабатывания в серию не входит. Печать уведомляет собеседника по WS (троттлинг), без локального пика.
 */
export function useComposerTransferPulse({
  chatId,
  enabled,
  userId,
  displayName,
  sendComposerPulse,
  subscribeComposerPulse,
}: Options): {
  pulseMicHeartActive: boolean;
  notifyComposerTypingActivity: () => void;
  /** Вызов после каждой успешно ушедшей исходящей реплики (текст/медиа/голос и т.д.). */
  recordOutgoingMessageForTransferPulse: () => void;
} {
  const [pulseMicHeartActive, setPulseMicHeartActive] = useState(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const micHeartClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSendRef = useRef(0);
  /** Пиковое окно: во время пика печать только шлёт WS (троттлинг), без второго локального пика. */
  const pulseWindowActiveRef = useRef(false);
  const streakOutgoingCountRef = useRef(0);
  const lastOutgoingMessageAtRef = useRef<number | null>(null);
  /** После срабатывания серии следующее исходящее не учитывается в счётчике. */
  const ignoreNextOutgoingForStreakRef = useRef(false);

  const clearReset = useCallback(() => {
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
  }, []);

  const clearMicHeartTimer = useCallback(() => {
    if (micHeartClearTimerRef.current) {
      clearTimeout(micHeartClearTimerRef.current);
      micHeartClearTimerRef.current = null;
    }
  }, []);

  const bumpPulse = useCallback(
    (opts?: BumpOpts) => {
      clearReset();
      clearMicHeartTimer();
      pulseWindowActiveRef.current = true;
      setPulseMicHeartActive(true);
      void triggerLightHaptic();

      resetTimerRef.current = setTimeout(() => {
        resetTimerRef.current = null;
        pulseWindowActiveRef.current = false;
        clearMicHeartTimer();
        micHeartClearTimerRef.current = setTimeout(() => {
          micHeartClearTimerRef.current = null;
          setPulseMicHeartActive(false);
        }, COMPOSER_TRANSFER_PULSE_EXIT_MS);
      }, COMPOSER_TRANSFER_PULSE_WINDOW_MS);

      if (opts?.isLocalTyping && chatId) {
        const now = Date.now();
        if (now - lastSendRef.current >= OUTGOING_SEND_THROTTLE_MS) {
          lastSendRef.current = now;
          sendComposerPulse(chatId, displayName ?? null);
        }
      }
    },
    [chatId, clearMicHeartTimer, clearReset, displayName, sendComposerPulse],
  );

  useEffect(() => {
    setPulseMicHeartActive(false);
    pulseWindowActiveRef.current = false;
    clearReset();
    clearMicHeartTimer();
    lastSendRef.current = 0;
    streakOutgoingCountRef.current = 0;
    lastOutgoingMessageAtRef.current = null;
    ignoreNextOutgoingForStreakRef.current = false;
  }, [chatId, clearMicHeartTimer, clearReset]);

  useEffect(() => {
    return () => {
      clearReset();
      clearMicHeartTimer();
    };
  }, [clearMicHeartTimer, clearReset]);

  useEffect(() => {
    if (!enabled || !chatId || !userId) return;
    return subscribeComposerPulse(chatId, (fromId) => {
      if (fromId === userId) return;
      bumpPulse();
    });
  }, [bumpPulse, chatId, enabled, subscribeComposerPulse, userId]);

  useEffect(() => {
    if (!enabled || !chatId || !userId) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiFetch(`${API}/me/composer-pulse/pending`);
        if (!res.ok || cancelled) return;
        const j = (await res.json()) as { pulses?: { chatId: string }[] };
        const hit = j.pulses?.some((p) => p.chatId === chatId);
        if (!hit || cancelled) return;
        bumpPulse();
        try {
          await apiFetch(`${API}/me/composer-pulse/${encodeURIComponent(chatId)}/consume`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{}",
          });
        } catch {
          /* ignore */
        }
        emitComposerPulsePendingResolved({ chatId });
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bumpPulse, chatId, enabled, userId]);

  const notifyComposerTypingActivity = useCallback(() => {
    if (!enabled || !chatId) return;
    const now = Date.now();
    if (now - lastSendRef.current < OUTGOING_SEND_THROTTLE_MS) return;
    lastSendRef.current = now;
    sendComposerPulse(chatId, displayName ?? null);
  }, [chatId, displayName, enabled, sendComposerPulse]);

  const recordOutgoingMessageForTransferPulse = useCallback(() => {
    if (!enabled || !chatId) return;
    if (ignoreNextOutgoingForStreakRef.current) {
      ignoreNextOutgoingForStreakRef.current = false;
      return;
    }
    const now = Date.now();
    const prev = lastOutgoingMessageAtRef.current;
    if (prev == null || now - prev < COMPOSER_PULSE_STREAK_MAX_GAP_MS) {
      streakOutgoingCountRef.current += 1;
    } else {
      streakOutgoingCountRef.current = 1;
    }
    lastOutgoingMessageAtRef.current = now;
    if (streakOutgoingCountRef.current >= COMPOSER_PULSE_STREAK_MESSAGES) {
      streakOutgoingCountRef.current = 0;
      lastOutgoingMessageAtRef.current = null;
      ignoreNextOutgoingForStreakRef.current = true;
      bumpPulse({ isLocalTyping: true });
    }
  }, [bumpPulse, chatId, enabled]);

  return {
    pulseMicHeartActive,
    notifyComposerTypingActivity,
    recordOutgoingMessageForTransferPulse,
  };
}
