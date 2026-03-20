import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, CheckSquare, Captions } from "lucide-react";
import { useLocation } from "wouter";
import { ErrorWithRetry, ListEmptyState } from "@/components/ui/empty";
import { TapScaleButton } from "@/components/ui/tap-scale";
import { getCallHistoryDetail, resolveCallSuggestion } from "@/lib/call-history";
import { AddCallSegmentsToTrackModal } from "./AddCallSegmentsToTrackModal";

export function CallHistoryDetailView({ callId }: { callId: string }) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [saveOpen, setSaveOpen] = useState(false);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["call-history", callId], queryFn: () => getCallHistoryDetail(callId) });
  const resolveMutation = useMutation({
    mutationFn: ({ suggestionId, status }: { suggestionId: string; status: "accepted" | "dismissed" }) => resolveCallSuggestion(callId, suggestionId, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["call-history", callId] }),
  });
  const selectedSegments = useMemo(() => (data?.segments ?? []).filter((s) => selectedIds.includes(s.id)), [data?.segments, selectedIds]);
  const selectSuggestedSegments = (payloadJson: string, fallbackSegmentId: string | null) => {
    try {
      const payload = JSON.parse(payloadJson) as { segmentIds?: string[] };
      const ids = payload.segmentIds?.length ? payload.segmentIds : fallbackSegmentId ? [fallbackSegmentId] : [];
      setSelectedIds(ids);
      setSaveOpen(true);
    } catch {
      if (fallbackSegmentId) {
        setSelectedIds([fallbackSegmentId]);
        setSaveOpen(true);
      }
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="uix-content-x pt-6 pb-4 glass z-10 sticky top-0 flex items-center justify-between gap-3 border-b border-border/50">
        <div className="flex items-center gap-2 min-w-0">
          <TapScaleButton type="button" onClick={() => setLocation("/board/calls")} subtle className="p-2 -ml-2 rounded-full" aria-label="Назад">
            <ChevronLeft className="w-6 h-6" />
          </TapScaleButton>
          <h1 className="uix-text-title truncate">Реплики звонка</h1>
        </div>
        <div className="flex items-center gap-2">
          {data && data.segments.length > 0 && (
            <TapScaleButton
              type="button"
              onClick={() => setSelectedIds((prev) => (prev.length === data.segments.length ? [] : data.segments.map((segment) => segment.id)))}
              className="px-3 py-2 rounded-xl bg-secondary text-sm"
            >
              {selectedIds.length === data.segments.length ? "Снять" : "Все"}
            </TapScaleButton>
          )}
          <TapScaleButton type="button" onClick={() => setSaveOpen(true)} className="px-3 py-2 rounded-xl bg-primary text-primary-foreground text-sm" disabled={selectedIds.length === 0}>
            В трек
          </TapScaleButton>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto pb-[var(--uix-nav-bottom)]">
        {isLoading && <div className="p-4 text-sm text-muted-foreground">Загрузка…</div>}
        {error && <ErrorWithRetry title="Не удалось загрузить звонок" description="Попробуйте ещё раз" onRetry={() => refetch()} className="border-none" />}
        {!isLoading && !error && (data?.segments.length ?? 0) === 0 && (
          <ListEmptyState icon={Captions} title="Нет реплик" description="Титры этого звонка пока пусты." className="border-none" />
        )}
        {!isLoading && !error && data && (
          <div className="p-3 space-y-3">
            {data.suggestions.filter((s) => s.status === "pending").map((s) => (
              <div key={s.id} className="rounded-2xl border border-primary/25 bg-primary/5 p-3">
                <p className="text-sm font-semibold">{s.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">Предложение собрано из последних релевантных реплик этого звонка.</p>
                <div className="mt-2 flex gap-2">
                  <TapScaleButton
                    type="button"
                    onClick={() => {
                      resolveMutation.mutate({ suggestionId: s.id, status: "accepted" });
                      selectSuggestedSegments(s.payloadJson, s.segmentId);
                    }}
                    className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm"
                  >
                    Да
                  </TapScaleButton>
                  <TapScaleButton type="button" onClick={() => resolveMutation.mutate({ suggestionId: s.id, status: "dismissed" })} className="px-3 py-2 rounded-lg bg-secondary text-sm">Нет</TapScaleButton>
                </div>
              </div>
            ))}
            {data.segments.map((segment) => {
              const checked = selectedIds.includes(segment.id);
              return (
                <button key={segment.id} type="button" onClick={() => setSelectedIds((prev) => checked ? prev.filter((id) => id !== segment.id) : [...prev, segment.id])} className="w-full rounded-2xl border border-border/60 bg-card p-3 text-left">
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 ${checked ? "text-primary" : "text-muted-foreground"}`}><CheckSquare className="w-5 h-5" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold">{segment.speakerDisplayName}</p>
                      <p className="text-sm leading-snug break-words mt-1">{segment.textNormalized}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
      <AddCallSegmentsToTrackModal isOpen={saveOpen} onClose={() => setSaveOpen(false)} segments={selectedSegments} />
    </div>
  );
}
