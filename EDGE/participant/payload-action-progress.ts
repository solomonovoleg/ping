import { EDGE_ACTION_TAP_TARGET } from "./character-rules.js";
import type { ActionProgress } from "./character-rules.js";
import type { ParticipantStatePayload } from "./types.js";

export function buildActionProgressPayload(
  actionProgress: ActionProgress,
): ParticipantStatePayload["actionProgress"] {
  return {
    ...actionProgress,
    target: EDGE_ACTION_TAP_TARGET,
  };
}
