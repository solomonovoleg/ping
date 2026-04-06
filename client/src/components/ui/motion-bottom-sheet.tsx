import {
  createContext,
  useCallback,
  useContext,
  useRef,
  forwardRef,
  type ReactNode,
  type PointerEvent,
  type ComponentPropsWithoutRef,
} from "react";
import { motion, useDragControls, type HTMLMotionProps } from "framer-motion";
import type { DragControls } from "framer-motion";
import { cn } from "@/lib/utils";
import { DURATION_NORMAL_S, EASING_OUT_BEZIER } from "@/lib/motion";

const DEFAULT_DISMISS_DISTANCE_PX = 96;
const DEFAULT_DISMISS_VELOCITY = 420;
const SCROLL_TOP_EPS_PX = 2;
const BODY_DRAG_DISTANCE_THRESHOLD_PX = 14;

type MotionSheetContextValue = {
  dragControls: DragControls;
  dragEnabled: boolean;
};

const MotionSheetContext = createContext<MotionSheetContextValue | null>(null);

function isInteractiveSheetTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      "button,a,input,textarea,select,label,[role='button'],[contenteditable='true'],[data-sheet-no-drag]"
    )
  );
}

export type MotionBottomSheetPanelProps = {
  /** Верхняя зона: отсюда начинается drag вниз (не перехватывает скролл списка ниже). */
  dragHandle: ReactNode;
  children: ReactNode;
  onDismiss: () => void;
  /** Например при prefers-reduced-motion — закрытие только по тапу на фон/кнопки. */
  disableSwipeDismiss?: boolean;
  /** Не задавать `animate` (панель уже в конечной позиции, только initial/exit). */
  omitAnimate?: boolean;
  dismissDistancePx?: number;
  dismissVelocity?: number;
} & Omit<HTMLMotionProps<"div">, "children">;

/**
 * Нижняя шторка с жестом «смахнуть вниз» (как у нативного sheet).
 * Ручка/шапка — в `dragHandle`; основной контент оборачивайте в {@link MotionBottomSheetScrollArea},
 * чтобы свайп работал с области списка, пока прокрутка у верха.
 */
export const MotionBottomSheetPanel = forwardRef<HTMLDivElement, MotionBottomSheetPanelProps>(
  function MotionBottomSheetPanel(
    {
      dragHandle,
      children,
      onDismiss,
      disableSwipeDismiss = false,
      omitAnimate = false,
      dismissDistancePx = DEFAULT_DISMISS_DISTANCE_PX,
      dismissVelocity = DEFAULT_DISMISS_VELOCITY,
      className,
      initial,
      animate,
      exit,
      transition,
      ...motionProps
    },
    ref
  ) {
    const dragControls = useDragControls();
    const dragEnabled = !disableSwipeDismiss;

    const defaultInitial = { y: "100%" };
    const defaultAnimate = { y: 0 };
    const defaultExit = { y: "100%" };
    const defaultTransition = {
      duration: DURATION_NORMAL_S,
      ease: EASING_OUT_BEZIER,
    };

    const resolvedAnimate = omitAnimate
      ? animate !== undefined
        ? animate
        : undefined
      : (animate ?? defaultAnimate);

    const ctxValue = dragEnabled ? { dragControls, dragEnabled: true } : null;

    return (
      <MotionSheetContext.Provider value={ctxValue}>
        <motion.div
          ref={ref}
          {...motionProps}
          className={className}
          initial={initial ?? defaultInitial}
          {...(resolvedAnimate !== undefined ? { animate: resolvedAnimate } : {})}
          exit={exit ?? defaultExit}
          transition={transition ?? defaultTransition}
          drag={dragEnabled ? "y" : false}
          dragControls={dragControls}
          dragListener={false}
          dragConstraints={{ top: 0 }}
          dragElastic={{ top: 0, bottom: 0.35 }}
          dragMomentum={false}
          onDragEnd={
            dragEnabled
              ? (_, info) => {
                  if (info.offset.y > dismissDistancePx || info.velocity.y > dismissVelocity) {
                    onDismiss();
                  }
                }
              : undefined
          }
        >
          <div
            className="shrink-0"
            style={dragEnabled ? { touchAction: "none" } : undefined}
            onPointerDown={dragEnabled ? (e) => dragControls.start(e) : undefined}
          >
            {dragHandle}
          </div>
          {children}
        </motion.div>
      </MotionSheetContext.Provider>
    );
  }
);

export type MotionBottomSheetScrollAreaProps = ComponentPropsWithoutRef<"div"> & {
  /**
   * true: свайп-закрытие из тела только если прокрутка у верха (как в iOS).
   * false: можно начать жест с любой неинтерактивной точки (меню без скролла).
   */
  requireScrollAtTop?: boolean;
};

/**
 * Прокручиваемая (или просто тело) область шторки: свайп вниз закрывает панель,
 * не отбирая скролл у списка, когда он не у верха.
 */
export const MotionBottomSheetScrollArea = forwardRef<HTMLDivElement, MotionBottomSheetScrollAreaProps>(
  function MotionBottomSheetScrollArea(
    { className, requireScrollAtTop = true, onPointerDownCapture, ...props },
    forwardedRef
  ) {
    const ctx = useContext(MotionSheetContext);
    const innerRef = useRef<HTMLDivElement>(null);

    const mergedRef = useCallback(
      (node: HTMLDivElement | null) => {
        innerRef.current = node;
        if (typeof forwardedRef === "function") forwardedRef(node);
        else if (forwardedRef) (forwardedRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      },
      [forwardedRef]
    );

    const handlePointerDownCapture = (e: PointerEvent<HTMLDivElement>) => {
      onPointerDownCapture?.(e);
      if (e.defaultPrevented) return;
      if (!ctx?.dragEnabled) return;
      if (isInteractiveSheetTarget(e.target)) return;
      if (requireScrollAtTop && (innerRef.current?.scrollTop ?? 0) > SCROLL_TOP_EPS_PX) return;
      ctx.dragControls.start(e, { distanceThreshold: BODY_DRAG_DISTANCE_THRESHOLD_PX });
    };

    return (
      <div
        ref={mergedRef}
        className={cn(className)}
        onPointerDownCapture={handlePointerDownCapture}
        {...props}
      />
    );
  }
);
