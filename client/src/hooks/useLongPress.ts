/**
 * Хук для обработки длинного нажатия (long press).
 * SRP: только таймер и колбэки, без UI-логики.
 * Поддержка iOS, Android, веб: pointer + pointerCancel (важно для мобильных).
 */
import { useRef, useCallback, useEffect } from "react";

type UseLongPressOptions = {
  /** Длительность удержания в мс */
  durationMs: number;
  /** Вызывается при успешном long press */
  onLongPress: () => void;
};

/**
 * Возвращает обработчики для onPointerDown, onPointerUp, onPointerLeave, onPointerCancel.
 * При удержании durationMs мс вызывается onLongPress.
 * onPointerCancel — важно для iOS/Android (жест отменён системой, скролл, контекстное меню).
 */
export function useLongPress({ durationMs, onLongPress }: UseLongPressOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const start = useCallback(() => {
    if (timerRef.current) return;
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      onLongPress();
    }, durationMs);
  }, [durationMs, onLongPress]);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => cancel, [cancel]);

  return {
    onPointerDown: start,
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
  };
}
