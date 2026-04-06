import { memo } from "react";
import type { LucideIcon } from "lucide-react";

type Props = {
  Icon: LucideIcon;
  label: string;
  active: boolean;
  onSelect: () => void;
  tabActive: string;
  tabBorder: string;
  accent: string;
  text: string;
};

export const PulseProfileTabChip = memo(function PulseProfileTabChip({
  Icon,
  label,
  active,
  onSelect,
  tabActive,
  tabBorder,
  accent,
  text,
}: Props) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex shrink-0 min-h-[var(--uix-touch-min)] items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 transition-all"
      style={
        active
          ? { background: tabActive, border: `1px solid ${tabBorder}`, color: accent }
          : { background: "transparent", border: "1px solid transparent", color: text }
      }
    >
      <Icon style={{ width: 13, height: 13 }} aria-hidden />
      <span style={{ fontSize: 12, fontWeight: active ? 600 : 500 }}>{label}</span>
    </button>
  );
});
