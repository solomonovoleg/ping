import type { CompanionSurfaceId, CompanionUiPayload } from "./types";

/** Флаги рейтингов из `campaign-config` (учёт legacy `globalEnabled`). */
export function resolveLeaderboardVisibility(leaderboard?: {
  globalEnabled?: boolean;
  primaryEnabled?: boolean;
  secondaryEnabled?: boolean;
}): { primaryOn: boolean; secondaryOn: boolean } {
  const primaryOn = leaderboard?.primaryEnabled ?? leaderboard?.globalEnabled ?? true;
  const secondaryOn = Boolean(leaderboard?.secondaryEnabled);
  return { primaryOn, secondaryOn };
}

type Args = {
  ui: CompanionUiPayload;
  edgeType: string | undefined;
  /** @deprecated Используйте `leaderboardPrimaryEnabled` из campaign-config. */
  leaderboardEnabled?: boolean;
  /** Основной рейтинг (персонаж / игровые очки). */
  leaderboardPrimaryEnabled?: boolean;
  /** Дополнительный рейтинг (лента, задания и т.п.). */
  leaderboardSecondaryEnabled?: boolean;
  /** Если 0 — экран «Задания» скрыт (нет смысла пустой слайд). */
  taskPresetsCount?: number;
};

/** Задания всегда сразу перед «Персонаж» в свайпе (клиент + старые конфиги). */
function normalizeTasksBeforeCharacter(order: CompanionSurfaceId[]): CompanionSurfaceId[] {
  if (!order.includes("character")) return order;
  const rest: CompanionSurfaceId[] = order.filter((id) => id !== "tasks");
  const ci = rest.indexOf("character");
  if (ci < 0) return order;
  const out: CompanionSurfaceId[] = [...rest];
  out.splice(ci, 0, "tasks");
  return out;
}

/**
 * Порядок из кампании минус недоступные экраны (лидерборд без флага и т.д.).
 */
function injectLeaderboardSecondary(
  surfaces: CompanionSurfaceId[],
  primaryOn: boolean,
  secondaryOn: boolean,
): CompanionSurfaceId[] {
  if (!secondaryOn) {
    return surfaces.filter((id) => id !== "leaderboardSecondary");
  }
  const base = surfaces.filter((id) => id !== "leaderboardSecondary");
  const idxPrimary = base.indexOf("leaderboard");
  if (primaryOn && idxPrimary >= 0) {
    const next: CompanionSurfaceId[] = [...base];
    next.splice(idxPrimary + 1, 0, "leaderboardSecondary");
    return next;
  }
  const idxResults = base.findIndex((id) => id === "results" || id === "prizes");
  const at = idxResults >= 0 ? idxResults : base.length;
  const next: CompanionSurfaceId[] = [...base];
  next.splice(at, 0, "leaderboardSecondary");
  return next;
}

export function resolveVisibleSurfaces({
  ui,
  edgeType,
  leaderboardEnabled,
  leaderboardPrimaryEnabled,
  leaderboardSecondaryEnabled,
  taskPresetsCount = 0,
}: Args): CompanionSurfaceId[] {
  const primaryOn =
    leaderboardPrimaryEnabled !== undefined ? leaderboardPrimaryEnabled : (leaderboardEnabled ?? true);
  const secondaryOn = leaderboardSecondaryEnabled ?? false;

  const isChar = !edgeType || edgeType === "character";
  const order = normalizeTasksBeforeCharacter(ui.surfaceOrder);
  const out: CompanionSurfaceId[] = [];
  for (const id of order) {
    if (id === "tasks" && taskPresetsCount <= 0) continue;
    if (id === "character" && !isChar) continue;
    if (id === "leaderboard" && !primaryOn) continue;
    if (id === "leaderboardSecondary" && !secondaryOn) continue;
    if (!out.includes(id)) out.push(id);
  }
  const merged = injectLeaderboardSecondary(out, primaryOn, secondaryOn);
  return merged.length ? merged : isChar ? ["character"] : ["info"];
}

/**
 * Стартовый слайд в ленте: персонаж, если есть; иначе основной рейтинг (кампании без персонажа / «медиа»).
 */
export function initialSurfaceIndex(visible: CompanionSurfaceId[]): number {
  const ch = visible.indexOf("character");
  if (ch >= 0) return ch;
  const lb = visible.indexOf("leaderboard");
  if (lb >= 0) return lb;
  const lb2 = visible.indexOf("leaderboardSecondary");
  if (lb2 >= 0) return lb2;
  return 0;
}
