/**
 * Модалка выбора трека при действии «В трек» из меню сообщения.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { List, X } from "lucide-react";
import { useCallback } from "react";
import { getTracks, addMessageToTrack } from "@/lib/tracks";
import { ListEmptyState } from "@/components/ui/empty";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { useToast } from "@/hooks/use-toast";
import { DURATION_NORMAL_MS, EASING_OUT_BEZIER, usePrefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

export type AddToTrackModalProps = {
  isOpen: boolean;
  onClose: () => void;
  messageId: string;
  chatId: string;
};

export function AddToTrackModal({ isOpen, onClose, messageId, chatId }: AddToTrackModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const reducedMotion = usePrefersReducedMotion();

  const { data: tracks = [], isLoading, error, refetch } = useQuery({
    queryKey: ["tracks"],
    queryFn: getTracks,
    enabled: isOpen,
  });

  const addMutation = useMutation({
    mutationFn: ({ trackId }: { trackId: string }) => addMessageToTrack(trackId, messageId, chatId),
    onSuccess: (_, { trackId }) => {
      queryClient.invalidateQueries({ queryKey: ["tracks"] });
      queryClient.invalidateQueries({ queryKey: ["tracks", trackId, "items"] });
      queryClient.invalidateQueries({ queryKey: ["tracks", "stats"] });
      toast({ title: "Добавлено в трек" });
      onClose();
    },
    onError: (e) => {
      toast({ title: e instanceof Error ? e.message : "Не удалось добавить", variant: "destructive" });
    },
  });

  const handleSelect = useCallback(
    (trackId: string) => {
      addMutation.mutate({ trackId });
    },
    [addMutation]
  );

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[9998] bg-black/50 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: reducedMotion ? 0.1 : DURATION_NORMAL_MS / 1000, ease: EASING_OUT_BEZIER }}
        onClick={onClose}
        aria-hidden
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-to-track-title"
        className="fixed inset-x-4 bottom-[calc(var(--uix-nav-bottom)+var(--uix-space-4))] z-[9999] mx-auto max-h-[70vh] max-w-md overflow-hidden rounded-2xl bg-background shadow-2xl border border-border/80"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ duration: reducedMotion ? 0.1 : DURATION_NORMAL_MS / 1000, ease: EASING_OUT_BEZIER }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
          <h2 id="add-to-track-title" className="text-base font-semibold">
            В трек
          </h2>
          <TapScaleButton
            type="button"
            onClick={onClose}
            haptic
            subtle
            className="p-2 rounded-full hover:bg-secondary/80 min-h-[var(--uix-touch-min)] min-w-[var(--uix-touch-min)] flex items-center justify-center"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5" />
          </TapScaleButton>
        </div>
        <div className="overflow-y-auto max-h-[calc(70vh-56px)] py-2">
          {isLoading && (
            <div className="px-4 py-6 flex flex-col gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 rounded-xl bg-muted/50 animate-pulse" />
              ))}
            </div>
          )}
          {error && (
            <div className="px-4 py-6 text-center">
              <p className="text-sm text-destructive mb-3">Не удалось загрузить треки</p>
              <TapScaleButton
                type="button"
                onClick={() => refetch()}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium"
              >
                Повторить
              </TapScaleButton>
            </div>
          )}
          {!isLoading && !error && tracks.length === 0 && (
            <div className="px-4 py-6">
              <ListEmptyState
                icon={List}
                title="Нет треков"
                description="Создайте трек в разделе Борд → Треки"
                className="min-h-[120px]"
              />
            </div>
          )}
          {!isLoading && !error && tracks.length > 0 && (
            <ul className="divide-y divide-border/40">
              {tracks.map((track) => (
                <li key={track.id}>
                  <TapScaleButton
                    type="button"
                    onClick={() => handleSelect(track.id)}
                    disabled={addMutation.isPending}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 text-left min-h-[var(--uix-touch-min)]",
                      "hover:bg-secondary/80 active:bg-secondary/60 transition-colors"
                    )}
                  >
                    <List className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    <span className="text-[15px] font-medium truncate">{track.name}</span>
                  </TapScaleButton>
                </li>
              ))}
            </ul>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
