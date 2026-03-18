import { cn } from "@/lib/utils";

/**
 * Оболочка контента экрана по Design System:
 * - единый горизонтальный отступ (--uix-space-4);
 * - опционально заголовок экрана с типографикой --uix-text-title.
 * Использовать на экранах: Чаты, Лента, Настройки, Профиль и т.д.
 */
export function PageShell({
  children,
  className,
  /** Заголовок экрана (Чаты, Лента, Настройки) — выводится с ролью title */
  title,
  /** Дополнительные действия в шапке (справа от title) */
  actions,
  /** Контент без горизонтального паддинга (на весь ширину), например список с собственным отступом */
  fullWidth,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
  actions?: React.ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col min-h-0 w-full max-w-full min-w-0",
        !fullWidth && "uix-content-x",
        className
      )}
    >
      {(title != null || actions != null) && (
        <header className="flex items-center justify-between gap-2 shrink-0 py-3 border-b border-border/50">
          {title != null && <h1 className="uix-text-title truncate">{title}</h1>}
          {actions != null && <div className="flex items-center gap-1 shrink-0">{actions}</div>}
        </header>
      )}
      {children}
    </div>
  );
}
