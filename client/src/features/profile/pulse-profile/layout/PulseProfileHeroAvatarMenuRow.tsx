import { memo } from "react";
import type { buildPulseProfileTheme } from "../pulse-profile-theme";

type Th = ReturnType<typeof buildPulseProfileTheme>;

type Props = {
  open: boolean;
  items: { label: string; onClick: () => void }[];
  onOpenChange: (open: boolean) => void;
  nameSep: string;
  statSep: string;
  th: Th;
};

export const PulseProfileHeroAvatarMenuRow = memo(function PulseProfileHeroAvatarMenuRow({
  open,
  items,
  onOpenChange,
  nameSep,
  statSep,
  th,
}: Props) {
  if (!open || items.length === 0) return null;
  return (
    <div
      className="mt-3 flex flex-row flex-nowrap items-stretch border-t pt-3"
      style={{ borderColor: nameSep }}
      role="menu"
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          onClick={() => {
            onOpenChange(false);
            item.onClick();
          }}
          className="min-h-[var(--uix-touch-min)] min-w-0 flex-1 basis-0 border-l px-1 py-2 text-center text-[11px] font-semibold leading-[1.2] transition-opacity first:border-l-0 active:opacity-75"
          style={{
            color: th.text,
            borderColor: statSep,
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
});
