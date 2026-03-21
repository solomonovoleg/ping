import { createContext } from "react";

export interface Th {
  isDark: boolean
  bg: string
  ambient: string
  tileBg: (color: string, hasVideo: boolean) => string
  tileBorder: (highlighted: boolean, color: string) => string
  tileGlow: (highlighted: boolean, color: string) => string
  namePill: string
  namePillText: string
  panelBg: string
  panelBorder: string
  topBarPill: string
  topBarPillBorder: string
  topBarText: string
  topBarTextFaint: string
  topBarDivider: string
  viewBtnActive: { background: string; color: string; border: string }
  viewBtnInactive: { color: string; border: string }
  aiBtnActive: { background: string; border: string; color: string }
  aiBtnInactive: { background: string; border: string; color: string }
  eyeBtn: string
  controlsPill: string
  controlsPillBorder: string
  controlsPillShadow: string
  controlsBtnHover: string
  controlsBtnText: string
  controlsDivider: string
  cardBg: string
  cardBorder: string
  rowBorder: string
  rowHover: string
  trackBg: string
  text: string
  textMuted: string
  textFaint: string
  tabActive: { background: string; color: string; border: string }
  tabInactive: { color: string }
  showUiBg: string
  showUiBorder: string
  showUiText: string
  captionBg: (active: boolean) => string
  captionBorder: (active: boolean) => string
  captionText: (active: boolean) => string
  captionBadgeBg: string
  captionBadgeText: string
}

export const darkTh: Th = {
  isDark: true,
  bg: "#080810",
  ambient: "radial-gradient(ellipse 90% 70% at 50% 50%,rgba(60,50,140,0.1) 0%,#080810 70%)",
  tileBg: (color, hasVideo) =>
    hasVideo
      ? `radial-gradient(ellipse 70% 75% at 50% 35%,${color}20 0%,#0c0c18 80%)`
      : "#0a0a14",
  tileBorder: (h, c) => (h ? `1px solid ${c}90` : "1px solid rgba(255,255,255,0.06)"),
  tileGlow: (h, c) => (h ? `0 0 0 1px ${c}50, 0 0 12px ${c}18` : "none"),
  namePill: "rgba(0,0,0,0.6)",
  namePillText: "rgba(255,255,255,0.75)",
  panelBg: "rgba(9,9,18,0.94)",
  panelBorder: "rgba(255,255,255,0.05)",
  topBarPill: "rgba(255,255,255,0.04)",
  topBarPillBorder: "rgba(255,255,255,0.07)",
  topBarText: "rgba(255,255,255,0.5)",
  topBarTextFaint: "rgba(255,255,255,0.28)",
  topBarDivider: "rgba(255,255,255,0.1)",
  viewBtnActive: {
    background: "rgba(99,102,241,0.22)",
    color: "#a5b4fc",
    border: "1px solid rgba(99,102,241,0.35)",
  },
  viewBtnInactive: { color: "rgba(255,255,255,0.3)", border: "1px solid transparent" },
  aiBtnActive: {
    background: "rgba(139,92,246,0.18)",
    border: "1px solid rgba(139,92,246,0.4)",
    color: "#c4b5fd",
  },
  aiBtnInactive: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "rgba(255,255,255,0.32)",
  },
  eyeBtn: "rgba(255,255,255,0.3)",
  controlsPill: "rgba(255,255,255,0.025)",
  controlsPillBorder: "rgba(255,255,255,0.055)",
  controlsPillShadow: "0 8px 40px rgba(0,0,0,0.55)",
  controlsBtnHover: "rgba(255,255,255,0.07)",
  controlsBtnText: "rgba(255,255,255,0.5)",
  controlsDivider: "rgba(255,255,255,0.06)",
  cardBg: "rgba(255,255,255,0.025)",
  cardBorder: "rgba(255,255,255,0.06)",
  rowBorder: "rgba(255,255,255,0.04)",
  rowHover: "rgba(255,255,255,0.025)",
  trackBg: "rgba(255,255,255,0.06)",
  text: "rgba(255,255,255,0.85)",
  textMuted: "rgba(255,255,255,0.45)",
  textFaint: "rgba(255,255,255,0.28)",
  tabActive: {
    background: "rgba(139,92,246,0.22)",
    color: "#c4b5fd",
    border: "1px solid rgba(139,92,246,0.35)",
  },
  tabInactive: { color: "rgba(255,255,255,0.28)" },
  showUiBg: "rgba(255,255,255,0.07)",
  showUiBorder: "rgba(255,255,255,0.1)",
  showUiText: "rgba(255,255,255,0.45)",
  captionBg: (a) => (a ? "rgba(0,0,0,0.68)" : "rgba(0,0,0,0.35)"),
  captionBorder: (a) => (a ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(255,255,255,0.03)"),
  captionText: (a) => (a ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.6)"),
  captionBadgeBg: "rgba(0,0,0,0.45)",
  captionBadgeText: "rgba(255,255,255,0.35)",
}

export const lightTh: Th = {
  isDark: false,
  bg: "#e8ecf9",
  ambient: "radial-gradient(ellipse 90% 70% at 50% 50%,rgba(99,102,241,0.07) 0%,#e8ecf9 70%)",
  tileBg: (color, hasVideo) =>
    hasVideo
      ? `radial-gradient(ellipse 70% 75% at 50% 35%,${color}28 0%,#d2d9f0 85%)`
      : "#cdd4ed",
  tileBorder: (h, c) => (h ? `1.5px solid ${c}90` : "1.5px solid rgba(99,102,241,0.12)"),
  tileGlow: (h, c) => (h ? `0 0 24px ${c}30,inset 0 0 30px ${c}08` : "none"),
  namePill: "rgba(255,255,255,0.88)",
  namePillText: "rgba(15,15,45,0.75)",
  panelBg: "rgba(245,247,255,0.97)",
  panelBorder: "rgba(99,102,241,0.1)",
  topBarPill: "rgba(255,255,255,0.72)",
  topBarPillBorder: "rgba(99,102,241,0.12)",
  topBarText: "rgba(30,30,70,0.55)",
  topBarTextFaint: "rgba(30,30,70,0.35)",
  topBarDivider: "rgba(99,102,241,0.12)",
  viewBtnActive: {
    background: "rgba(99,102,241,0.14)",
    color: "#6366f1",
    border: "1px solid rgba(99,102,241,0.3)",
  },
  viewBtnInactive: { color: "rgba(30,30,70,0.35)", border: "1px solid transparent" },
  aiBtnActive: {
    background: "rgba(139,92,246,0.12)",
    border: "1px solid rgba(139,92,246,0.3)",
    color: "#7c3aed",
  },
  aiBtnInactive: {
    background: "rgba(255,255,255,0.55)",
    border: "1px solid rgba(99,102,241,0.1)",
    color: "rgba(30,30,70,0.4)",
  },
  eyeBtn: "rgba(30,30,70,0.35)",
  controlsPill: "rgba(255,255,255,0.88)",
  controlsPillBorder: "rgba(99,102,241,0.14)",
  controlsPillShadow: "0 8px 40px rgba(99,102,241,0.12)",
  controlsBtnHover: "rgba(99,102,241,0.07)",
  controlsBtnText: "rgba(30,30,70,0.45)",
  controlsDivider: "rgba(99,102,241,0.1)",
  cardBg: "rgba(255,255,255,0.65)",
  cardBorder: "rgba(99,102,241,0.1)",
  rowBorder: "rgba(99,102,241,0.07)",
  rowHover: "rgba(99,102,241,0.05)",
  trackBg: "rgba(99,102,241,0.08)",
  text: "rgba(15,15,45,0.85)",
  textMuted: "rgba(15,15,45,0.5)",
  textFaint: "rgba(15,15,45,0.35)",
  tabActive: {
    background: "rgba(99,102,241,0.12)",
    color: "#6366f1",
    border: "1px solid rgba(99,102,241,0.25)",
  },
  tabInactive: { color: "rgba(15,15,45,0.35)" },
  showUiBg: "rgba(255,255,255,0.75)",
  showUiBorder: "rgba(99,102,241,0.15)",
  showUiText: "rgba(30,30,70,0.5)",
  captionBg: (a) => (a ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.6)"),
  captionBorder: (a) => (a ? "1px solid rgba(99,102,241,0.15)" : "1px solid rgba(99,102,241,0.06)"),
  captionText: (a) => (a ? "rgba(15,15,45,0.9)" : "rgba(15,15,45,0.55)"),
  captionBadgeBg: "rgba(255,255,255,0.82)",
  captionBadgeText: "rgba(30,30,70,0.4)",
}

export const ThCtx = createContext<Th>(darkTh)
