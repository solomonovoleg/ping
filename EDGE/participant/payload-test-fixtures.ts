import { EDGE_ACTION_TAP_TARGET } from "./character-rules.js";
import type { ParticipantComposeContextInput, ParticipantComposeInput } from "./payload-types.js";

export function makeCoreFixture(
  overrides: Partial<ParticipantComposeInput["core"]> = {},
): ParticipantComposeInput["core"] {
  return {
    level: 2,
    xp: 120,
    primaryXp: 80,
    secondaryXp: 40,
    mood: "happy",
    happyScore: 75,
    careStreakDays: 3,
    ...overrides,
  };
}

export function makeTimeFixture(
  overrides: Partial<ParticipantComposeInput["time"]> = {},
): ParticipantComposeInput["time"] {
  return {
    lastFedAt: "2026-03-25T08:00:00.000Z",
    lastInteractionAt: "2026-03-25T09:00:00.000Z",
    joinedAt: "2026-03-20T10:00:00.000Z",
    careDeadlineAt: "2026-03-25T16:00:00.000Z",
    ...overrides,
  };
}

export function makeStatusFixture(
  overrides: Partial<ParticipantComposeInput["status"]> = {},
): ParticipantComposeInput["status"] {
  return {
    gameScriptMetrics: {
      gameDailyYmd: "2026-03-25",
      gameLoginStreakDays: 5,
      dailyTapCount: 1,
      dailyFeedCount: 2,
      dailyPlayCount: 3,
      dailyToiletCount: 0,
      dailyCalmCount: 0,
      dailyPetCount: 4,
    },
    petNeeds: { hunger: 70, hygiene: 68, energy: 72, comfort: 74 },
    activeNeed: null,
    ...overrides,
  };
}

export function makeActionProgressFixture(
  overrides: Partial<ParticipantComposeInput["actionProgress"]> = {},
): ParticipantComposeInput["actionProgress"] {
  return {
    feed: 1,
    toilet: 0,
    play: 2,
    target: EDGE_ACTION_TAP_TARGET,
    ...overrides,
  };
}

export function makeLifeSimulationFixture(): ParticipantComposeInput["lifeSimulation"] {
  return { enabled: false };
}

export function makeComposeContextFixture(
  overrides: Partial<ParticipantComposeContextInput> = {},
): ParticipantComposeContextInput {
  return {
    characterStatus: makeStatusFixture(),
    recommendedAction: "play",
    actionProgressPayload: makeActionProgressFixture(),
    introTapCount: 4,
    lifeSimulation: makeLifeSimulationFixture(),
    ...overrides,
  };
}
