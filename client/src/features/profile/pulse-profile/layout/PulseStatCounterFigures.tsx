import { memo } from "react";

type Props = {
  count: number;
  label: string;
  compact?: boolean;
  textColor: string;
};

export const PulseStatCounterFigures = memo(function PulseStatCounterFigures({
  count,
  label,
  compact,
  textColor,
}: Props) {
  return (
    <>
      <span
        style={{
          fontSize: compact ? 15 : 21,
          fontWeight: 800,
          color: textColor,
          lineHeight: 1,
          letterSpacing: "-0.03em",
        }}
      >
        {count}
      </span>
      <span
        style={{
          fontSize: compact ? 9 : 10.5,
          color: textColor,
          fontWeight: 400,
          marginTop: compact ? 1 : 2,
        }}
      >
        {label}
      </span>
    </>
  );
});
