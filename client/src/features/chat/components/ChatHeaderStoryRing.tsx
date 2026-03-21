import { usePrefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

type Props = {
  children: React.ReactNode;
  /** Акцент настроения (PULSE) или индиго по умолчанию */
  accentColor: string;
  className?: string;
  /** Зазор между внешним кольцом и аватаром (в макете PULSE тёмный — #080810) */
  ringGapClassName?: string;
};

/**
 * Трёхслойное кольцо вокруг аватара в шапке чата (как PULSE story ring).
 */
export function ChatHeaderStoryRing({ children, accentColor, className, ringGapClassName }: Props) {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <div className={cn("relative flex shrink-0 items-center justify-center", className)}>
      <div
        className="pointer-events-none absolute rounded-full"
        style={{
          inset: -3,
          background: "conic-gradient(from 0deg, #818cf8, #c084fc, #f472b6, #38bdf8, #818cf8)",
          animation: reducedMotion ? undefined : "chatStoryRingSpin 3s linear infinite",
        }}
        aria-hidden
      />
      <div
        className={cn("pointer-events-none absolute rounded-full bg-background", ringGapClassName)}
        style={{ inset: -1 }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute rounded-full"
        style={{
          inset: 0,
          boxShadow: `0 0 0 2px ${accentColor}`,
        }}
        aria-hidden
      />
      <div className="relative z-[1] overflow-hidden rounded-full">{children}</div>
      <style>{`
        @keyframes chatStoryRingSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
