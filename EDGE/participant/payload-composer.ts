import { EMPTY_TASK_QUEST_SUMMARY, type ParticipantStatePayload } from "./types.js";
import type { ParticipantComposeInput } from "./payload-types.js";

export function composeParticipantStatePayload(
  params: ParticipantComposeInput,
): ParticipantStatePayload {
  return {
    edgeId: params.edgeId,
    platformUserId: params.platformUserId,
    level: params.core.level,
    xp: params.core.xp,
    primaryXp: params.core.primaryXp,
    secondaryXp: params.core.secondaryXp,
    mood: params.core.mood,
    happyScore: params.core.happyScore,
    careStreakDays: params.core.careStreakDays,
    lastFedAt: params.time.lastFedAt,
    lastInteractionAt: params.time.lastInteractionAt,
    joinedAt: params.time.joinedAt,
    careDeadlineAt: params.time.careDeadlineAt,
    gameScriptMetrics: params.status.gameScriptMetrics,
    petNeeds: params.status.petNeeds,
    activeNeed: params.status.activeNeed,
    recommendedAction: params.recommendedAction,
    actionProgress: params.actionProgress,
    introTapCount: params.introTapCount,
    lifeSimulation: params.lifeSimulation,
    taskGrants: [],
    taskProgress: [],
    taskQuestSummary: { ...EMPTY_TASK_QUEST_SUMMARY },
  };
}
