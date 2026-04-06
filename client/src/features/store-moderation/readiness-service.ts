import { percentage } from "./readiness-shared";

export type ReadinessStoredState = {
  completed: string[];
  notesByKey: Record<string, string>;
};

export type ChecklistSummary = {
  done: number;
  total: number;
  percent: number;
  ready: boolean;
};

export type ReleaseReadinessSnapshot = {
  appleSummary: ChecklistSummary;
  playSummary: ChecklistSummary;
  overallDone: number;
  overallTotal: number;
  overallPercent: number;
  overallReady: boolean;
};

export function readStoredState(
  storageKey: string,
  validKeys: string[],
  rawValue: string | null,
): ReadinessStoredState {
  const validKeySet = new Set(validKeys);
  if (!rawValue) return { completed: [], notesByKey: {} };
  try {
    const parsed = JSON.parse(rawValue) as { completed?: unknown; completedKeys?: unknown; notesByKey?: unknown };
    const source = Array.isArray(parsed.completed) ? parsed.completed : Array.isArray(parsed.completedKeys) ? parsed.completedKeys : [];
    const completed = source.filter((it): it is string => typeof it === "string" && validKeySet.has(it));
    const notesByKey =
      parsed.notesByKey && typeof parsed.notesByKey === "object" ? (parsed.notesByKey as Record<string, string>) : {};
    return { completed, notesByKey };
  } catch {
    return { completed: [], notesByKey: {} };
  }
}

export function buildChecklistSummary(
  validKeys: string[],
  state: ReadinessStoredState,
  minNoteLength: number,
): ChecklistSummary {
  const done = state.completed.length;
  const total = validKeys.length;
  const hasWeakDoneNote = state.completed.some((key) => (state.notesByKey[key] ?? "").trim().length < minNoteLength);
  return {
    done,
    total,
    percent: percentage(done, total),
    ready: done === total && !hasWeakDoneNote,
  };
}

export function buildReleaseReadinessSnapshot(
  appleSummary: ChecklistSummary,
  playSummary: ChecklistSummary,
): ReleaseReadinessSnapshot {
  const overallDone = appleSummary.done + playSummary.done;
  const overallTotal = appleSummary.total + playSummary.total;
  return {
    appleSummary,
    playSummary,
    overallDone,
    overallTotal,
    overallPercent: percentage(overallDone, overallTotal),
    overallReady: appleSummary.ready && playSummary.ready,
  };
}
