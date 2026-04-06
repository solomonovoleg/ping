export {
  AdminShellProvider,
  useAdminShellUser,
  useAdminShellBreadcrumbs,
  useAdminShellQuickActions,
  type AdminShellBreadcrumb,
  type AdminShellQuickAction,
} from "./context";
export { AdminPageHeader, type AdminPageHeaderProps } from "./AdminPageHeader";
export { AdminStatCard, type AdminStatCardProps } from "./AdminStatCard";
export { AdminPanelCard, AdminMetricTile } from "./AdminPanelCard";
export { AdminSectionTemplate } from "./AdminSectionTemplate";

/** Отступы и ширина контентной колонки для страниц админки */
export function adminPageStackClass() {
  return "mx-auto w-full max-w-[1400px] space-y-6 min-w-0";
}

/**
 * Поверхность Dialog / AlertDialog в админке (портал вне [data-admin-shell]).
 * См. `admin-shell.css` — класс `.admin-dialog-surface`.
 */
export const adminDialogSurfaceClass = "admin-dialog-surface";

/** Скелетоны на тёмном фоне админки — см. `.admin-skeleton-shimmer` в `admin-shell.css` */
export const adminSkeletonClass = "admin-skeleton-shimmer";
