import { buildInteractCompletionState } from "./service-interact.js";
import { applyLifeAfterAction, resolveFulfillAction, type FulfillAction } from "./service-helpers.js";
import type { InteractKind } from "./character-rules.js";

export function buildInteractCompletionUpdate(params: {
  kind: InteractKind;
  tapExtra: Record<string, unknown>;
  now: Date;
  campaignConfigJson: unknown;
  primaryBlocked: boolean;
  baseXp: number;
  baseLevel: number;
  prevMood: string;
}): {
  xp: number;
  happy: number;
  mood: "happy" | "neutral" | "sad";
  level: number;
  extra: Record<string, unknown>;
} {
  const interactState = buildInteractCompletionState({
    kind: params.kind,
    tapExtra: params.tapExtra,
    now: params.now,
    campaignConfigJson: params.campaignConfigJson,
    primaryBlocked: params.primaryBlocked,
    baseXp: params.baseXp,
    baseLevel: params.baseLevel,
  });
  const fulfill: FulfillAction | null = resolveFulfillAction(params.kind);
  const extra = applyLifeAfterAction(
    interactState.newExtra,
    params.campaignConfigJson,
    params.now,
    params.prevMood,
    interactState.newMood,
    fulfill,
  );
  return {
    xp: interactState.newXp,
    happy: interactState.newHappy,
    mood: interactState.newMood,
    level: interactState.newLevel,
    extra,
  };
}
