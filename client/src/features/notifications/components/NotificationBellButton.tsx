import { Bell } from "lucide-react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { usePrefersReducedMotion } from "@/lib/motion";
import { useUnreadNotifications } from "@/features/notifications/hooks/useUnreadNotifications";

type NotificationBellButtonProps = {
  className?: string;
};

function countLabel(unreadCount: number): string {
  if (unreadCount <= 0) return "";
  if (unreadCount > 99) return "99+";
  return String(unreadCount);
}

export function NotificationBellButton({ className }: NotificationBellButtonProps) {
  const [, setLocation] = useLocation();
  const reduceMotion = usePrefersReducedMotion();
  const { unreadCount, hasUnread, pulseDurationMs, isError, refetch } = useUnreadNotifications();

  return (
    <TapScaleButton
      type="button"
      haptic
      subtle
      className={cn(
        "relative inline-flex min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] items-center justify-center rounded-full border border-border/60 bg-secondary/40 p-2 text-foreground transition-colors hover:bg-secondary/70",
        className
      )}
      onClick={() => setLocation("/notifications")}
      aria-label={hasUnread ? `Уведомления: ${unreadCount} непрочитанных` : "Уведомления"}
      title={hasUnread ? `Непрочитанные: ${unreadCount}` : "Уведомления"}
    >
      {hasUnread && !reduceMotion && (
        <span
          className="pointer-events-none absolute inset-0 rounded-full border border-primary/40"
          style={{
            animationName: "notification-bell-pulse",
            animationDuration: `${pulseDurationMs}ms`,
            animationIterationCount: "infinite",
            animationTimingFunction: "ease-out",
          }}
          aria-hidden
        />
      )}

      <Bell className={cn("h-5 w-5", hasUnread && "text-primary")} />

      {hasUnread && (
        <span className="absolute -right-1 -top-1 inline-flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground shadow-sm">
          {countLabel(unreadCount)}
        </span>
      )}

      {isError && (
        <span
          className="absolute -bottom-1 -left-1 inline-flex h-2.5 w-2.5 rounded-full bg-destructive"
          aria-hidden
          onClick={(e) => {
            e.stopPropagation();
            refetch().catch(() => {});
          }}
        />
      )}

      {!reduceMotion && (
        <style>{`
          @keyframes notification-bell-pulse {
            0% {
              transform: scale(1);
              opacity: 0.45;
            }
            70% {
              transform: scale(1.18);
              opacity: 0;
            }
            100% {
              transform: scale(1.18);
              opacity: 0;
            }
          }
        `}</style>
      )}
    </TapScaleButton>
  );
}

