"use client";

import { forwardRef } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion, SPRING_TAP } from "@/lib/motion";
import { triggerTapFeedback } from "@/lib/micro-feedback";

const TAP_SCALE = 0.97;
const TAP_SCALE_SUBTLE = 0.99;

export interface TapScaleProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Лёгкий хаптик (нативно) + микро-звук (веб) при тапе */
  haptic?: boolean;
  /** Более мягкий scale (для строк списка) */
  subtle?: boolean;
}

/**
 * Кнопка с премиальным откликом: мягкий spring-scale + микро-хаптик/звук.
 * Учитывает prefers-reduced-motion.
 */
const TapScaleButton = forwardRef<HTMLButtonElement, TapScaleProps>(
  ({ haptic = false, subtle = false, className, onClick, children, ...rest }, ref) => {
    const reduced = usePrefersReducedMotion();
    const scale = subtle ? TAP_SCALE_SUBTLE : TAP_SCALE;

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (haptic) triggerTapFeedback({ haptic: true, sound: true });
      onClick?.(e);
    };

    if (reduced) {
      return (
        <button ref={ref} className={cn(className)} onClick={handleClick} {...rest}>
          {children}
        </button>
      );
    }

    return (
      <motion.button
        ref={ref as React.Ref<HTMLButtonElement>}
        className={cn(className)}
        whileTap={{ scale }}
        transition={SPRING_TAP}
        onClick={handleClick}
        {...(rest as React.ComponentProps<typeof motion.button>)}
      >
        {children}
      </motion.button>
    );
  }
);

TapScaleButton.displayName = "TapScaleButton";

export { TapScaleButton };

export interface TapScaleDivProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Более мягкий scale (по умолчанию) для строк списка */
  subtle?: boolean;
}

/**
 * div с откликом на тап (для строк списка — чаты, посты).
 * Только визуальный scale, без хапика (хаптик на действие внутри).
 */
const TapScaleDiv = forwardRef<HTMLDivElement, TapScaleDivProps>(
  ({ subtle = true, className, onClick, children, ...rest }, ref) => {
    const reduced = usePrefersReducedMotion();
    const scale = subtle ? TAP_SCALE_SUBTLE : TAP_SCALE;

    if (reduced) {
      return (
        <div ref={ref} className={cn(className)} onClick={onClick} role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined} onKeyDown={onClick ? (e) => e.key === "Enter" && onClick(e as unknown as React.MouseEvent<HTMLDivElement>) : undefined} {...rest}>
          {children}
        </div>
      );
    }

    return (
      <motion.div
        ref={ref as React.Ref<HTMLDivElement>}
        className={cn(className)}
        whileTap={{ scale }}
        transition={SPRING_TAP}
        onClick={onClick}
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={onClick ? (e) => e.key === "Enter" && onClick(e as unknown as React.MouseEvent<HTMLDivElement>) : undefined}
        {...(rest as React.ComponentProps<typeof motion.div>)}
      >
        {children}
      </motion.div>
    );
  }
);

TapScaleDiv.displayName = "TapScaleDiv";

export { TapScaleDiv };

export interface TapScaleAProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  /** Более мягкий scale (по умолчанию) для строк списка */
  subtle?: boolean;
}

/** Ссылка с тем же spring-scale, что у строк списка (внешние URL, mailto). */
const TapScaleA = forwardRef<HTMLAnchorElement, TapScaleAProps>(
  ({ subtle = true, className, children, ...rest }, ref) => {
    const reduced = usePrefersReducedMotion();
    const scale = subtle ? TAP_SCALE_SUBTLE : TAP_SCALE;

    if (reduced) {
      return (
        <a ref={ref} className={cn(className)} {...rest}>
          {children}
        </a>
      );
    }

    return (
      <motion.a
        ref={ref as React.Ref<HTMLAnchorElement>}
        className={cn(className)}
        whileTap={{ scale }}
        transition={SPRING_TAP}
        {...(rest as React.ComponentProps<typeof motion.a>)}
      >
        {children}
      </motion.a>
    );
  }
);

TapScaleA.displayName = "TapScaleA";

export { TapScaleA };
