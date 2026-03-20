import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { List, Plus, X } from "lucide-react";
import { addCallSegmentToTrack, createTrack, getTracks } from "@/lib/tracks";
import { ListEmptyState } from "@/components/ui/empty";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";

export function AddCallSegmentsToTrackModal({
  isOpen,
  onClose,
  segments,
}: {
  isOpen: boolean;
  onClose: () => void;
  segments: Array<{ id: string }>;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newTrackName, setNewTrackName] = useState("");
  useEffect(() => {
    if (!isOpen) setNewTrackName("");
  }, [isOpen]);
  const { data: tracks = [] } = useQuery({ queryKey: ["tracks"], queryFn: getTracks, enabled: isOpen });
  const mutation = useMutation({
    mutationFn: async (trackId: string) => {
      for (const segment of segments) await addCallSegmentToTrack(trackId, segment.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tracks"] });
      queryClient.invalidateQueries({ queryKey: ["tracks", "stats"] });
      toast({ title: "Реплики добавлены в трек" });
      onClose();
    },
    onError: (e) => toast({ title: e instanceof Error ? e.message : "Не удалось добавить", variant: "destructive" }),
  });
  const createMutation = useMutation({
    mutationFn: async () => {
      const track = await createTrack(newTrackName.trim() || "Новый трек");
      for (const segment of segments) await addCallSegmentToTrack(track.id, segment.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tracks"] });
      queryClient.invalidateQueries({ queryKey: ["tracks", "stats"] });
      setNewTrackName("");
      toast({ title: "Создан трек и добавлены реплики" });
      onClose();
    },
    onError: (e) => toast({ title: e instanceof Error ? e.message : "Не удалось создать трек", variant: "destructive" }),
  });
  if (!isOpen) return null;
  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 z-[9998] bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.div className="fixed inset-x-4 bottom-[calc(var(--uix-nav-bottom)+var(--uix-space-4))] z-[9999] mx-auto max-w-md overflow-hidden rounded-2xl border bg-background" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
          <h2 className="text-base font-semibold">Сохранить реплики в трек</h2>
          <TapScaleButton type="button" onClick={onClose} subtle className="p-2 rounded-full" aria-label="Закрыть"><X className="w-5 h-5" /></TapScaleButton>
        </div>
        <div className="px-4 pt-3 pb-1 text-xs text-muted-foreground">
          Выбрано реплик: {segments.length}
        </div>
        <div className="px-4 pt-3 pb-2 border-b border-border/40">
          <div className="flex gap-2">
            <Input
              value={newTrackName}
              onChange={(e) => setNewTrackName(e.target.value)}
              placeholder="Новый трек для этих реплик"
              className="flex-1"
            />
            <TapScaleButton
              type="button"
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || segments.length === 0}
              className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm shrink-0 inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Создать
            </TapScaleButton>
          </div>
        </div>
        <div className="max-h-[60vh] overflow-y-auto py-2">
          {tracks.length === 0 ? (
            <div className="px-4 py-6"><ListEmptyState icon={List} title="Нет треков" description="Создайте трек в разделе Борд → Треки" className="min-h-[120px]" /></div>
          ) : (
            <ul className="divide-y divide-border/40">
              {tracks.map((track) => (
                <li key={track.id}>
                  <TapScaleButton type="button" onClick={() => mutation.mutate(track.id)} className="w-full px-4 py-3 text-left text-sm font-medium">
                    <span className="block truncate">{track.name}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">Добавить {segments.length} реплик</span>
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
