/**
 * Общие классы EDGE Companion — в одном стиле с дизайн-системой (--uix-*, card, primary).
 * Используйте вместо произвольных градиентов и «чужих» палитр на экране кампании.
 */

/** Внешняя карточка блока (персонаж, лидерборд, скелетоны). */
export const EDGE_CARD =
  "relative overflow-hidden rounded-3xl border border-border/60 bg-card p-[var(--uix-space-5)] shadow-sm";

/** Внутренний блок (статы, врезка в герое). */
export const EDGE_INSET =
  "rounded-2xl border border-border/50 bg-muted/25 p-[var(--uix-space-3)]";

/** Подзаголовок-секция (eyebrow). */
export const EDGE_EYEBROW =
  "uix-text-caption font-semibold uppercase tracking-wider text-muted-foreground";

/**
 * Крупный заголовок карточки питомца (как в референсе макета) — Fraunces, не трогаем лидерборд и остальной UI.
 */
export const EDGE_PET_DISPLAY_TITLE =
  "font-edge-pet text-xl font-semibold leading-[1.2] tracking-tight text-foreground sm:text-2xl";

/** Заголовок блока внутри карточки (sans — общая логика приложения). */
export const EDGE_BLOCK_TITLE = "mt-0.5 text-lg font-bold leading-tight tracking-tight text-foreground";

/** Вторичная строка под заголовком. */
export const EDGE_BLOCK_SUB = "uix-text-caption mt-0.5 truncate";

/** Чип статуса (нейтральный). */
export const EDGE_CHIP =
  "inline-flex items-center gap-1 rounded-full border border-border/60 bg-secondary/80 px-2.5 py-1 uix-text-caption font-medium text-secondary-foreground";

/** Чип предупреждения (голод / пора кормить). */
export const EDGE_CHIP_WARN =
  "inline-flex items-center rounded-full border border-orange-500/25 bg-orange-500/10 px-2.5 py-1 uix-text-caption font-semibold text-orange-800 dark:text-orange-200";

/** Чип акцента (серия дней). */
export const EDGE_CHIP_ACCENT =
  "inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 uix-text-caption font-medium text-primary";

/** Вторичное действие (поиграть / погладить): как outline + secondary. */
export const EDGE_ACTION_SECONDARY =
  "flex min-h-[var(--uix-touch-min)] items-center justify-center gap-2 rounded-2xl border border-border bg-secondary/60 px-3 py-2.5 uix-text-list-secondary font-semibold text-secondary-foreground shadow-xs transition-opacity disabled:opacity-50";

/** Основной CTA — системный primary. */
export const EDGE_ACTION_PRIMARY =
  "relative flex min-h-[var(--uix-touch-min)] w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-base font-semibold text-primary-foreground shadow-sm transition-opacity disabled:opacity-50";
