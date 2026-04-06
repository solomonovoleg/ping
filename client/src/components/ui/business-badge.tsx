import { BriefcaseBusiness } from "lucide-react";
import { cn } from "@/lib/utils";

export function BusinessBadge({
  className,
  compact = true,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-[0_2px_8px_rgba(245,158,11,0.28)]",
        className,
      )}
      style={{
        height: compact ? 18 : 22,
        paddingInline: compact ? 6 : 8,
      }}
      title="Подтвержденный бизнес-профиль"
      aria-label="Подтвержденный бизнес-профиль"
    >
      <BriefcaseBusiness style={{ width: compact ? 10 : 12, height: compact ? 10 : 12 }} aria-hidden />
      <span style={{ fontSize: compact ? 9 : 10.5, fontWeight: 800, letterSpacing: "0.02em", lineHeight: 1 }}>
        BUSINESS
      </span>
    </span>
  );
}
