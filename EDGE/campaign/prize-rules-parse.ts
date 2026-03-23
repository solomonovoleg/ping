export type ParsedPrizeRules = {
  pool: "all" | "top";
  method: "random" | "first";
  topN: number;
};

export function parsePrizeRulesFromConfig(configJson: unknown): ParsedPrizeRules {
  const root =
    configJson && typeof configJson === "object" && !Array.isArray(configJson)
      ? (configJson as Record<string, unknown>)
      : {};
  const pr = root.prizeRules;
  const o = pr && typeof pr === "object" && !Array.isArray(pr) ? (pr as Record<string, unknown>) : {};
  const pool = o.pool === "top" ? "top" : "all";
  const method = o.method === "first" ? "first" : "random";
  const rawN = o.topN;
  const topN =
    typeof rawN === "number" && Number.isFinite(rawN) ? Math.min(5000, Math.max(1, Math.floor(rawN))) : 50;
  return { pool, method, topN };
}
