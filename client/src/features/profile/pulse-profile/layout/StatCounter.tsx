import { usePulseProfileTheme } from "../pulse-profile-theme";
import { PulseStatCounterFigures } from "./PulseStatCounterFigures";
import { PulseStatCounterSurface } from "./PulseStatCounterSurface";
import { useCountUp } from "./useCountUp";

const STAT_COUNTER_MS = 850;

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
  const count = useCountUp(target, STAT_COUNTER_MS);
  return (
    <PulseStatCounterSurface onClick={onClick} compact={compact}>
      <PulseStatCounterFigures count={count} label={label} compact={compact} textColor={th.text} />
    </PulseStatCounterSurface>
  );
}
