import { memo, type ReactNode } from "react";

type Props = {
  compact?: boolean;
  onClick?: () => void;
  children: ReactNode;
};

export const PulseStatCounterSurface = memo(function PulseStatCounterSurface({
  compact,
  onClick,
  children,
}: Props) {
  const padClass = compact ? "py-1.5" : "py-2";
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`flex min-h-[var(--uix-touch-min)] min-w-0 flex-1 cursor-pointer flex-col items-center justify-center ${padClass} active:opacity-90`}
      >
        {children}
      </button>
    );
  }
  return (
    <div
      className={`pointer-events-none flex min-w-0 flex-1 flex-col items-center justify-center ${padClass}`}
    >
      {children}
    </div>
  );
});
