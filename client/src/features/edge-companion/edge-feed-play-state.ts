import type { EdgeParticipantState } from "@/lib/edge-participant";

/**
 * «Уже играл» — было любое осмысленное взаимодействие с персонажем / прогресс.
 * Только открытие ленты без действий даёт нули и призыв «начни игру».
 */
export function hasStartedEdgePlay(s: EdgeParticipantState | undefined): boolean {
  if (!s) return false;
  const gm = s.gameScriptMetrics;
  const anyDaily =
    (gm?.dailyTapCount ?? 0) > 0 ||
    (gm?.dailyFeedCount ?? 0) > 0 ||
    (gm?.dailyPlayCount ?? 0) > 0 ||
    (gm?.dailyToiletCount ?? 0) > 0 ||
    (gm?.dailyCalmCount ?? 0) > 0 ||
    (gm?.dailyPetCount ?? 0) > 0;
  return (
    s.xp > 0 ||
    s.level > 0 ||
    s.lastFedAt != null ||
    s.lastInteractionAt != null ||
    s.careStreakDays > 0 ||
    anyDaily
  );
}

/** Текст для облака, если игрок ещё не начинал (по метрикам выше). */
export const EDGE_FEED_NEW_PLAYER_SUBLINE =
  "Нажми «Начать игру» внизу — покормим и поиграем!";
