import { usePulseProfileTheme } from "../pulse-profile-theme";
import { TEMPLATE_HIGHLIGHTS } from "./constants";
import { PulseProfileHighlightTile } from "./PulseProfileHighlightTile";

export function PulseProfilePinnedStrip({ onHighlightNew }: { onHighlightNew?: () => void }) {
  const { th } = usePulseProfileTheme();
  return (
    <div className="mt-6">
      <div className="mb-3 flex items-center gap-2 px-4">
        <div style={{ width: 3, height: 12, borderRadius: 2, background: th.accent }} aria-hidden />
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: th.textSub,
            letterSpacing: "0.07em",
          }}
        >
          ЗАКРЕПЛЁННОЕ
        </span>
      </div>
      <div className="flex gap-3 px-4 overflow-x-auto hide-scrollbar pb-1">
        {TEMPLATE_HIGHLIGHTS.map((h) => (
          <PulseProfileHighlightTile key={h.label} label={h.label} emoji={h.emoji} hasContent={h.hasContent} />
        ))}
        <PulseProfileHighlightTile label="Новое" emoji="" hasContent={false} onClick={onHighlightNew} />
      </div>
    </div>
  );
}
