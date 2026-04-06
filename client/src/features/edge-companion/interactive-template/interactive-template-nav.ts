/** Навигация между экранами шаблона (индексы считает оболочка). */
export type InteractiveTemplateNav = {
  goToCharacter: () => void;
  goToTasks: () => void;
  goToLeaderboardPrimary: () => void;
  goToWinMoney: () => void;
  goToPrizes: () => void;
};
