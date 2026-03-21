import type { CSSProperties } from "react";

/**
 * Значения из PULSE-UI-SPEC / VideoCall.tsx — одна точка правды, без обёрток-компонентов.
 */
export const PULSE_CALL_BACKDROP_CLASS = "bg-[#080810]";

/** Нижняя панель звонка: плотный чёрный, лёгкая прозрачность (без «стекла»). */
export const pulseGhostPillStyle: CSSProperties = {
  background: "rgba(0,0,0,0.86)",
  border: "1px solid rgba(255,255,255,0.14)",
  boxShadow: "0 10px 40px rgba(0,0,0,0.75), inset 0 1px 0 rgba(255,255,255,0.06)",
};

/** Та же плотность на телефоне. */
export const pulseGhostPillStyleMobile: CSSProperties = {
  background: "rgba(0,0,0,0.88)",
  border: "1px solid rgba(255,255,255,0.16)",
  boxShadow: "0 12px 40px rgba(0,0,0,0.72), inset 0 1px 0 rgba(255,255,255,0.07)",
};

export const pulseToolbarDividerStyle: CSSProperties = {
  background: "rgba(255,255,255,0.12)",
};

/** Mic / camera OFF (PULSE §4.3) */
export const pulseMediaOffGlowStyle: CSSProperties = {
  boxShadow: "0 0 18px rgba(239,68,68,0.38), inset 0 0 10px rgba(239,68,68,0.07)",
};

/** End call orb (PULSE §4.4) */
export const pulseEndOrbFillStyle: CSSProperties = {
  background: "radial-gradient(circle at 42% 32%, rgba(255,85,85,0.95) 0%, rgba(195,18,18,0.92) 100%)",
};

export const pulseEndOrbHighlightStyle: CSSProperties = {
  background: "linear-gradient(to bottom, rgba(255,255,255,0.18) 0%, transparent 100%)",
};

export const pulseEndOrbOuterGlowStyle: CSSProperties = {
  boxShadow: "0 0 30px rgba(220,38,38,0.65), 0 0 8px rgba(220,38,38,0.45), inset 0 1px 0 rgba(255,180,180,0.25)",
};

/** Ручка над панелью — тот же чёрный корпус, что у пилюли. */
export const pulseDrawerHandleIdleStyle: CSSProperties = {
  background: "rgba(0,0,0,0.82)",
  border: "1px solid rgba(255,255,255,0.14)",
};

/** Подсветка как у «чата» в макете при активном состоянии */
export const pulseChatActiveGlowStyle: CSSProperties = {
  boxShadow: "0 0 16px rgba(99,102,241,0.28)",
};

/** Титры в основной панели — как VideoCallCaptions.tsx (янтарь) */
export const pulseCaptionsActiveGlowStyle: CSSProperties = {
  boxShadow: "0 0 16px rgba(245,158,11,0.28)",
};
