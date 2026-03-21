import { createContext, useContext, useMemo, type ReactNode } from "react";

export type PulseProfileThemeMode = "dark" | "light";

const BASE = {
  dark: {
    bg: "#080810",
    surface: "rgba(255,255,255,0.05)",
    border: "rgba(255,255,255,0.08)",
    borderStrong: "rgba(255,255,255,0.14)",
    text: "rgba(255,255,255,0.92)",
    /** В тёмном PULSE-профиле вторичный текст тот же цвет, что и основной — иерархия только через font-weight (как в Instagram). */
    textSub: "rgba(255,255,255,0.92)",
    textFaint: "rgba(255,255,255,0.92)",
    navBg: "rgba(6,6,14,0.97)",
    navBorder: "rgba(255,255,255,0.07)",
    gapRing: "#080810",
    chipBg: "rgba(255,255,255,0.06)",
    chipBorder: "rgba(255,255,255,0.09)",
    statsBg: "rgba(255,255,255,0.03)",
    statsBorder: "rgba(255,255,255,0.06)",
    sideLabel: "rgba(255,255,255,0.92)",
    postBg: "rgba(255,255,255,0.03)",
    postBorder: "rgba(255,255,255,0.07)",
    inputBg: "rgba(255,255,255,0.04)",
  },
  light: {
    bg: "#eef1fb",
    surface: "rgba(255,255,255,0.82)",
    border: "rgba(99,102,241,0.11)",
    borderStrong: "rgba(99,102,241,0.2)",
    text: "rgba(12,12,40,0.92)",
    textSub: "rgba(12,12,40,0.92)",
    textFaint: "rgba(12,12,40,0.92)",
    navBg: "rgba(238,241,251,0.97)",
    navBorder: "rgba(99,102,241,0.1)",
    gapRing: "#eef1fb",
    chipBg: "rgba(255,255,255,0.9)",
    chipBorder: "rgba(99,102,241,0.1)",
    statsBg: "rgba(255,255,255,0.6)",
    statsBorder: "rgba(99,102,241,0.08)",
    sideLabel: "rgba(12,12,40,0.92)",
    postBg: "rgba(255,255,255,0.7)",
    postBorder: "rgba(99,102,241,0.08)",
    inputBg: "rgba(255,255,255,0.55)",
  },
} as const;

const PALETTES = [
  { id: "violet", dark: "#818cf8", light: "#6366f1" },
  { id: "aqua", dark: "#22d3ee", light: "#06b6d4" },
  { id: "rose", dark: "#fb7185", light: "#f43f5e" },
  { id: "amber", dark: "#fbbf24", light: "#d97706" },
  { id: "lime", dark: "#a3e635", light: "#65a30d" },
  { id: "ocean", dark: "#38bdf8", light: "#0ea5e9" },
] as const;

export type PulsePaletteId = (typeof PALETTES)[number]["id"];

export function buildPulseProfileTheme(theme: PulseProfileThemeMode, paletteId: PulsePaletteId = "violet") {
  const base = BASE[theme];
  const pal = PALETTES.find((p) => p.id === paletteId) ?? PALETTES[0];
  const accent = theme === "dark" ? pal.dark : pal.light;
  const hex2 = (a: number) => Math.round(a * 255).toString(16).padStart(2, "0");
  return {
    ...base,
    accent,
    accentDim: accent + hex2(0.12),
    accentBorder: accent + hex2(0.28),
    tabActive: accent + hex2(0.14),
    tabBorder: accent + hex2(0.32),
  };
}

export type PulseProfileTh = ReturnType<typeof buildPulseProfileTheme>;

type Ctx = { th: PulseProfileTh; theme: PulseProfileThemeMode; isDark: boolean };

const ThemeCtx = createContext<Ctx>({
  th: buildPulseProfileTheme("dark", "violet"),
  theme: "dark",
  isDark: true,
});

export function PulseProfileThemeProvider({
  theme,
  paletteId = "violet",
  children,
}: {
  theme: PulseProfileThemeMode;
  paletteId?: PulsePaletteId;
  children: ReactNode;
}) {
  const isDark = theme === "dark";
  const th = useMemo(() => buildPulseProfileTheme(theme, paletteId), [theme, paletteId]);
  const value = useMemo(() => ({ th, theme, isDark }), [th, theme, isDark]);
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function usePulseProfileTheme() {
  return useContext(ThemeCtx);
}

export const PULSE_IG_GRAD = "linear-gradient(135deg,#feda75,#fa7e1e,#d62976,#962fbf,#4f5bd5)";
export const PULSE_IG_GLOW = "0 0 16px 2px rgba(214,41,118,0.38), 0 0 6px 1px rgba(250,126,30,0.28)";
