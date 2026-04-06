/** Подразделы хаба «Модерация» (подсветка пункта в меню). Должно совпадать с AdminLayout. */
const MODERATION_SUBPATHS = new Set([
  "/admin/moderation",
  "/admin/ops",
  "/admin/store-review",
  "/admin/store-review-privacy",
  "/admin/store-review-metadata",
  "/admin/store-review-risks",
  "/admin/store-review-play",
]);

export function isAdminModerationNavActive(locationPath: string): boolean {
  return MODERATION_SUBPATHS.has(locationPath);
}
