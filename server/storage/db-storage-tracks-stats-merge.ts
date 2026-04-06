export type TracksStatsQuerySnapshot = {
  totalTracks: number;
  activeMessageItems: number;
  doneMessageItems: number;
  lastMessageAdded: Date | null;
  activeCallItems: number;
  doneCallItems: number;
  lastCallAdded: Date | null;
};

export function mergeTracksStatsAggregates(p: TracksStatsQuerySnapshot): {
  totalTracks: number;
  activeItemsCount: number;
  doneItemsCount: number;
  lastAddedAt: Date | null;
} {
  const candidates = [p.lastMessageAdded, p.lastCallAdded].filter(Boolean) as Date[];
  return {
    totalTracks: p.totalTracks,
    activeItemsCount: p.activeMessageItems + p.activeCallItems,
    doneItemsCount: p.doneMessageItems + p.doneCallItems,
    lastAddedAt: candidates.sort((a, b) => b.getTime() - a.getTime())[0] ?? null,
  };
}
