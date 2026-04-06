import { effectiveTaskPresetScoreTarget } from "@shared/edge-task-preset-config";
import type { EdgeTaskPresetPublic } from "@/lib/edge-gamification";

/** Куда уйдёт XP за задание (как на сервере EDGE). Без `scope` в ответе — как игровой блок. */
export function effectiveEdgeTaskPresetScoreTarget(p: EdgeTaskPresetPublic): "primary" | "secondary" {
  const scope = p.scope ?? "game";
  return effectiveTaskPresetScoreTarget({ scope, scoreTarget: p.scoreTarget });
}

/** Подпись для тостов и карточек заданий (куда упали очки). */
export function edgeScoreTargetCaptionRu(target: "primary" | "secondary"): string {
  return target === "primary" ? "основной рейтинг" : "дополнительный рейтинг";
}
