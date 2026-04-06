import { useMemo } from "react";

export function useEmoneyCountdown(endsAtIso: string | null | undefined): {
  days: number;
  hours: number;
  minutes: number;
  done: boolean;
} {
  return useMemo(() => {
    if (!endsAtIso?.trim()) return { days: 0, hours: 0, minutes: 0, done: false };
    const t = new Date(endsAtIso).getTime();
    if (!Number.isFinite(t)) return { days: 0, hours: 0, minutes: 0, done: false };
    const diff = t - Date.now();
    if (diff <= 0) return { days: 0, hours: 0, minutes: 0, done: true };
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return { days, hours, minutes, done: false };
  }, [endsAtIso]);
}
