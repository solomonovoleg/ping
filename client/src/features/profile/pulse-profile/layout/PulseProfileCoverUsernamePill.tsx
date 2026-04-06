import { memo } from "react";
import { AtSign } from "lucide-react";

const pillChrome = {
  background: "rgba(0,0,0,0.48)",
  backdropFilter: "blur(20px)",
  border: "1px solid rgba(255,255,255,0.12)",
  boxShadow: "0 2px 20px rgba(0,0,0,0.45)",
} as const;

type Props = {
  usernamePill: string;
  onUsernamePillPress?: () => void;
};

export const PulseProfileCoverUsernamePill = memo(function PulseProfileCoverUsernamePill({
  usernamePill,
  onUsernamePillPress,
}: Props) {
  const label = (
    <>
      <AtSign style={{ width: 11, height: 11, color: "rgba(255,255,255,0.5)" }} aria-hidden />
      <span
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: "rgba(255,255,255,0.88)",
          letterSpacing: "0.01em",
        }}
      >
        {usernamePill}
      </span>
    </>
  );

  return (
    <div
      className="pointer-events-none absolute left-0 right-0 z-20 flex justify-center"
      style={{ top: 5 }}
    >
      {onUsernamePillPress ? (
        <button
          type="button"
          onClick={onUsernamePillPress}
          className="pointer-events-auto flex min-h-[var(--uix-touch-min)] items-center gap-1.5 rounded-full px-3.5 py-1.5 transition-opacity active:opacity-80"
          style={pillChrome}
          aria-label="Скопировать ссылку на профиль"
        >
          {label}
        </button>
      ) : (
        <div
          className="pointer-events-none flex items-center gap-1.5 rounded-full px-3.5 py-1.5"
          style={pillChrome}
        >
          {label}
        </div>
      )}
    </div>
  );
});
