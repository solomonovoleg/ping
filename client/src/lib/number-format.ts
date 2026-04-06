/**
 * Компактный формат счётчиков для соц-интерфейса (ru):
 * 1200 -> 1,2 тыс.
 * 1500000 -> 1,5 млн
 */
export function formatCompactCountRu(value: number | null | undefined): string {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return "0";
  const abs = Math.abs(num);

  const formatOneDecimal = (v: number): string => {
    const rounded = Math.round(v * 10) / 10;
    const fixed = rounded.toFixed(1).replace(/\.0$/, "");
    return fixed.replace(".", ",");
  };

  if (abs >= 1_000_000_000) return `${formatOneDecimal(num / 1_000_000_000)} млрд`;
  if (abs >= 1_000_000) return `${formatOneDecimal(num / 1_000_000)} млн`;
  if (abs >= 1_000) return `${formatOneDecimal(num / 1_000)} тыс.`;
  return `${Math.round(num)}`;
}
