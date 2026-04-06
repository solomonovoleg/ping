/** Строки БД участника и персонажа (общие типы для repo / decay / payload). */

export type ParticipantRow = {
  id: string;
  campaign_public_id: string;
  platform_user_id: string;
  joined_at: Date;
  /** EDGE MONEY: после нажатия «выполнить задания»; иначе null. */
  money_tracking_started_at: Date | null;
};

export type CharacterRow = {
  participant_id: string;
  level: number;
  xp: number;
  primary_xp: number;
  secondary_xp: number;
  mood: string;
  happy_score: number;
  care_streak_days: number;
  last_fed_at: Date | null;
  last_interaction_at: Date | null;
  updated_at: Date;
  extra: unknown;
};
