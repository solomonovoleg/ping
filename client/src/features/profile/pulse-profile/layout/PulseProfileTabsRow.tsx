import { usePulseProfileTheme } from "../pulse-profile-theme";
import { PulseProfilePostViewToggle } from "./PulseProfilePostViewToggle";
import { PulseProfileTabsList } from "./PulseProfileTabsList";
import type { PulseProfileTabKey } from "./types";

export function PulseProfileTabsRow({
  activeTab,
  onTabChange,
  postView,
  onTogglePostView,
}: {
  activeTab: PulseProfileTabKey;
  onTabChange: (t: PulseProfileTabKey) => void;
  postView: "list" | "grid";
  onTogglePostView: () => void;
}) {
  const { th } = usePulseProfileTheme();
  return (
    <div className="mt-5 flex min-w-0 flex-nowrap items-center gap-1.5 px-4">
      <PulseProfileTabsList activeTab={activeTab} onTabChange={onTabChange} th={th} />
      {activeTab === "posts" ? (
        <PulseProfilePostViewToggle
          postView={postView}
          onToggle={onTogglePostView}
          tabActive={th.tabActive}
          tabBorder={th.tabBorder}
          border={th.border}
          accent={th.accent}
          text={th.text}
        />
      ) : null}
    </div>
  );
}
