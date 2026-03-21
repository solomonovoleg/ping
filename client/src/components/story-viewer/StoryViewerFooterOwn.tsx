import { Brain, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveUrl } from "@/lib/api-base";
import type { StoryViewerUser } from "@/lib/stories";
import { UserAvatar } from "@/components/UserAvatar";
import { PULSE_ACCENT } from "./constants";
import { viewsWordRu } from "./format";

export function StoryViewerFooterOwn({
  prefersReducedMotion,
  viewersCount,
  viewerPreview,
  viewerPreviewLoading,
  onOpenViewers,
}: {
  prefersReducedMotion: boolean;
  viewersCount: number;
  viewerPreview: StoryViewerUser[];
  viewerPreviewLoading: boolean;
  onOpenViewers: (e: React.MouseEvent) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div
        className="flex items-center gap-2.5 rounded-2xl border px-3 py-2 backdrop-blur-md"
        style={{
          background: "rgba(0,0,0,0.45)",
          borderColor: `${PULSE_ACCENT}44`,
        }}
      >
        <Brain className="h-[13px] w-[13px] shrink-0" style={{ color: PULSE_ACCENT }} aria-hidden />
        <p className="text-[11.5px] font-medium leading-snug text-white/72">
          Удерживайте экран — пауза. Свайп влево/вправо — другие сториз.
        </p>
      </div>
      <div className="flex items-stretch gap-2">
        <button
          type="button"
          onClick={onOpenViewers}
          className="flex min-h-[var(--uix-touch-min)] min-w-0 flex-1 items-center gap-2 rounded-2xl border border-white/12 bg-black/45 py-2 pl-2 pr-3 text-left backdrop-blur-md transition-colors hover:bg-black/55 active:bg-black/60"
          aria-label={
            viewersCount > 0 ? `Просмотры: ${viewersCount}. Открыть список` : "Просмотров пока нет. Открыть список"
          }
        >
          <div className="flex shrink-0" style={{ gap: 0 }}>
            {viewerPreviewLoading ? (
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-black/60 bg-white/10">
                <span className="h-3 w-3 animate-pulse rounded-full bg-white/40" />
              </div>
            ) : viewerPreview.length > 0 ? (
              viewerPreview.map((v, i) => (
                <div
                  key={v.id}
                  className={cn("relative shrink-0 rounded-full border border-black/80", i > 0 && "-ml-1.5")}
                  style={{ zIndex: viewerPreview.length - i }}
                >
                  <UserAvatar
                    avatarUrl={v.avatarUrl ? resolveUrl(v.avatarUrl) : undefined}
                    displayName={[v.displayName, v.surname].filter(Boolean).join(" ") || `ID ${v.publicId}`}
                    seed={v.id}
                    size={32}
                    className="h-8 w-8"
                  />
                </div>
              ))
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-black/60 bg-white/10">
                <Eye className="h-3.5 w-3.5 text-white/55" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-extrabold leading-none text-white">{viewersCount > 0 ? viewersCount : "—"}</p>
            <p className="mt-0.5 text-[9.5px] font-medium text-white/45">
              {viewersCount > 0 ? viewsWordRu(viewersCount) : "просмотров"} · нажмите для списка
            </p>
          </div>
          <Eye className="ml-auto h-3 w-3 shrink-0 text-white/40" aria-hidden />
        </button>
        <button
          type="button"
          onClick={onOpenViewers}
          className="flex min-h-[var(--uix-touch-min)] shrink-0 items-center gap-1.5 rounded-2xl border px-3 py-2 backdrop-blur-md transition-opacity hover:opacity-95 active:opacity-90"
          style={{
            background: `${PULSE_ACCENT}22`,
            borderColor: `${PULSE_ACCENT}44`,
          }}
          aria-label="Открыть список просмотров"
        >
          <Eye className="h-[13px] w-[13px]" style={{ color: PULSE_ACCENT }} />
        </button>
      </div>
      <button type="button" onClick={onOpenViewers} className="flex w-full flex-col items-center gap-1 pb-1 pt-0.5 text-center">
        <div className="flex gap-0.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-1 w-1 rounded-full bg-white/35"
              style={{
                animation: prefersReducedMotion ? undefined : `pulseStoryLiveBlip 1.4s ease-in-out ${i * 0.2}s infinite`,
              }}
            />
          ))}
        </div>
        <span className="text-[11px] font-semibold tracking-wide text-white/38">ПРОСМОТРЫ · НАЖМИТЕ ВЫШЕ</span>
      </button>
    </div>
  );
}
