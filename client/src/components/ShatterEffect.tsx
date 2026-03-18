"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  DURATION_EMPHASIS_MS,
  DURATION_NORMAL_MS,
  EASING_OUT_EXPO,
  getPrefersReducedMotion,
} from "@/lib/motion";

/** Количество «пылинок» — много мелких частиц создают эффект рассыпания в пыль */
const DUST_COUNT = 72;

/** Насколько далеко разлетаются частицы (px) */
const SCATTER_DISTANCE = 90;

/** Небольшая случайность к расстоянию и углу */
function randomSpread() {
  return 0.7 + Math.random() * 0.6;
}

type ShatterEffectProps = {
  children?: React.ReactNode;
  onComplete: () => void;
  className?: string;
  shardClassName?: string;
};

/**
 * Эффект «рассыпания в пыль» при удалении (сообщение, пост).
 * Много мелких частиц разлетаются от центра и исчезают.
 * При prefers-reduced-motion — короткий fade без частиц.
 */
export function ShatterEffect({
  children,
  onComplete,
  className,
  shardClassName = "bg-background",
}: ShatterEffectProps) {
  const [reducedMotion] = useState(() =>
    typeof window !== "undefined" ? getPrefersReducedMotion() : false
  );

  const [particles] = useState(() => {
    const cols = 8;
    const rows = Math.ceil(DUST_COUNT / cols);
    return Array.from({ length: DUST_COUNT }, (_, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const centerX = (col + 0.5) / cols;
      const centerY = (row + 0.5) / rows;
      const dx = centerX - 0.5;
      const dy = centerY - 0.5;
      const dist = Math.hypot(dx, dy) || 0.3;
      const ndx = (dx / dist) * SCATTER_DISTANCE * randomSpread();
      const ndy = (dy / dist) * SCATTER_DISTANCE * randomSpread();
      const jitter = 15;
      const tx = ndx + (Math.random() - 0.5) * jitter;
      const ty = ndy + (Math.random() - 0.5) * jitter;
      const size = 3 + Math.floor(Math.random() * 3);
      const delayMs = Math.floor(Math.random() * 60);
      const leftPct = (col / (cols - 1 || 1)) * 100;
      const topPct = (row / (rows - 1 || 1)) * 100;
      return { tx, ty, size, delayMs, leftPct, topPct };
    });
  });

  const [fly, setFly] = useState(false);
  const completedRef = useRef(false);

  const durationMs = reducedMotion ? DURATION_NORMAL_MS : DURATION_EMPHASIS_MS + 120;

  useEffect(() => {
    const t = requestAnimationFrame(() => setFly(true));
    return () => cancelAnimationFrame(t);
  }, []);

  useEffect(() => {
    if (!fly) return;
    const id = setTimeout(() => {
      if (completedRef.current) return;
      completedRef.current = true;
      onComplete();
    }, durationMs);
    return () => clearTimeout(id);
  }, [fly, durationMs, onComplete]);

  if (reducedMotion) {
    return (
      <div className={cn("relative overflow-visible", className)}>
        {children}
        <div
          className={cn("absolute inset-0 pointer-events-none rounded-[inherit]", shardClassName)}
          aria-hidden
          style={{
            opacity: fly ? 0 : 1,
            transition: `opacity ${DURATION_NORMAL_MS}ms ${EASING_OUT_EXPO}`,
          }}
        />
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-visible", className)}>
      {children}
      <div
        className="absolute inset-0 pointer-events-none overflow-visible min-w-[1px] min-h-[1px] rounded-[inherit]"
        aria-hidden
      >
        {particles.map((p, i) => (
          <div
            key={i}
            className={cn(
              "absolute rounded-full",
              shardClassName
            )}
            style={{
              left: `${p.leftPct}%`,
              top: `${p.topPct}%`,
              width: p.size,
              height: p.size,
              marginLeft: -p.size / 2,
              marginTop: -p.size / 2,
              transformOrigin: "50% 50%",
              transform: fly
                ? `translate(${p.tx}px, ${p.ty}px) scale(0)`
                : "translate(0, 0) scale(1)",
              opacity: fly ? 0 : 0.9,
              transition: `transform ${DURATION_EMPHASIS_MS}ms ${EASING_OUT_EXPO}, opacity ${Math.round(DURATION_EMPHASIS_MS * 0.9)}ms ${EASING_OUT_EXPO}`,
              transitionDelay: `${p.delayMs}ms`,
              boxShadow: "0 0 1px 0 rgba(0,0,0,0.12)",
            }}
          />
        ))}
      </div>
    </div>
  );
}
