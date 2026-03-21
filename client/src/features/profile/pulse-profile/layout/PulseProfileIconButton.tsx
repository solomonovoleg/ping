import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePulseProfileTheme } from "../pulse-profile-theme";

/** Для кнопок «Редактировать / аналитика / поделиться» в стиле макета */
export function PulseProfileIconButton({
  icon: Icon,
  label,
  onClick,
  variant = "surface",
  className,
}: {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  variant?: "primary" | "surface";
  className?: string;
}) {
  const { th } = usePulseProfileTheme();
  const primary = variant === "primary";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "flex items-center justify-center rounded-2xl transition-all active:scale-[0.97] min-h-[var(--uix-touch-min)]",
        primary ? "flex-1 gap-2 px-3" : "w-11 shrink-0",
        className
      )}
      style={{
        height: 40,
        background: primary
          ? `linear-gradient(135deg, ${th.accent} 0%, #7c3aed 52%, #a855f7 100%)`
          : th.surface,
        border: primary ? "1px solid rgba(255,255,255,0.14)" : `1px solid ${th.border}`,
        boxShadow: primary ? `0 4px 18px ${th.accent}55, inset 0 1px 0 rgba(255,255,255,0.12)` : undefined,
      }}
      aria-label={label}
    >
      <Icon
        style={{
          width: primary ? 13 : 15,
          height: primary ? 13 : 15,
          color: primary ? "rgba(255,255,255,0.95)" : th.textSub,
        }}
      />
      {primary ? (
        <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.98)" }}>{label}</span>
      ) : null}
    </button>
  );
}
