import { AlertCircle } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

function Empty({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty"
      className={cn(
        "flex min-w-0 flex-1 flex-col items-center justify-center gap-6 text-balance rounded-lg border-dashed p-6 text-center md:p-12",
        className
      )}
      {...props}
    />
  )
}

function EmptyHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-header"
      className={cn(
        "flex max-w-sm flex-col items-center gap-2 text-center",
        className
      )}
      {...props}
    />
  )
}

const emptyMediaVariants = cva(
  "mb-2 flex shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        icon: "bg-muted text-foreground flex size-10 shrink-0 items-center justify-center rounded-lg [&_svg:not([class*='size-'])]:size-6",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function EmptyMedia({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof emptyMediaVariants>) {
  return (
    <div
      data-slot="empty-icon"
      data-variant={variant}
      className={cn(emptyMediaVariants({ variant, className }))}
      {...props}
    />
  )
}

function EmptyTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-title"
      className={cn("text-lg font-medium tracking-tight", className)}
      {...props}
    />
  )
}

function EmptyDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <div
      data-slot="empty-description"
      className={cn(
        "text-muted-foreground [&>a:hover]:text-primary text-sm/relaxed [&>a]:underline [&>a]:underline-offset-4",
        className
      )}
      {...props}
    />
  )
}

function EmptyContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-content"
      className={cn(
        "flex w-full min-w-0 max-w-sm flex-col items-center gap-4 text-balance text-sm",
        className
      )}
      {...props}
    />
  )
}

/** Готовый блок «пустой список» для Чатов, Ленты, профиля — единый UIX. */
function ListEmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}) {
  return (
    <Empty
      className={cn("min-h-[200px] gap-[var(--uix-space-5)] p-[var(--uix-space-6)]", className)}
    >
      <EmptyHeader className="gap-[var(--uix-space-2)]">
        <EmptyMedia variant="icon">
          <Icon className="size-8 text-muted-foreground/60" />
        </EmptyMedia>
        <EmptyTitle className="text-[length:var(--uix-text-list-primary)] font-semibold text-foreground/90">
          {title}
        </EmptyTitle>
        <EmptyDescription className="text-[length:var(--uix-text-caption)]">
          {description}
        </EmptyDescription>
      </EmptyHeader>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="min-h-[var(--uix-touch-min)] px-[var(--uix-space-4)] py-2.5 rounded-lg bg-primary text-primary-foreground text-[length:var(--uix-text-list-secondary)] font-medium hover:opacity-90 active:scale-[0.98] transition-transform inline-flex items-center justify-center gap-2"
        >
          {actionLabel}
        </button>
      )}
    </Empty>
  );
}

/** Единый блок «ошибка загрузки»: иконка, текст, кнопка «Повторить». Для ленты, чатов и др. */
function ErrorWithRetry({
  title = "Не удалось загрузить",
  description = "Проверьте интернет и попробуйте снова",
  retryLabel = "Повторить",
  onRetry,
  className,
}: {
  title?: string;
  description?: string;
  retryLabel?: string;
  onRetry: () => void;
  className?: string;
}) {
  return (
    <Empty
      className={cn("min-h-[200px] gap-[var(--uix-space-5)] p-[var(--uix-space-6)]", className)}
    >
      <EmptyHeader className="gap-[var(--uix-space-2)]">
        <EmptyMedia variant="icon">
          <AlertCircle className="size-8 text-destructive/70" />
        </EmptyMedia>
        <EmptyTitle className="text-[length:var(--uix-text-list-primary)] font-semibold text-foreground/90">
          {title}
        </EmptyTitle>
        <EmptyDescription className="text-[length:var(--uix-text-caption)]">
          {description}
        </EmptyDescription>
      </EmptyHeader>
      <button
        type="button"
        onClick={onRetry}
        className="min-h-[var(--uix-touch-min)] px-[var(--uix-space-4)] py-2.5 rounded-lg bg-primary text-primary-foreground text-[length:var(--uix-text-list-secondary)] font-medium hover:opacity-90 active:scale-[0.98] transition-transform inline-flex items-center justify-center gap-2"
      >
        {retryLabel}
      </button>
    </Empty>
  );
}

export {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
  EmptyMedia,
  ListEmptyState,
  ErrorWithRetry,
}
