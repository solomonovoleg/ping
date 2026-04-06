import { memo } from "react";
import type { buildPulseProfileTheme } from "../pulse-profile-theme";
import { PULSE_PROFILE_TAB_ITEMS } from "./pulse-profile-tabs-config";
import { PulseProfileTabChip } from "./PulseProfileTabChip";
import type { PulseProfileTabKey } from "./types";

type Th = ReturnType<typeof buildPulseProfileTheme>;

type Props = {
  activeTab: PulseProfileTabKey;
  onTabChange: (t: PulseProfileTabKey) => void;
  th: Th;
};

export const PulseProfileTabsList = memo(function PulseProfileTabsList({ activeTab, onTabChange, th }: Props) {
  return (
    <div className="flex min-w-0 flex-1 flex-nowrap gap-1.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {PULSE_PROFILE_TAB_ITEMS.map(({ key, Icon, label }) => (
        <PulseProfileTabChip
          key={key}
          Icon={Icon}
          label={label}
          active={activeTab === key}
          onSelect={() => onTabChange(key)}
          tabActive={th.tabActive}
          tabBorder={th.tabBorder}
          accent={th.accent}
          text={th.text}
        />
      ))}
    </div>
  );
});
