import {
  interactCooldownRemainingMs,
  interactNextAvailableIso,
  type InteractKind,
} from "./character-rules.js";
import { fallbackNextAvailableIso } from "./service-helpers.js";
import type { ParticipantStatePayload } from "./types.js";

export type PostInteractOutcome =
  | { ok: true; state: ParticipantStatePayload }
  | {
      ok: false;
      code: "cooldown";
      kind: InteractKind;
      nextAvailableAt: string;
    };

export function buildCooldownOutcome(
  kind: InteractKind,
  now: Date,
  nextAvailableAt: string | null,
): PostInteractOutcome {
  return {
    ok: false,
    code: "cooldown",
    kind,
    nextAvailableAt: nextAvailableAt ?? fallbackNextAvailableIso(now),
  };
}

export function resolveInteractCooldownOutcome(
  extra: Record<string, unknown>,
  kind: InteractKind,
  now: Date,
): PostInteractOutcome | null {
  if (interactCooldownRemainingMs(extra, kind, now) <= 0) return null;
  const next = interactNextAvailableIso(extra, kind, now);
  return buildCooldownOutcome(kind, now, next);
}
