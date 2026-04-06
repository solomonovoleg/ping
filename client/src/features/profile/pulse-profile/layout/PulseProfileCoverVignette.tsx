import { memo } from "react";

/** Лёгкое затемнение поверх обложки для читаемости кнопок. */
export const PulseProfileCoverVignette = memo(function PulseProfileCoverVignette() {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 top-0 z-[1]"
      style={{
        background:
          "linear-gradient(to bottom, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.06) 32%, rgba(0,0,0,0.22) 70%, rgba(0,0,0,0.45) 100%)",
      }}
      aria-hidden
    />
  );
});
