import type { ReactNode } from "react";
import { Plus } from "lucide-react";
import { usePulseProfileTheme } from "../pulse-profile-theme";

/** Плитка «ЗАКРЕПЛЁННОЕ» как в `pulse-profile-export`. */
export function PulseProfileHighlightTile({
  label,
  emoji,
  hasContent,
  onClick,
  children,
}: {
  label: string;
  emoji: string;
  hasContent: boolean;
  onClick?: () => void;
  children?: ReactNode;
}) {
  const { th, isDark } = usePulseProfileTheme();
  const body = (
    <div
      className="relative rounded-2xl overflow-hidden flex items-center justify-center"
      style={{
        width: 60,
        height: 60,
        background: isDark ? "rgba(255,255,255,0.07)" : "#ffffff",
        border: `1.5px solid ${th.border}`,
      }}
    >
      {hasContent ? (
        (children ?? <span style={{ fontSize: 26 }}>{emoji}</span>)
      ) : (
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: `${th.accent}20`, border: `1.5px dashed ${th.accent}60` }}
        >
          <Plus style={{ width: 15, height: 15, color: th.accent }} />
        </div>
      )}
    </div>
  );
  const caption = (
    <span style={{ fontSize: 10, color: th.textSub, fontWeight: 500 }}>{label || "Новое"}</span>
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="flex flex-col items-center gap-1.5 min-w-[4rem] shrink-0">
        {body}
        {caption}
      </button>
    );
  }
  return (
    <div className="flex flex-col items-center gap-1.5 min-w-[4rem] shrink-0">
      {body}
      {caption}
    </div>
  );
}
