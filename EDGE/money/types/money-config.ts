/**
 * Конфиг EDGE MONEY в `edge_campaigns.config_json.money` (черновик контракта).
 */

export type MoneyScoringKind =
  | "invite_friend"
  | "chat_messages"
  | "video_call_minutes"
  | "follow_creator"
  | "post_created"
  | "profile_likes_received";

export type MoneyScoringRule = {
  id: string;
  kind: MoneyScoringKind;
  /** Например 10 сообщений, 15 минут звонка, 10 лайков. */
  threshold: number;
  points: number;
  enabled: boolean;
  /** Макс. баллов за сутки UTC для правил с дневным потолком; `0` = без лимита. */
  maxPointsPerDay?: number;
};

export type MoneyPrizeTier = {
  id: string;
  fromRank: number;
  toRank: number;
  /** Текст приза для UI (например «5000₽»). */
  label: string;
  /** Связь с шаблоном в gifts_json (позже). */
  templateKey?: string;
};

/** Шаблон ЛС с кодами (как `pingInviteDm` у companion). */
export type MoneyInviteDmConfig = {
  template: string;
  codeExpiresInHours: number;
};

export type MoneyColorScheme = "default" | "gold" | "emerald" | "rose" | "violet" | "cyan";

export const MONEY_COLOR_SCHEMES: readonly MoneyColorScheme[] = [
  "default", "gold", "emerald", "rose", "violet", "cyan",
] as const;

export type MoneyConfigParsed = {
  version: 1;
  headline: string;
  mediaUrl: string | null;
  scoringRules: MoneyScoringRule[];
  prizeTiers: MoneyPrizeTier[];
  /** Опционально: кастомный текст и срок кодов для задания «пригласить». */
  inviteDm?: MoneyInviteDmConfig;
  /** Цветовая схема companion-шаблона. */
  colorScheme?: MoneyColorScheme;
};
