import { Plus } from "lucide-react";
import { usePulseProfileTheme } from "../pulse-profile-theme";

/** Кнопка «Добавить контент» под вкладками (макет PULSE / MobileProfile). */
export function PulseProfileAddContentStrip({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  const { th, isDark } = usePulseProfileTheme();
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex w-full min-h-[var(--uix-touch-min)] items-center gap-3 rounded-2xl px-4 transition-all active:scale-[0.98] disabled:opacity-60"
      style={{
        height: 42,
        border: `1.5px dashed ${isDark ? "rgba(255,255,255,0.13)" : "rgba(99,102,241,0.22)"}`,
        background: isDark ? "rgba(255,255,255,0.025)" : "rgba(99,102,241,0.03)",
      }}
      aria-label="Добавить контент"
    >
      <div
        className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg"
        style={{ background: `${th.accent}22` }}
      >
        <Plus style={{ width: 12, height: 12, color: th.accent, strokeWidth: 2.5 }} aria-hidden />
      </div>
      <span style={{ fontSize: 13.5, fontWeight: 500, color: th.textFaint }}>Добавить контент</span>
    </button>
  );
}
