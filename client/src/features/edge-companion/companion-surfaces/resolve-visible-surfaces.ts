import type { CompanionSurfaceId, CompanionUiPayload } from "./types";

type Args = {
  ui: CompanionUiPayload;
  edgeType: string | undefined;
  leaderboardEnabled: boolean;
};

/**
 * Порядок из кампании минус недоступные экраны (лидерборд без флага и т.д.).
 */
export function resolveVisibleSurfaces({
  ui,
  edgeType,
  leaderboardEnabled,
}: Args): CompanionSurfaceId[] {
  const isChar = !edgeType || edgeType === "character";
  const out: CompanionSurfaceId[] = [];
  for (const id of ui.surfaceOrder) {
    if (id === "character" && !isChar) continue;
    if (id === "leaderboard" && !leaderboardEnabled) continue;
    if (!out.includes(id)) out.push(id);
  }
  return out.length ? out : isChar ? ["character"] : ["info"];
}

export function initialSurfaceIndex(visible: CompanionSurfaceId[]): number {
  const i = visible.indexOf("character");
  return i >= 0 ? i : 0;
}
