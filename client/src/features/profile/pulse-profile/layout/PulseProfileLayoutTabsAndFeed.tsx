import { memo, type ReactNode } from "react";
import { PulseProfileTabsRow } from "./PulseProfileTabsRow";
import type { PulseProfileTabKey } from "./types";

type Props = {
  postBorder: string;
  activeTab: PulseProfileTabKey;
  onTabChange: (t: PulseProfileTabKey) => void;
  postView: "list" | "grid";
  onTogglePostView: () => void;
  addContentStrip: ReactNode | null | undefined;
  postsContent: ReactNode;
};

export const PulseProfileLayoutTabsAndFeed = memo(function PulseProfileLayoutTabsAndFeed({
  postBorder,
  activeTab,
  onTabChange,
  postView,
  onTogglePostView,
  addContentStrip,
  postsContent,
}: Props) {
  return (
    <>
      <div className="mt-4 px-4">
        <div
          className="h-px w-full"
          style={{
            background: `linear-gradient(90deg, transparent 0%, ${postBorder} 12%, ${postBorder} 88%, transparent 100%)`,
          }}
          aria-hidden
        />
      </div>
      <PulseProfileTabsRow
        activeTab={activeTab}
        onTabChange={onTabChange}
        postView={postView}
        onTogglePostView={onTogglePostView}
      />

      {addContentStrip ? <div className="mx-4 mt-3 mb-1">{addContentStrip}</div> : null}

      <div className="mt-3" style={{ borderTop: `1px solid ${postBorder}` }}>
        {postsContent}
      </div>
    </>
  );
});
