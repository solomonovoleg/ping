import { BriefcaseBusiness } from "lucide-react";

export function PulseBusinessBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-amber-300/50 bg-gradient-to-r from-amber-400/95 to-orange-400/95 text-white shadow-[0_2px_10px_rgba(245,158,11,0.32)]"
      style={{
        height: compact ? 18 : 22,
        paddingInline: compact ? 6 : 8,
      }}
      aria-label="Подтвержденный бизнес-профиль"
      title="Подтвержденный бизнес-профиль"
    >
      <BriefcaseBusiness
        style={{ width: compact ? 10 : 12, height: compact ? 10 : 12, flexShrink: 0 }}
        aria-hidden
      />
      <span
        style={{
          fontSize: compact ? 9.5 : 10.5,
          fontWeight: 800,
          letterSpacing: "0.02em",
          lineHeight: 1,
        }}
      >
        BUSINESS
      </span>
    </span>
  );
}
