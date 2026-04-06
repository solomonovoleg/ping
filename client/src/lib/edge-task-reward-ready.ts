import type { CSSProperties } from "react";

/**
 * «Награда в игре готова к получению» — единые токены для карточки (Tailwind / --primary)
 * и полноэкранного интерактивного шаблона (фиксированная палитра).
 */
export const EDGE_REWARD_READY_ROW_TW =
  "ring-2 ring-primary/45 border-primary/45 shadow-[0_0_28px_-10px_hsl(var(--primary)/0.5)]" as const;

/** Компактная сводка под заголовком (тема приложения, тот же язык что у строки списка). */
export const EDGE_REWARD_READY_SUMMARY_READY_TW =
  "border-primary/45 bg-primary/[0.12] ring-2 ring-primary/35 shadow-[0_0_24px_-10px_hsl(var(--primary)/0.42)]" as const;

/** Сводка на тёмном полотне (#060b18) без опоры на `html.dark`. */
export const EDGE_TASK_SUMMARY_BASE_DARK_TW =
  "border-violet-500/30 bg-violet-500/[0.1] text-slate-300 [&_.font-semibold]:text-slate-100" as const;

export const EDGE_REWARD_READY_SUMMARY_READY_DARK_TW =
  "border-[rgba(167,139,250,0.65)] bg-violet-500/[0.14] text-slate-200 ring-2 ring-[rgba(167,139,250,0.35)] shadow-[0_0_22px_-6px_rgba(167,139,250,0.45)] [&_.font-semibold]:text-slate-50" as const;

const INLINE = {
  dark: {
    border: "2px solid rgba(167,139,250,0.65)",
    boxShadow: "0 0 22px -6px rgba(167,139,250,0.45)",
    accent: "#c4b5fd",
  },
  light: {
    border: "2px solid rgba(109,40,217,0.42)",
    boxShadow: "0 0 18px -5px rgba(91,33,182,0.28)",
    accent: "#5b21b6",
  },
} as const;

export type EdgeRewardReadyChromeVariant = keyof typeof INLINE;

export const EDGE_REWARD_READY_CHROME_DEFAULT: EdgeRewardReadyChromeVariant = "dark";

export function edgeRewardReadyRowChrome(
  variant: EdgeRewardReadyChromeVariant,
): Pick<CSSProperties, "border" | "boxShadow"> {
  const t = INLINE[variant];
  return { border: t.border, boxShadow: t.boxShadow };
}

export function edgeRewardReadyAccentColor(variant: EdgeRewardReadyChromeVariant): string {
  return INLINE[variant].accent;
}

/** Готовые связки для разметки без лишних вызовов. */
export const EDGE_REWARD_READY_STYLE = {
  dark: {
    chrome: edgeRewardReadyRowChrome("dark"),
    accent: edgeRewardReadyAccentColor("dark"),
  },
  light: {
    chrome: edgeRewardReadyRowChrome("light"),
    accent: edgeRewardReadyAccentColor("light"),
  },
} as const;
