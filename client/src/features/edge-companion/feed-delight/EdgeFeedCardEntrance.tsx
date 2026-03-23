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
    return <div className={className}>{children}</div>;
  }
  return (
    <motion.div
      className={cn(className)}
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: DURATION_NORMAL_S, ease: EASING_OUT_BEZIER }}
    >
      {children}
    </motion.div>
  );
}
