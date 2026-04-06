import type { CompanionSurfaceId } from "./types";

/** Подписи для индикатора и доступности. */
export const COMPANION_SURFACE_LABEL: Record<CompanionSurfaceId, string> = {
  tasks: "Задания",
  character: "Персонаж",
  info: "О кампании",
  leaderboard: "Основной рейтинг",
  leaderboardSecondary: "Активность",
  results: "Итоги",
  prizes: "Призы",
};

/** Короткие подписи в рейке табов (макет interactive-post после входа из поста). */
export const COMPANION_SURFACE_TAB_LABEL: Record<CompanionSurfaceId, string> = {
  tasks: "Задания",
  character: "Игра",
  info: "Правила",
  leaderboard: "Рейтинг",
  leaderboardSecondary: "Активность",
  results: "Розыгрыш",
  prizes: "Призы",
};
