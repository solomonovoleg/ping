import { usePulseProfileTheme } from "../pulse-profile-theme";
import { useCountUp } from "./useCountUp";

export function StatCounter({
  target,
  label,
  onClick,
  compact,
}: {
  target: number;
  label: string;
  onClick?: () => void;
  compact?: boolean;
}) {
  const { th } = usePulseProfileTheme();
  const count = useCountUp(target, 850);
  const inner = (
    <>
      <span
        style={{
          fontSize: compact ? 15 : 21,
          fontWeight: 800,
          color: th.text,
          lineHeight: 1,
          letterSpacing: "-0.03em",
        }}
      >
        {count}
      </span>
      <span
        style={{
          fontSize: compact ? 9 : 10.5,
          color: th.textFaint,
          fontWeight: 500,
          marginTop: compact ? 1 : 2,
        }}
      >
        {label}
      </span>
    </>
  );
  const padClass = compact ? "py-1.5" : "py-2";
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`flex min-h-[var(--uix-touch-min)] min-w-0 flex-1 cursor-pointer flex-col items-center justify-center ${padClass} active:opacity-90`}
      >
        {inner}
      </button>
    );
  }
  return (
    <div className={`pointer-events-none flex min-w-0 flex-1 flex-col items-center justify-center ${padClass}`}>
      {inner}
    </div>
  );
}
