import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { DURATION_NORMAL_S, EASING_OUT_BEZIER, usePrefersReducedMotion } from "@/lib/motion";
import { UploadProgressPanel } from "@/components/ui/upload-progress-panel";

type UploadStripKind = "media" | "voice";

export type ChatDetailComposerUploadStripProps = {
  visible: boolean;
  kind: UploadStripKind;
  percent: number | null;
  reducedMotion?: boolean;
};

const TITLE: Record<UploadStripKind, string> = {
  media: "Загрузка файла",
  voice: "Отправка голосового",
};

/**
 * Полоса прогресса над капсулой ввода — оболочка композера + общий {@link UploadProgressPanel}.
 */
export function ChatDetailComposerUploadStrip({
  visible,
  kind,
  percent,
  reducedMotion: reducedMotionProp,
}: ChatDetailComposerUploadStripProps) {
  const reducedFromHook = usePrefersReducedMotion();
  const reducedMotion = reducedMotionProp ?? reducedFromHook;

  return (
    <AnimatePresence initial={false}>
      {visible ? (
        <motion.div
          key="chat-upload-strip"
          className={cn(
            "chat-composer-strip chat-composer-strip--upload mb-1.5 overflow-hidden rounded-xl border shadow-sm",
            "border-[var(--chat-composer-stroke)] bg-[var(--chat-composer-fill)]",
          )}
          role="status"
          aria-live="polite"
          aria-busy="true"
          aria-label={kind === "voice" ? "Отправка голосового сообщения" : "Загрузка вложения в чат"}
          initial={reducedMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
          transition={{ duration: DURATION_NORMAL_S * 0.78, ease: EASING_OUT_BEZIER }}
        >
          <UploadProgressPanel
            title={TITLE[kind]}
            percent={percent}
            indeterminateHint={kind === "voice" ? "Загрузка…" : "Подготовка…"}
            size="sm"
            reducedMotion={reducedMotion}
          />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
