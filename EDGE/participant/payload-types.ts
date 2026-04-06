import type { ParticipantStatePayload } from "./types.js";

export type ParticipantCorePart = Pick<
  ParticipantStatePayload,
  "level" | "xp" | "primaryXp" | "secondaryXp" | "mood" | "happyScore" | "careStreakDays"
>;

export type ParticipantTimePart = Pick<
  ParticipantStatePayload,
  "lastFedAt" | "lastInteractionAt" | "joinedAt" | "careDeadlineAt"
>;

export type ParticipantStatusPart = Pick<
  ParticipantStatePayload,
  "gameScriptMetrics" | "petNeeds" | "activeNeed"
>;

export type ParticipantComposeInput = {
  edgeId: string;
  platformUserId: string;
  core: ParticipantCorePart;
  time: ParticipantTimePart;
  status: ParticipantStatusPart;
  recommendedAction: ParticipantStatePayload["recommendedAction"];
  actionProgress: ParticipantStatePayload["actionProgress"];
  introTapCount: number;
  lifeSimulation: ParticipantStatePayload["lifeSimulation"];
};

export type ParticipantComposeContextInput = {
  characterStatus: ParticipantComposeInput["status"];
  recommendedAction: ParticipantComposeInput["recommendedAction"];
  actionProgressPayload: ParticipantComposeInput["actionProgress"];
  introTapCount: number;
  lifeSimulation: ParticipantComposeInput["lifeSimulation"];
};
