import type { CallReactionEvent, CallReactionKind } from "../call-types";

export function createReaction(kind: CallReactionKind, from: "local" | "remote"): CallReactionEvent {
  return {
    id: crypto.randomUUID(),
    kind,
    from,
    sentAt: Date.now(),
  };
}

export function trimReactionQueue(queue: CallReactionEvent[], max = 24): CallReactionEvent[] {
  if (queue.length <= max) return queue;
  return queue.slice(queue.length - max);
}
