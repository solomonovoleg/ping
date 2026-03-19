import { useState, useEffect } from "react";

/**
 * Единая система движения (motion system).
 * Все анимации в приложении используют эти константы — так интерфейс ощущается цельным.
 */

/** Быстрые микро-взаимодействия (кнопки, переключатели) */
export const DURATION_FAST_MS = 150;

/** Стандартная длительность (появление/исчезновение блоков, тосты) */
export const DURATION_NORMAL_MS = 280;

/** То же в секундах для Framer Motion (transition.duration) */
export const DURATION_FAST_S = DURATION_FAST_MS / 1000;
export const DURATION_NORMAL_S = DURATION_NORMAL_MS / 1000;
export const DURATION_TOAST_AUTO_DISMISS_MS = 2200;

/** Акцентные анимации (рассыпание, «магические» эффекты) */
export const DURATION_EMPHASIS_MS = 420;

/** Кривая: лёгкое ускорение в конце (уверенное, не резкое) */
export const EASING_OUT = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";

/** То же для Framer Motion (transition.ease) */
export const EASING_OUT_BEZIER = [0.25, 0.46, 0.45, 0.94] as const;

/** Мягкий spring для тапа — живой отклик, не резкий (Framer Motion transition). */
export const SPRING_TAP = { type: "spring" as const, stiffness: 380, damping: 28 };

/** Кривая для «вылета» осколков (чуть более агрессивный конец) */
export const EASING_OUT_EXPO = "cubic-bezier(0.16, 1, 0.3, 1)";

/** Задержка между осколками (stagger), мс */
export const SHARD_STAGGER_MS = 12;

/**
 * Использование в компонентах:
 *   import { DURATION_NORMAL_MS, EASING_OUT } from "@/lib/motion";
 *   style={{ transition: `opacity ${DURATION_NORMAL_MS}ms ${EASING_OUT}` }}
 * Для рассыпания и «магических» эффектов — DURATION_EMPHASIS_MS + EASING_OUT_EXPO.
 * Всегда учитывайте getPrefersReducedMotion() для сложных анимаций.
 */

/**
 * Проверка: пользователь попросил уменьшить анимации (доступность).
 * В таком случае используем короткий fade вместо сложных эффектов.
 */
export function getPrefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Хук для реактивной проверки (если пользователь меняет настройку в системе).
 */
export function usePrefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  const [reduced, setReduced] = useState(getPrefersReducedMotion);
  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = () => setReduced(mql.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);
  return reduced;
}

// Для разовой проверки без хука: getPrefersReducedMotion()
