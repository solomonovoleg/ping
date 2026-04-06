export const APPLE_CHECKLIST_STORAGE_KEY = "store-review-apple-ux-11-checklist";
export const PLAY_CHECKLIST_STORAGE_KEY = "store-review-play-release-checklist";
export const MIN_REVIEW_NOTE_LENGTH = 8;

export function percentage(done: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((done / total) * 100);
}
