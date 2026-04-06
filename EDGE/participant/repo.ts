/** Реэкспорт репозиториев участника (файлы ≤200 строк). */
export type { ParticipantRow } from "./db-types.js";
export { ensureParticipant, getParticipantEdgeMeta } from "./participant-repo.js";
export {
  ensureCharacterRow,
  updateCharacterDecay,
  updateCharacterFeedFull,
  updateCharacterAfterInteract,
  updateCharacterExtraOnly,
  incrementCharacterTaskXp,
} from "./character-repo.js";
export type { CharacterRow } from "./character-repo.js";
export {
  countCampaignParticipants,
  listCampaignLeaderboard,
  getParticipantRankInCampaign,
  type LeaderboardRepoRow,
} from "./leaderboard-repo.js";
