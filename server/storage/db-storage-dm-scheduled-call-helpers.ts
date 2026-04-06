/** Окно «ещё актуален» после `fire_at` (совпадает с фильтром в `getActiveDmScheduledCallForChatMember`). */
export const DM_SCHEDULED_CALL_ACTIVE_GRACE_MS = 5 * 60_000;

/** Сколько последних строк подгружаем перед фильтром по grace (как в монолите). */
export const DM_SCHEDULED_CALL_CANDIDATE_LIMIT = 8;

/** Окно до звонка для пре-ивента в списке (`listDmScheduledCallsInPreEventWindow`). */
export const DM_SCHEDULED_CALL_PRE_EVENT_WINDOW_MS = 5 * 60_000;

/** Отсечка «ещё не в прошлом» для списка планировщика (`listPlannerActiveDmScheduledCalls`). */
export const DM_PLANNER_ACTIVE_CUTOFF_PAST_MS = 2 * 60_000;

export type DmScheduledCallActiveCandidateRow = {
  id: string;
  fireAt: Date;
  title: string;
  createdByUserId: string;
  peerUserId: string;
  initiatorDismissedAt: Date | null;
  peerDismissedAt: Date | null;
};

export function pickActiveDmScheduledCallForMember(
  rows: DmScheduledCallActiveCandidateRow[],
  userId: string,
  nowMs: number,
  graceAfterFireMs: number = DM_SCHEDULED_CALL_ACTIVE_GRACE_MS,
): {
  id: string;
  fireAt: Date;
  title: string;
  createdByUserId: string;
  peerUserId: string;
  iAmInitiator: boolean;
} | null {
  for (const r of rows) {
    const until = r.fireAt.getTime() + graceAfterFireMs;
    if (nowMs > until) continue;
    const iAmInitiator = r.createdByUserId === userId;
    if (iAmInitiator && r.initiatorDismissedAt) continue;
    if (!iAmInitiator && r.peerDismissedAt) continue;
    return {
      id: r.id,
      fireAt: r.fireAt,
      title: r.title,
      createdByUserId: r.createdByUserId,
      peerUserId: r.peerUserId,
      iAmInitiator,
    };
  }
  return null;
}
