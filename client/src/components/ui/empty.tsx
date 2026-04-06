"use client";

import { AlertCircle } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { TapScaleButton } from "@/components/ui/tap-scale";

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

/** Поверхность для Reels / полноэкранного видео: чёрный фон, светлый текст (WCAG на чёрном). */
type ListEmptySurface = "default" | "darkVideo";

/** Готовый блок «пустой список» для Чатов, Ленты, профиля — единый UIX. */
function ListEmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  className,
  surface = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  className?: string;
  surface?: ListEmptySurface;
}) {
  const hasPrimary = Boolean(actionLabel && onAction);
  const hasSecondary = Boolean(secondaryActionLabel && onSecondaryAction);
  const onDark = surface === "darkVideo";
  return (
    <Empty
      className={cn(
        "min-h-[200px] gap-[var(--uix-space-5)] p-[var(--uix-space-6)]",
        onDark && "border border-dashed border-white/20 text-white",
        className,
      )}
    >
      <EmptyHeader className="gap-[var(--uix-space-2)]">
        <EmptyMedia
          variant="icon"
          className={cn(onDark && "border-0 bg-white/15 text-white [&_svg]:text-white")}
        >
          <Icon
            className={cn("size-8", onDark ? "text-white/85" : "text-muted-foreground/60")}
          />
        </EmptyMedia>
        <EmptyTitle
          className={cn(
            "text-[length:var(--uix-text-list-primary)] font-semibold",
            onDark ? "text-white" : "text-foreground/90",
          )}
        >
          {title}
        </EmptyTitle>
        <EmptyDescription
          className={cn(
            "text-[length:var(--uix-text-caption)]",
            onDark && "text-white/80 [&>a:hover]:text-sky-200 [&>a]:text-sky-300",
          )}
        >
          {description}
        </EmptyDescription>
      </EmptyHeader>
      {(hasPrimary || hasSecondary) && (
        <div className="flex w-full max-w-sm flex-col items-stretch gap-2 sm:flex-row sm:justify-center">
          {hasPrimary && (
            <TapScaleButton
              type="button"
              haptic
              onClick={onAction}
              className="min-h-[var(--uix-touch-min)] px-[var(--uix-space-4)] py-2.5 rounded-lg bg-primary text-primary-foreground text-[length:var(--uix-text-list-secondary)] font-medium hover:opacity-90 inline-flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {actionLabel}
            </TapScaleButton>
          )}
          {hasSecondary && (
            <TapScaleButton
              type="button"
              haptic
              onClick={onSecondaryAction}
              className={cn(
                "min-h-[var(--uix-touch-min)] px-[var(--uix-space-4)] py-2.5 rounded-lg border text-[length:var(--uix-text-list-secondary)] font-medium inline-flex items-center justify-center gap-2 disabled:opacity-50",
                onDark
                  ? "border-white/35 bg-white/10 text-white hover:bg-white/15"
                  : "border-border bg-secondary/80 text-foreground hover:bg-secondary",
              )}
            >
              {secondaryActionLabel}
            </TapScaleButton>
          )}
        </div>
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
  surface = "default",
}: {
  title?: string;
  description?: string;
  retryLabel?: string;
  onRetry: () => void;
  className?: string;
  surface?: ListEmptySurface;
}) {
  const onDark = surface === "darkVideo";
  return (
    <Empty
      className={cn(
        "min-h-[200px] gap-[var(--uix-space-5)] p-[var(--uix-space-6)]",
        onDark && "border border-dashed border-white/20 text-white",
        className,
      )}
    >
      <EmptyHeader className="gap-[var(--uix-space-2)]">
        <EmptyMedia
          variant="icon"
          className={cn(onDark && "border-0 bg-white/15 text-white")}
        >
          <AlertCircle
            className={cn("size-8", onDark ? "text-rose-300" : "text-destructive/70")}
          />
        </EmptyMedia>
        <EmptyTitle
          className={cn(
            "text-[length:var(--uix-text-list-primary)] font-semibold",
            onDark ? "text-white" : "text-foreground/90",
          )}
        >
          {title}
        </EmptyTitle>
        <EmptyDescription
          className={cn(
            "text-[length:var(--uix-text-caption)]",
            onDark && "text-white/80",
          )}
        >
          {description}
        </EmptyDescription>
      </EmptyHeader>
      <TapScaleButton
        type="button"
        haptic
        onClick={onRetry}
        className="min-h-[var(--uix-touch-min)] px-[var(--uix-space-4)] py-2.5 rounded-lg bg-primary text-primary-foreground text-[length:var(--uix-text-list-secondary)] font-medium hover:opacity-90 inline-flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {retryLabel}
      </TapScaleButton>
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
