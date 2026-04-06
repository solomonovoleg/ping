/** Разделители строки имён и блока статистики (зависят только от тёмной/светлой темы). */
export function pulseProfileHeroSeparators(isDark: boolean): { statSep: string; nameSep: string } {
  return {
    statSep: isDark ? "rgba(255,255,255,0.08)" : "rgba(99,102,241,0.1)",
    nameSep: isDark ? "rgba(255,255,255,0.06)" : "rgba(99,102,241,0.09)",
  };
}
