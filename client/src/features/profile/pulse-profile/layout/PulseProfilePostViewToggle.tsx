import { memo } from "react";
import { Grid3x3, List } from "lucide-react";

type Props = {
  postView: "list" | "grid";
  onToggle: () => void;
  tabActive: string;
  tabBorder: string;
  border: string;
  accent: string;
  text: string;
};

export const PulseProfilePostViewToggle = memo(function PulseProfilePostViewToggle({
  postView,
  onToggle,
  tabActive,
  tabBorder,
  border,
  accent,
  text,
}: Props) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex shrink-0 min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] items-center justify-center rounded-xl transition-all active:scale-90"
      style={{
        width: 34,
        height: 34,
        background: postView === "grid" ? tabActive : "transparent",
        border: `1px solid ${postView === "grid" ? tabBorder : border}`,
      }}
      aria-label={postView === "grid" ? "Показать списком" : "Показать сеткой"}
    >
      {postView === "grid" ? (
        <Grid3x3 style={{ width: 14, height: 14, color: accent }} aria-hidden />
      ) : (
        <List style={{ width: 14, height: 14, color: text }} aria-hidden />
      )}
    </button>
  );
});
