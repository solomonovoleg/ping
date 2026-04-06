"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { DURATION_NORMAL_S, EASING_OUT_BEZIER, usePrefersReducedMotion } from "@/lib/motion";

type Props = {
  children: ReactNode;
  className?: string;
};

/**
 * Разовое появление карточки EDGE при первом попадании во вьюпорт ленты.
 * Не влияет на логику игры; при reduced motion — обычный div.
 */
export function EdgeFeedCardEntrance({ children, className }: Props) {
  const reduced = usePrefersReducedMotion();
  if (reduced) {
    return (
      <motion.div
        className={className}
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, amount: 0.08 }}
        transition={{ duration: DURATION_NORMAL_S * 0.55, ease: EASING_OUT_BEZIER }}
      >
        {children}
      </motion.div>
    );
  }
  return (
    <motion.div
      className={cn(className)}
      initial={{ opacity: 0, y: 14, scale: 0.985, filter: "blur(1.8px)" }}
      whileInView={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: DURATION_NORMAL_S * 1.08, ease: EASING_OUT_BEZIER }}
    >
      {children}
    </motion.div>
  );
}
