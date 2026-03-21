import { Bookmark, Grid3x3, List, Tag } from "lucide-react";
import { usePulseProfileTheme } from "../pulse-profile-theme";
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
    <div className="flex items-center mt-5 px-4 gap-1.5">
      <div className="flex gap-1.5 flex-1 min-w-0 flex-wrap">
        {(
          [
            { key: "posts" as const, Icon: Grid3x3, label: "Посты" },
            { key: "saved" as const, Icon: Bookmark, label: "Сохранено" },
            { key: "tagged" as const, Icon: Tag, label: "Отметки" },
          ] as const
        ).map(({ key, Icon, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => onTabChange(key)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all min-h-[var(--uix-touch-min)]"
            style={
              activeTab === key
                ? { background: th.tabActive, border: `1px solid ${th.tabBorder}`, color: th.accent }
                : { background: "transparent", border: "1px solid transparent", color: th.text }
            }
          >
            <Icon style={{ width: 13, height: 13 }} aria-hidden />
            <span style={{ fontSize: 12, fontWeight: activeTab === key ? 600 : 500 }}>{label}</span>
          </button>
        ))}
      </div>
      {activeTab === "posts" ? (
        <button
          type="button"
          onClick={onTogglePostView}
          className="flex min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] items-center justify-center rounded-xl transition-all active:scale-90"
          style={{
            width: 34,
            height: 34,
            background: postView === "grid" ? th.tabActive : "transparent",
            border: `1px solid ${postView === "grid" ? th.tabBorder : th.border}`,
          }}
          aria-label={postView === "grid" ? "Показать списком" : "Показать сеткой"}
        >
          {postView === "grid" ? (
            <Grid3x3 style={{ width: 14, height: 14, color: th.accent }} aria-hidden />
          ) : (
            <List style={{ width: 14, height: 14, color: th.text }} aria-hidden />
          )}
        </button>
      ) : null}
    </div>
  );
}
