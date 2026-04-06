import type { EdgeMoneyColorScheme } from "@/lib/edge-money-public";

export type EmoneyColorPreset = {
  /** Основной акцентный цвет (hex). */
  accent: string;
  /** Мягкий вариант акцента для фонов. */
  accentSoft: string;
  /** Glow/shadow цвет. */
  glow: string;
  /** Начало градиента заголовка. */
  gradientFrom: string;
  /** Конец градиента заголовка. */
  gradientTo: string;
  /** Фон бейджа (ПРИЗЫ, рейтинг). */
  badgeBg: string;
  /** Текст бейджа. */
  badgeText: string;
  /** Текст и иконки на сплошном фоне accent (кнопки CTA). */
  onAccent: string;
  /** Цвет для превью-кружка в picker'е админки. */
  preview: string;
  /** Название для UI. */
  label: string;
};

export const EMONEY_COLOR_PRESETS: Record<EdgeMoneyColorScheme, EmoneyColorPreset> = {
  default: {
    accent: "#f8fafc",
    accentSoft: "rgba(248, 250, 252, 0.18)",
    glow: "rgba(236, 242, 255, 0.38)",
    gradientFrom: "#ffffff",
    gradientTo: "#dbeafe",
    badgeBg: "rgba(248, 250, 252, 0.14)",
    badgeText: "#f8fafc",
    onAccent: "#0c0c12",
    preview: "#f8fafc",
    label: "Белый",
  },
  gold: {
    accent: "#f59e0b",
    accentSoft: "rgba(245, 158, 11, 0.15)",
    glow: "rgba(245, 158, 11, 0.4)",
    gradientFrom: "#fbbf24",
    gradientTo: "#d97706",
    badgeBg: "rgba(245, 158, 11, 0.15)",
    badgeText: "#fbbf24",
    onAccent: "#ffffff",
    preview: "#f59e0b",
    label: "Золото",
  },
  emerald: {
    accent: "#10b981",
    accentSoft: "rgba(16, 185, 129, 0.15)",
    glow: "rgba(16, 185, 129, 0.35)",
    gradientFrom: "#34d399",
    gradientTo: "#059669",
    badgeBg: "rgba(16, 185, 129, 0.15)",
    badgeText: "#34d399",
    onAccent: "#ffffff",
    preview: "#10b981",
    label: "Изумруд",
  },
  rose: {
    accent: "#f43f5e",
    accentSoft: "rgba(244, 63, 94, 0.15)",
    glow: "rgba(244, 63, 94, 0.35)",
    gradientFrom: "#fb7185",
    gradientTo: "#e11d48",
    badgeBg: "rgba(244, 63, 94, 0.15)",
    badgeText: "#fb7185",
    onAccent: "#ffffff",
    preview: "#f43f5e",
    label: "Роза",
  },
  violet: {
    accent: "#8b5cf6",
    accentSoft: "rgba(139, 92, 246, 0.15)",
    glow: "rgba(139, 92, 246, 0.35)",
    gradientFrom: "#a78bfa",
    gradientTo: "#7c3aed",
    badgeBg: "rgba(139, 92, 246, 0.15)",
    badgeText: "#a78bfa",
    onAccent: "#ffffff",
    preview: "#8b5cf6",
    label: "Фиолет",
  },
  cyan: {
    accent: "#06b6d4",
    accentSoft: "rgba(6, 182, 212, 0.15)",
    glow: "rgba(6, 182, 212, 0.35)",
    gradientFrom: "#22d3ee",
    gradientTo: "#0891b2",
    badgeBg: "rgba(6, 182, 212, 0.15)",
    badgeText: "#22d3ee",
    onAccent: "#ffffff",
    preview: "#06b6d4",
    label: "Бирюза",
  },
};

export const EMONEY_SCHEME_KEYS: EdgeMoneyColorScheme[] = [
  "default", "gold", "emerald", "rose", "violet", "cyan",
];

export function emoneyPresetToStyle(scheme: EdgeMoneyColorScheme | undefined): React.CSSProperties {
  const p = EMONEY_COLOR_PRESETS[scheme || "default"] ?? EMONEY_COLOR_PRESETS.default;
  return {
    "--emoney-accent": p.accent,
    "--emoney-accent-soft": p.accentSoft,
    "--emoney-glow": p.glow,
    "--emoney-gradient-from": p.gradientFrom,
    "--emoney-gradient-to": p.gradientTo,
    "--emoney-badge-bg": p.badgeBg,
    "--emoney-badge-text": p.badgeText,
    "--emoney-on-accent": p.onAccent,
  } as React.CSSProperties;
}
