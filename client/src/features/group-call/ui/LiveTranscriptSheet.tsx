import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Captions, ChevronDown, CheckSquare2 } from "lucide-react";
import type { GroupTranscriptSegment } from "../transcripts/types";
import { Checkbox } from "@/components/ui/checkbox";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { DURATION_NORMAL_MS, EASING_OUT_BEZIER } from "@/lib/motion";
import { AddCallSegmentsToTrackModal } from "@/features/board/call-history/AddCallSegmentsToTrackModal";

export function LiveTranscriptSheet({
  segments,
  enabled,
}: {
  segments: GroupTranscriptSegment[];
  /** Как в личном звонке: панель и реплики только пока титры включены. */
  enabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const selectedSegments = useMemo(
    () => segments.filter((segment) => selectedIds.includes(segment.id)).map((segment) => ({ id: segment.id })),
    [segments, selectedIds],
  );

  if (!enabled) return null;

  return (
    <>
      <div className="px-3 pb-2">
        <TapScaleButton
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full rounded-2xl border border-white/15 bg-white/6 px-3 py-2 text-left"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[11px] text-white/70">
              <Captions className="w-4 h-4" />
              <span>Титры и реплики</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-white/70">
              <span>{segments.length}</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
            </div>
          </div>
          <div className="mt-1 max-h-14 space-y-1 overflow-hidden">
            {segments.length === 0 ? (
              <p className="text-xs leading-snug text-white/55">Пока нет распознанных фраз — см. плашку титров над кнопками.</p>
            ) : (
              segments.slice(-2).map((segment) => (
                <div key={segment.id} className={`text-xs leading-snug ${segment.isFinal ? "text-white/90" : "text-white/65 italic"}`}>
                  <span className="font-medium text-primary/90">{segment.speakerDisplayName}:</span> {segment.textNormalized}
                  {!segment.isFinal ? " ..." : ""}
                </div>
              ))
            )}
          </div>
        </TapScaleButton>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: DURATION_NORMAL_MS / 1000, ease: EASING_OUT_BEZIER }}
            className="absolute inset-x-3 bottom-[calc(env(safe-area-inset-bottom,0px)+96px)] z-[520] overflow-hidden rounded-3xl border border-white/12 bg-[#111725]/95 shadow-2xl backdrop-blur-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-white">Все реплики звонка</p>
                <p className="text-[11px] text-white/60">Выберите одну или несколько строк для сохранения в трек</p>
              </div>
              <div className="flex items-center gap-2">
                <TapScaleButton
                  type="button"
                  onClick={() => setSelectedIds((prev) => (prev.length === segments.length ? [] : segments.map((segment) => segment.id)))}
                  className="px-3 py-1.5 rounded-lg bg-white/10 text-xs"
                >
                  {selectedIds.length === segments.length ? "Снять" : "Все"}
                </TapScaleButton>
                <TapScaleButton type="button" onClick={() => setOpen(false)} className="px-3 py-1.5 rounded-lg bg-white/10 text-xs">
                  Закрыть
                </TapScaleButton>
              </div>
            </div>
            <div className="max-h-[50vh] overflow-y-auto px-3 py-3 space-y-2">
              {segments.map((segment) => {
                const checked = selectedIds.includes(segment.id);
                return (
                  <button
                    key={segment.id}
                    type="button"
                    onClick={() => setSelectedIds((prev) => (checked ? prev.filter((id) => id !== segment.id) : [...prev, segment.id]))}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3 text-left"
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox checked={checked} className="mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-semibold text-white/95">{segment.speakerDisplayName}</p>
                        <p className={`mt-1 text-sm leading-snug break-words ${segment.isFinal ? "text-white/85" : "text-white/60 italic"}`}>
                          {segment.textNormalized}
                          {!segment.isFinal ? " ..." : ""}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-between border-t border-white/10 px-4 py-3">
              <p className="text-xs text-white/65">Выбрано: {selectedIds.length}</p>
              <TapScaleButton
                type="button"
                onClick={() => setSaveOpen(true)}
                disabled={selectedIds.length === 0}
                className="px-3 py-2 rounded-xl bg-primary text-primary-foreground text-sm inline-flex items-center gap-2"
              >
                <CheckSquare2 className="w-4 h-4" />
                В трек
              </TapScaleButton>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AddCallSegmentsToTrackModal
        isOpen={saveOpen}
        onClose={() => setSaveOpen(false)}
        segments={selectedSegments}
      />
    </>
  );
}
